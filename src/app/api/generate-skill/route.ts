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

このセッションを分析して、以下のJSON形式のみで出力してください（説明文不要）：

{
  "skillName": "スキル名（5〜15文字の印象的な名称）",
  "summary": "このスキルで何ができるか（25〜40文字）",
  "keyPoints": ["ポイント1（具体的に）", "ポイント2", "ポイント3"],
  "personaInsight": "このユーザーの思考・行動の特性（30〜60文字。例：「ROIから逆算して判断する傾向がある」「スピードを最優先する行動型」。会話から読み取れた場合のみ記載、読み取れない場合はnull）"
}`,
    maxOutputTokens: 400,
  })

  try {
    const cleaned = text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '')
    const json = JSON.parse(cleaned)
    return Response.json(json)
  } catch {
    return Response.json({
      skillName: topic.slice(0, 15),
      summary: `${category}分野の知識をインプット`,
      keyPoints: ['セッションで学んだ知識を習得'],
      personaInsight: null,
    })
  }
}
