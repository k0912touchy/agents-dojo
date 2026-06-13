import type { AgentType } from './quiz'

export interface PersonalKnowledge {
  summary: string          // 「〇〇の文脈に基づく知識」など（表示用・非機密）
  raw?: string             // 実際の固有情報（アカウント管理用・将来的にサーバー側保管）
  linkedSkillName: string  // 紐づくスキル名
  detectedAt: string
}

export interface SkillSeed {
  id: string
  title: string
  summary: string
  relatedSkillName?: string
  fromQuestTitle?: string
  discoveredAt: string
}

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
  personaTraits: string[]
  personalKnowledge?: PersonalKnowledge[]
  skillSeeds?: SkillSeed[]
  totalTokens: number
  sessionTokens: number
}

export type SkillRank = 1 | 2 | 3 | 4 | 5

export interface Skill {
  name: string
  description: string
  earnedAt: number
  rank?: SkillRank
  content?: string
  isPrivate?: boolean  // 外部公開時に除外されるスキル
}

export function renderStars(rank: SkillRank): string {
  return '★'.repeat(rank) + '☆'.repeat(5 - rank)
}

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export type AgentTier = 'E' | 'D' | 'C' | 'B' | 'A' | 'S'

export const TIER_COLORS: Record<AgentTier, string> = {
  E: '#64748B',
  D: '#94A3B8',
  C: '#60A5FA',
  B: '#34D399',
  A: '#FFC300',
  S: '#F97316',
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

const agentTypeGrowthMap: Record<AgentType, Partial<Record<keyof Agent['params'], number>>> = {
  先読み型: { analysis: 5, expertise: 3 },
  設計型: { execution: 5, analysis: 3 },
  突破型: { execution: 6, creativity: 3 },
  共鳴型: { empathy: 6, creativity: 3 },
}

const categoryGrowthMap: Record<string, Partial<Record<keyof Agent['params'], number>>> = {
  strategy: { analysis: 2, expertise: 1 },
  marketing: { creativity: 2, empathy: 1 },
  finance: { expertise: 2, analysis: 1 },
  legal: { expertise: 2, execution: 1 },
  framework: { analysis: 2, execution: 1 },
  thinking: { empathy: 2, creativity: 1 },
  other: { execution: 1, creativity: 1 },
}

export function calcParamGrowth(
  params: Agent['params'],
  type: AgentType,
  tokensGained: number,
  categoryId?: string
): Agent['params'] {
  const multiplier = tokensGained / 1000
  const updated = { ...params }

  const typeGrowth = agentTypeGrowthMap[type]
  ;(Object.keys(typeGrowth) as (keyof Agent['params'])[]).forEach((key) => {
    updated[key] = Math.min(99, updated[key] + Math.floor((typeGrowth[key] ?? 0) * multiplier))
  })

  if (categoryId && categoryGrowthMap[categoryId]) {
    const catGrowth = categoryGrowthMap[categoryId]
    ;(Object.keys(catGrowth) as (keyof Agent['params'])[]).forEach((key) => {
      updated[key] = Math.min(99, updated[key] + Math.floor((catGrowth[key] ?? 0) * multiplier))
    })
  }

  return updated
}

export function calcAgentTier(agent: Agent): AgentTier {
  const paramValues = Object.values(agent.params) as number[]
  const avgParam = paramValues.reduce((a, b) => a + b, 0) / paramValues.length
  const skillBonus = Math.min(agent.skills.length * 5, 25)
  const score = avgParam + skillBonus
  if (score >= 65) return 'S'
  if (score >= 50) return 'A'
  if (score >= 35) return 'B'
  if (score >= 20) return 'C'
  if (score >= 10) return 'D'
  return 'E'
}

export interface DetectedTrait {
  label: string
  description: string
  detectedAt: string
}

export function saveAgent(agent: Agent) {
  localStorage.setItem('dojo_agent', JSON.stringify(agent))
}

export function loadAgent(): Agent | null {
  try {
    const raw = localStorage.getItem('dojo_agent')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveDetectedTrait(trait: DetectedTrait) {
  const existing = loadDetectedTraits()
  if (existing.some((t) => t.label === trait.label)) return
  localStorage.setItem('dojo_detected_traits', JSON.stringify([...existing, trait]))
}

export function loadDetectedTraits(): DetectedTrait[] {
  try {
    const raw = localStorage.getItem('dojo_detected_traits')
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveAgentToArchive(agent: Agent) {
  const archive = loadAgentArchive()
  const idx = archive.findIndex((a) => a.name === agent.name && a.type === agent.type)
  if (idx >= 0) {
    archive[idx] = agent
  } else {
    archive.unshift(agent)
  }
  localStorage.setItem('dojo_agents_archive', JSON.stringify(archive))
}

export function loadAgentArchive(): Agent[] {
  try {
    const raw = localStorage.getItem('dojo_agents_archive')
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}
