import { anthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'

export async function POST(req: Request) {
  const { agentType, agentName, scenario, agentResponse, userFeedback, skills } = await req.json() as {
    agentType: string
    agentName: string
    scenario: string
    agentResponse: string
    userFeedback: { tags: string[]; note?: string }
    skills: { name: string; description: string }[]
  }

  const skillList = skills.map((s) => `- ${s.name}：${s.description}`).join('\n')
  const feedbackText = [
    ...userFeedback.tags,
    userFeedback.note ? `補足：${userFeedback.note}` : '',
  ].filter(Boolean).join(' / ')

  const { text } = await generateText({
    model: anthropic('claude-haiku-4-5'),
    prompt: `AIエージェント「${agentName}」（${agentType}）がクエストに挑戦しました。
この結果を分析して、スキルの成長につながる洞察を抽出してください。

## クエストシナリオ
${scenario}

## エージェントの回答
${agentResponse}

## ユーザーのフィードバック
${feedbackText || '（フィードバックなし）'}

## 現在のスキル
${skillList}

以下のJSON形式のみで出力（説明文不要）：
{
  "outcome": "success" | "partial" | "failure",
  "outcomeReason": "結果の理由（30〜60文字）",
  "skillSeeds": [
    {
      "title": "スキルの種のタイトル（10〜20文字）",
      "summary": "この挑戦で芽生えた新しい学び・気づき（30〜60文字）",
      "relatedSkillName": "既存スキル名（関連するものがあれば。なければnull）"
    }
  ],
  "skillUpdates": [
    {
      "skillName": "更新対象の既存スキル名",
      "reason": "なぜこのスキルが深まったか（20〜40文字）"
    }
  ],
  "newPersonaTrait": {
    "label": "この挑戦から見えた行動特性ラベル（5〜12文字）",
    "description": "説明（20〜40文字）"
  } または null
}

【ルール】
- skillSeedsは0〜2個（本当に新しい学びがあった場合のみ生成）
- skillUpdatesは0〜1個（明確な深化があった場合のみ）
- newPersonaTraitは挑戦の中で際立った特性があった場合のみ設定`,
    maxOutputTokens: 600,
  })

  try {
    const cleaned = text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '')
    return Response.json(JSON.parse(cleaned))
  } catch {
    return Response.json({
      outcome: 'partial',
      outcomeReason: 'クエスト完了。引き続き教え込みを続けよう。',
      skillSeeds: [],
      skillUpdates: [],
      newPersonaTrait: null,
    })
  }
}
