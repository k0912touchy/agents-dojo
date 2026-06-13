import { anthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'

export async function POST(req: Request) {
  const { categoryLabel, topic, background, agentType } = await req.json() as {
    categoryLabel: string
    topic: string
    background: string
    agentType: string
  }

  const { text } = await generateText({
    model: anthropic('claude-haiku-4-5'),
    prompt: `AIエージェント（${agentType}）の学習セッションを設計するアシスタントです。

カテゴリ：${categoryLabel}
テーマ：${topic}
背景知識：${background || 'なし'}

このテーマについて、ユーザーが知識ゼロでも理解できる整理ポイント（3〜4点）と、
ユーザー自身の体験・視点を引き出す具体的な問いかけを生成してください。

【ルール】
- researchPoints：専門用語は避け、現場で使えるレベルの具体的な知識を3〜4点
- confirmQuestion：「あなた自身は〇〇という場面で〜〜したことがありますか？」のように、体験ベースで答えやすい具体的な問い（1文・50文字以内）

JSON形式のみで出力：
{
  "researchPoints": ["ポイント1（30〜60文字）", "ポイント2", "ポイント3"],
  "confirmQuestion": "あなた自身の体験・視点を聞く問い（1文）"
}`,
    maxOutputTokens: 400,
  })

  try {
    const cleaned = text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '')
    return Response.json(JSON.parse(cleaned))
  } catch {
    return Response.json({
      researchPoints: [
        `${topic}は現場での実践経験が重要な領域です`,
        `自分の判断軸を言語化することでエージェントの精度が上がります`,
      ],
      confirmQuestion: `${topic}に関して、最近経験した場面はありますか？`,
    })
  }
}
