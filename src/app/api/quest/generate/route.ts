import { anthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'

export async function POST(req: Request) {
  const { agentType, agentName, skills, difficulty } = await req.json() as {
    agentType: string
    agentName: string
    skills: { name: string; description: string }[]
    difficulty: 1 | 2 | 3
  }

  const difficultyLabel = difficulty === 1 ? '入門（習得済みスキルを素直に使えばOK）'
    : difficulty === 2 ? '中級（複数スキルの組み合わせや判断が必要）'
    : '上級（想定外の状況・スキルの応用力が試される）'

  const skillList = skills.map((s) => `- ${s.name}：${s.description}`).join('\n')

  const { text } = await generateText({
    model: anthropic('claude-haiku-4-5'),
    prompt: `あなたはAIエージェント「${agentName}」（${agentType}）のクエスト設計者です。
このエージェントが習得しているスキルを使って解くべき、リアルなシナリオ問題を1問作ってください。

## エージェントのスキル
${skillList}

## 難易度
${difficultyLabel}

## クエスト設計の原則
- ビジネスや日常で実際に起こりうるシナリオ
- 答えが一つではなく、思考プロセスが問われる
- 200〜350文字程度のシナリオ文
- 実名・社名・機密情報を含めない

以下のJSON形式のみで出力（説明文不要）：
{
  "title": "クエストタイトル（15文字以内）",
  "scenario": "シナリオ本文（200〜350文字）",
  "hint": "どのスキルが役立つかのヒント（30〜50文字）",
  "tokenCost": ${difficulty === 1 ? 300 : difficulty === 2 ? 600 : 1000}
}`,
    maxOutputTokens: 600,
  })

  try {
    const cleaned = text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '')
    return Response.json(JSON.parse(cleaned))
  } catch {
    return Response.json({
      title: `${agentType}の試練 Lv.${difficulty}`,
      scenario: `あなた（${agentName}）の判断力を試すシナリオです。習得したスキルを活かして、最善の回答を導いてください。`,
      hint: `${skills[0]?.name ?? 'スキル'}を中心に考えてみよう`,
      tokenCost: difficulty === 1 ? 300 : difficulty === 2 ? 600 : 1000,
    })
  }
}
