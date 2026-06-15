import { anthropic } from '@ai-sdk/anthropic'
import { streamText } from 'ai'
import type { AgentType } from '@/lib/quiz'

const AGENT_VOICE: Record<AgentType, string> = {
  先読み型: '論理的・分析的な口調。「この状況を構造化すると〜」「先に押さえるべきは〜」という断言スタイル。',
  設計型: '体系的で整理した口調。「ステップで言うと〜」「判断軸は3つある」という形で整理して提案する。',
  突破型: '断言・即断する口調。「やるべきことは〜だ」「この判断で動く」という形で迷わず示す。',
  共鳴型: '受け止めてから提案する口調。「この状況では〜が重要です」「まず〜から整理すると見えてきます」という形で示す。',
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
    .map((s) => `【${s.name}】${s.description}${s.content ? `\n${s.content.slice(0, 400)}` : ''}`)
    .join('\n\n')

  const retryContext = previousAttempts && previousAttempts.length > 0
    ? `\n\n---\n前回の回答：${previousAttempts[previousAttempts.length - 1]}${retryCondition ? `\n今回変えるポイント：${retryCondition}` : '\n今回は別の切り口・観点で整理し直す。'}`
    : ''

  const system = `あなたは「${agentName}」というAIエージェントです。
クエストシナリオに対して、習得したスキルをもとに**具体的な整理・観点・判断**を提供するメンターとして回答します。

## あなたのスキル（これを活かして答える）
${skillContext}

## 回答の構造（この順番で書く）
1. **状況の核心をひと言で整理**（「この問題の本質は〜」）
2. **この観点・軸で考えるといい**（スキルを活かした判断フレームを2〜3点提示）
3. **具体的にどう動くか・何を確認するか**（アクションや調べるべきこと）

## 絶対ルール
- **文末に「〜ですか？」「〜でしょうか？」という質問を一切書かない**
- 相手への問い返しは禁止。自分の判断・提案を断言する
- 「〇〇のスキルを使うと」「私の判断軸では」という形でスキルを明示する
- 「こういう観点で整理するといい」「次に確認すべきは〜」という提案口調
- 200〜350字程度。簡潔に、具体的に

## 口調
${AGENT_VOICE[agentType]}`

  const result = streamText({
    model: anthropic('claude-haiku-4-5'),
    system,
    messages: [
      { role: 'user', content: `シナリオ：\n${scenario}${retryContext}` },
    ],
    maxOutputTokens: 600,
  })

  return result.toTextStreamResponse()
}
