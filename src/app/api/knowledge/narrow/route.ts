import { anthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'

export async function POST(req: Request) {
  const { topic } = await req.json() as { topic: string }

  const { text } = await generateText({
    model: anthropic('claude-haiku-4-5'),
    maxOutputTokens: 400,
    prompt: `ユーザーが「${topic}」についての知識をAIエージェントに持たせようとしています。
この知識を「広すぎず、ユーザーの用途にソリッドに絞り込む」ために、
選択式の絞り込み質問を3〜4問作ってください。

以下のJSON形式のみで出力してください（説明文不要）:

{
  "questions": [
    {
      "id": "q1",
      "question": "質問文",
      "options": ["選択肢A", "選択肢B", "選択肢C"]
    }
  ]
}`,
  })

  try {
    const cleaned = text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '')
    return Response.json(JSON.parse(cleaned))
  } catch {
    return Response.json({ questions: [] })
  }
}
