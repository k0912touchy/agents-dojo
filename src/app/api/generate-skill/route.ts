import { anthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import type { Message } from '@/lib/agent'

export async function POST(req: Request) {
  const { messages, category, topic, agentType } = await req.json() as {
    messages: Message[]
    category: string
    topic: string
    agentType: string
  }

  const conversation = messages
    .map((m) => `${m.role === 'user' ? 'ユーザー' : 'エージェント'}: ${m.content}`)
    .join('\n')

  const { text } = await generateText({
    model: anthropic('claude-haiku-4-5'),
    prompt: `以下は、ユーザーがAIエージェントに知識・TIPSを教え込んだセッションの会話です。

カテゴリ：${category}
テーマ：${topic}
エージェントタイプ：${agentType}

---
${conversation}
---

このセッションで学んだ内容を、エージェントのスキルカードにします。
以下のJSON形式で出力してください（他の文章は一切不要）：

{
  "skillName": "スキル名（5〜15文字のキャッチーな名称）",
  "summary": "このスキルで何ができるか（20〜40文字）",
  "keyPoints": ["ポイント1", "ポイント2", "ポイント3"]
}`,
    maxOutputTokens: 300,
  })

  try {
    const json = JSON.parse(text.trim())
    return Response.json(json)
  } catch {
    return Response.json({
      skillName: topic.slice(0, 15),
      summary: `${category}分野の知識をインプット`,
      keyPoints: ['セッションで学んだ知識を習得'],
    })
  }
}
