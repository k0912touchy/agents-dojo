// DOJO core data model — 人格 × 知識 × 経験

export type PerspectiveType = 'mirror' | 'complement' | 'contrarian'
export type StanceType = 'analytical' | 'intuitive' | 'critical' | 'empathetic'
export type KnowledgeSource = 'ai-researched' | 'user-authored' | 'marketplace'
export type ExperienceType = 'simulation' | 'conversation'

export interface PersonaTraits {
  riskTolerance: number    // 0-1: low→high
  decisionSpeed: number    // 0-1: deliberate→fast
  abstractionLevel: number // 0-1: tactical→strategic
  stance: StanceType
}

export interface Persona {
  perspectiveType: PerspectiveType
  traits: PersonaTraits
  description: string         // AI-generated — HOW this agent thinks
  quizAnswers: Record<string, string>
}

export interface KnowledgeItem {
  id: string
  title: string
  domain: string
  content: string            // Markdown
  source: KnowledgeSource
  createdAt: string
  tags: string[]
}

export interface ExperienceTrait {
  label: string
  description: string
}

export interface Experience {
  id: string
  type: ExperienceType
  title: string
  derivedTraits: ExperienceTrait[]
  summary: string
  completedAt: string
}

export interface Agent {
  id: string
  name: string
  createdAt: string
  persona: Persona
  knowledge: KnowledgeItem[]
  experiences: Experience[]
}

// --- Perspective type metadata ---

export const PERSPECTIVE_META: Record<PerspectiveType, {
  label: string
  description: string
  color: string
  bg: string
  icon: string
}> = {
  mirror: {
    label: '分身型',
    description: '自分の思考を深掘り・整理してくれる相棒',
    color: 'var(--mirror-color)',
    bg: 'var(--mirror-bg)',
    icon: '🪞',
  },
  complement: {
    label: '補完型',
    description: '自分が苦手な視点を補い、盲点を埋めてくれる',
    color: 'var(--complement-color)',
    bg: 'var(--complement-bg)',
    icon: '🧩',
  },
  contrarian: {
    label: '対立型',
    description: '反論・批判で判断の穴を先に洗い出してくれる',
    color: 'var(--contrarian-color)',
    bg: 'var(--contrarian-bg)',
    icon: '⚔️',
  },
}

export const STANCE_LABEL: Record<StanceType, string> = {
  analytical: '数値・論理起点',
  intuitive:  '直感・全体感起点',
  critical:   'リスク先読み',
  empathetic: '関係・感情重視',
}

// --- System prompt builder ---

export function buildAgentSystemPrompt(agent: Agent): string {
  const { persona, knowledge, experiences } = agent
  const pm = PERSPECTIVE_META[persona.perspectiveType]

  const knowledgeSection = knowledge.length > 0
    ? `\n\n## 知識ベース\n${knowledge.map(k => `### ${k.title}\n${k.content.slice(0, 600)}`).join('\n\n')}`
    : ''

  const experienceSection = experiences.length > 0
    ? `\n\n## 経験から得た思考傾向\n${experiences.flatMap(e => e.derivedTraits).map(t => `- **${t.label}**: ${t.description}`).join('\n')}`
    : ''

  const traitLines = [
    `リスク許容度: ${persona.traits.riskTolerance < 0.4 ? '低（慎重）' : persona.traits.riskTolerance > 0.6 ? '高（積極）' : '中程度'}`,
    `判断スピード: ${persona.traits.decisionSpeed < 0.4 ? '熟考型' : persona.traits.decisionSpeed > 0.6 ? '即断型' : '状況次第'}`,
    `視座: ${persona.traits.abstractionLevel < 0.4 ? '戦術・実務寄り' : persona.traits.abstractionLevel > 0.6 ? '戦略・構造寄り' : 'バランス型'}`,
    `判断スタイル: ${STANCE_LABEL[persona.traits.stance]}`,
  ].join('\n')

  return `あなたは「${agent.name}」というAIエージェントです。

## あなたの人格
${persona.description}

## 思考スタイル
視点タイプ: ${pm.label} — ${pm.description}

${traitLines}${knowledgeSection}${experienceSection}

## 絶対ルール
- ユーザーが言ったことをそのまま返さない。必ず自分の視点でフィルタリングする
- 視点タイプが「対立型」なら: 反論・穴の指摘を必ず含める
- 視点タイプが「補完型」なら: ユーザーが見ていない角度を必ず加える
- 視点タイプが「分身型」なら: ユーザーの考えをより深く・明確に整理する
- 普通のAIアシスタントのような一般論で終わらない。自分の思考スタイルで断言する`
}
