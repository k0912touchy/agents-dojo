import { anthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'

export async function POST(req: Request) {
  const { categoryLabel, userMessage, agentType } = await req.json() as {
    categoryLabel: string
    userMessage: string
    agentType: string
  }

  const { text } = await generateText({
    model: anthropic('claude-haiku-4-5'),
    prompt: `ユーザーが「${categoryLabel}」カテゴリでAIエージェントに教え込みたい内容を相談しています。

エージェントタイプ：${agentType}
ユーザーの状況・ニーズ：
${userMessage}

このユーザーに最適な3つの学習テーマを提案してください。
- 各テーマは「このエージェントに何を学ばせるか」を具体的に表すタイトル（10〜25文字）
- ユーザーの言葉・状況に寄り添った具体的なテーマ
- 抽象的・一般的すぎるタイトルは避ける

JSON形式のみで出力（説明文不要）：
{
  "suggestions": ["テーマ1", "テーマ2", "テーマ3"],
  "reply": "ユーザーへの一言（20〜40文字。状況を受け止めて、提案につなぐ一文）"
}`,
    maxOutputTokens: 400,
  })

  try {
    const cleaned = text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '')
    const json = JSON.parse(cleaned)
    return Response.json(json)
  } catch {
    return Response.json({
      suggestions: [
        `${categoryLabel}の実践アプローチ`,
        `${categoryLabel}における判断基準`,
        `${categoryLabel}の失敗パターンと対策`,
      ],
      reply: 'いくつか候補を出しました。',
    })
  }
}
