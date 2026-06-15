import { anthropic } from '@ai-sdk/anthropic'
import { streamText } from 'ai'
import type { AgentType } from '@/lib/quiz'

const AGENT_VOICE: Record<AgentType, string> = {
  先読み型: '論理的で先を読む口調。「この状況を分析すると〜」「先に〜を確認しておくと」という形で判断を示す。',
  設計型: '体系的で整理した口調。「ステップで言うと〜」「構造化すると〜」という形で整理して答える。',
  突破型: '前のめりで断言する口調。「やるべきことは〜だ」「迷わず〜を選ぶ」という形で即断する。',
  共鳴型: '状況を受け止めてから答える口調。「この状況では〜が重要です」「まず〜から考えます」という形で丁寧に示す。',
}

export async function POST(req: Request) {
  const { agentType, agentName, scenario, skills, previousAttempts, retryCondition } = await req.json() as {
    agentType: AgentType
    agentName: string
    scenario: string
    skills: { name: string; description: string; content?: string }[]
    previousAttempts?: string[]
    retryCondition?: string
  }

  const skillContext = skills
    .map((s) => `【${s.name}】${s.description}${s.content ? `\n詳細：${s.content.slice(0, 300)}` : ''}`)
    .join('\n\n')

  const retryContext = previousAttempts && previousAttempts.length > 0
    ? `\n\n## 前回の回答（別のアプローチで改善してください）\n${previousAttempts[previousAttempts.length - 1]}${retryCondition ? `\n\n## 今回変えるポイント\n${retryCondition}` : ''}`
    : ''

  const system = `あなたは「${agentName}」というAIエージェントです。
習得したスキルを持ち、クエストシナリオに対して具体的な判断・提案を出す場面です。

## あなたのスキル
${skillContext}

## 回答のルール
- **質問で返してはいけない**。具体的な判断・アクション・提案を出す
- スキルを明示的に活かした回答にする（「〇〇スキルで言うと〜」「私の判断軸は〜」）
- 曖昧な一般論は禁止。このシナリオに対して「自分ならこうする」を具体的に
- 200〜350字程度でまとめる。箇条書き可

## 口調
${AGENT_VOICE[agentType]}`

  const result = streamText({
    model: anthropic('claude-haiku-4-5'),
    system,
    messages: [
      { role: 'user', content: `シナリオ：\n${scenario}${retryContext}` },
    ],
    maxOutputTokens: 500,
  })

  return result.toTextStreamResponse()
}
