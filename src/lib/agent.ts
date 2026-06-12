import type { AgentType } from './quiz'

export interface Agent {
  name: string
  type: AgentType
  params: {
    expertise: number
    empathy: number
    analysis: number
    execution: number
    creativity: number
  }
  skills: Skill[]
  totalTokens: number
  sessionTokens: number
}

export interface Skill {
  name: string
  description: string
  earnedAt: number // tokens at time of earning
}

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export const PARAM_LABELS: Record<string, string> = {
  expertise: '専門性',
  empathy: '共感力',
  analysis: '分析力',
  execution: '実行力',
  creativity: '創造性',
}

export const BIRTH_THRESHOLD = 5000
export const GRADUATION_THRESHOLD = 35000

export function calcParamGrowth(
  params: Agent['params'],
  type: AgentType,
  tokensGained: number
): Agent['params'] {
  const multiplier = tokensGained / 1000

  const growthMap: Record<AgentType, Partial<Record<keyof Agent['params'], number>>> = {
    先読み型: { analysis: 2.5, expertise: 1.5 },
    設計型: { execution: 2.5, analysis: 1.5 },
    突破型: { execution: 3, creativity: 1.5 },
    共鳴型: { empathy: 3, creativity: 1.5 },
  }

  const growth = growthMap[type]
  const updated = { ...params }

  ;(Object.keys(growth) as (keyof Agent['params'])[]).forEach((key) => {
    const delta = Math.floor((growth[key] ?? 0) * multiplier)
    updated[key] = Math.min(99, updated[key] + delta)
  })

  return updated
}

export function saveAgent(agent: Agent) {
  sessionStorage.setItem('dojo_agent', JSON.stringify(agent))
}

export function loadAgent(): Agent | null {
  try {
    const raw = sessionStorage.getItem('dojo_agent')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
