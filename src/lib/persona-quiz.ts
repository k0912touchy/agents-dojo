import type { PerspectiveType, StanceType, PersonaTraits, Persona } from './dojo'

export interface QuizOption {
  key: string
  text: string
  // weights that this answer contributes
  weights: Partial<{
    perspective: PerspectiveType
    riskTolerance: number
    decisionSpeed: number
    abstractionLevel: number
    stance: StanceType
  }>
}

export interface QuizQuestion {
  id: string
  question: string
  options: QuizOption[]
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 'perspective',
    question: 'このエージェントに、何を求めますか？',
    options: [
      {
        key: 'A',
        text: '自分の考えをより深く整理・言語化してほしい',
        weights: { perspective: 'mirror' },
      },
      {
        key: 'B',
        text: '自分が苦手な視点や盲点を補ってほしい',
        weights: { perspective: 'complement' },
      },
      {
        key: 'C',
        text: '自分の判断にあえて反論・批判してほしい',
        weights: { perspective: 'contrarian' },
      },
    ],
  },
  {
    id: 'risk',
    question: '重要な判断をする時、あなたは？',
    options: [
      {
        key: 'A',
        text: '十分な情報が揃うまで動かない',
        weights: { riskTolerance: 0.2, decisionSpeed: 0.2, stance: 'analytical' },
      },
      {
        key: 'B',
        text: 'まず動いて、結果から学ぶ',
        weights: { riskTolerance: 0.8, decisionSpeed: 0.9, stance: 'intuitive' },
      },
      {
        key: 'C',
        text: '最悪ケースを先に洗い出してから動く',
        weights: { riskTolerance: 0.3, decisionSpeed: 0.4, stance: 'critical' },
      },
      {
        key: 'D',
        text: '関係者の合意・感情を最優先に整える',
        weights: { riskTolerance: 0.5, decisionSpeed: 0.5, stance: 'empathetic' },
      },
    ],
  },
  {
    id: 'abstraction',
    question: '問題を見る時、あなたはどちらから入りますか？',
    options: [
      {
        key: 'A',
        text: '目の前の具体的な課題から入る',
        weights: { abstractionLevel: 0.2 },
      },
      {
        key: 'B',
        text: '全体の構造・仕組みから入る',
        weights: { abstractionLevel: 0.8 },
      },
    ],
  },
  {
    id: 'speed',
    question: 'あなたが一番欲しいアドバイスは？',
    options: [
      {
        key: 'A',
        text: '「なぜ？」を深掘りしてほしい',
        weights: { decisionSpeed: 0.3 },
      },
      {
        key: 'B',
        text: '「次のアクションは何か」を即座に出してほしい',
        weights: { decisionSpeed: 0.8 },
      },
      {
        key: 'C',
        text: '「見落としているリスクは？」を先に確認したい',
        weights: { decisionSpeed: 0.4, riskTolerance: 0.2 },
      },
    ],
  },
]

export interface QuizAnswers {
  [questionId: string]: string // option key
}

export function computePersonaTraits(
  answers: QuizAnswers,
): { perspectiveType: PerspectiveType; traits: PersonaTraits } {
  let perspectiveType: PerspectiveType = 'complement'
  let riskSum = 0, riskCount = 0
  let speedSum = 0, speedCount = 0
  let abstractSum = 0, abstractCount = 0
  const stanceCounts: Record<StanceType, number> = {
    analytical: 0, intuitive: 0, critical: 0, empathetic: 0,
  }

  for (const q of QUIZ_QUESTIONS) {
    const selectedKey = answers[q.id]
    const option = q.options.find((o) => o.key === selectedKey)
    if (!option) continue

    const w = option.weights
    if (w.perspective) perspectiveType = w.perspective
    if (w.riskTolerance !== undefined) { riskSum += w.riskTolerance; riskCount++ }
    if (w.decisionSpeed !== undefined) { speedSum += w.decisionSpeed; speedCount++ }
    if (w.abstractionLevel !== undefined) { abstractSum += w.abstractionLevel; abstractCount++ }
    if (w.stance) stanceCounts[w.stance]++
  }

  const stance = (Object.entries(stanceCounts) as [StanceType, number][])
    .sort((a, b) => b[1] - a[1])[0][0]

  return {
    perspectiveType,
    traits: {
      riskTolerance: riskCount > 0 ? riskSum / riskCount : 0.5,
      decisionSpeed: speedCount > 0 ? speedSum / speedCount : 0.5,
      abstractionLevel: abstractCount > 0 ? abstractSum / abstractCount : 0.5,
      stance,
    },
  }
}
