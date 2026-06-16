import { anthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import { buildAgentSystemPrompt, type Agent } from '@/lib/dojo'

export async function POST(req: Request) {
  const { agent, scenarioId, scenarioTitle, decisions } = await req.json() as {
    agent: Agent
    scenarioId: string
    scenarioTitle: string
    decisions: { situation: string; choice: string; consequence: string }[]
  }

  const agentSystemPrompt = buildAgentSystemPrompt(agent)

  const decisionLog = decisions
    .map((d, i) => `【場面${i + 1}】${d.situation}\n選択: ${d.choice}\n結果: ${d.consequence}`)
    .join('\n\n')

  const { text } = await generateText({
    model: anthropic('claude-haiku-4-5'),
    maxOutputTokens: 600,
    prompt: `${agentSystemPrompt}

---
あなたは「${scenarioTitle}」というシナリオを経験しました。

## 経験した判断と結果
${decisionLog}

---
この経験から、あなたが獲得した「思考の癖・判断パターン」を分析してください。
以下のJSON形式のみで出力してください（説明文不要）:

{
  "summary": "このシナリオで得た経験の要約（2〜3文）",
  "derivedTraits": [
    {
      "label": "思考の癖のラベル（4〜8文字）",
      "description": "この経験で形成された判断パターン・思考傾向（20〜40文字）"
    },
    {
      "label": "2つ目のラベル",
      "description": "2つ目の説明"
    }
  ]
}`,
  })

  try {
    const cleaned = text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '')
    return Response.json(JSON.parse(cleaned))
  } catch {
    return Response.json({
      summary: `${scenarioTitle}を通じて判断の経験を積みました。`,
      derivedTraits: [{ label: '実践経験', description: 'シナリオを通じて現場判断の感覚を得た' }],
    })
  }
}
