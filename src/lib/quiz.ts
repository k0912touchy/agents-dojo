export type AgentType = '先読み型' | '設計型' | '突破型' | '共鳴型'

export interface QuizQuestion {
  id: number
  question: string
  options: { key: string; text: string; type: AgentType }[]
}

export interface AgentTypeConfig {
  type: AgentType
  color: string
  bgColor: string
  emoji: string
  description: string
  firstLine: string
  params: {
    expertise: number
    empathy: number
    analysis: number
    execution: number
    creativity: number
  }
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    question: '会議でチームが行き詰まっている。\nあなたが思わず口に出すのは？',
    options: [
      { key: 'A', text: '「まず全体像を整理しよう」', type: '先読み型' },
      { key: 'B', text: '「こう進めれば突破できる」', type: '設計型' },
      { key: 'C', text: '「一旦やってみようよ」', type: '突破型' },
      { key: 'D', text: '「みんなどう感じてる？」', type: '共鳴型' },
    ],
  },
  {
    id: 2,
    question: '締め切り1時間前。まだアイデアが出ない。\nどうする？',
    options: [
      { key: 'A', text: '今ある情報で最善案を出す', type: '先読み型' },
      { key: 'B', text: '問題を分解して優先順位を決める', type: '設計型' },
      { key: 'C', text: 'とにかく手を動かし始める', type: '突破型' },
      { key: 'D', text: '誰かに相談して壁打ちする', type: '共鳴型' },
    ],
  },
  {
    id: 3,
    question: '理想の1日の終わり方は？',
    options: [
      { key: 'A', text: 'やるべきことが全部整理できている', type: '先読み型' },
      { key: 'B', text: '明日の計画が完璧に立てられた', type: '設計型' },
      { key: 'C', text: '今日やろうとしたことを全部やり切った', type: '突破型' },
      { key: 'D', text: '誰かと深い話ができた', type: '共鳴型' },
    ],
  },
]

export const AGENT_TYPES: Record<AgentType, AgentTypeConfig> = {
  先読み型: {
    type: '先読み型',
    color: '#818CF8',
    bgColor: 'rgba(129, 140, 248, 0.15)',
    emoji: '🔍',
    description: 'パターンを読み、先を見通す。情報を整理して最適解を導く思考家。',
    firstLine: 'よし、まず状況を整理しよう。何から始めるか、一緒に考えよう。',
    params: { expertise: 15, empathy: 10, analysis: 22, execution: 12, creativity: 12 },
  },
  設計型: {
    type: '設計型',
    color: '#A78BFA',
    bgColor: 'rgba(167, 139, 250, 0.15)',
    emoji: '📐',
    description: '構造を作り、着実に前進する。どんな問題も設計すれば解ける。',
    firstLine: '最初に全体の構造を作ろう。分解すれば、どんな問題も解ける。',
    params: { expertise: 12, empathy: 10, analysis: 18, execution: 22, creativity: 10 },
  },
  突破型: {
    type: '突破型',
    color: '#FFC300',
    bgColor: 'rgba(255, 195, 0, 0.15)',
    emoji: '⚡',
    description: '動くことで道を開く。エネルギーと行動力で壁をぶち破る実行者。',
    firstLine: '行動あるのみ！まずやってみよう。考えすぎは禁物だよ。',
    params: { expertise: 10, empathy: 12, analysis: 10, execution: 22, creativity: 18 },
  },
  共鳴型: {
    type: '共鳴型',
    color: '#48BB78',
    bgColor: 'rgba(72, 187, 120, 0.15)',
    emoji: '🌱',
    description: '人の感情を感じ取り、つながりを生む。深い対話で本質を引き出す。',
    firstLine: 'あなたのこと、もっと知りたい。どんなことで悩んでいる？',
    params: { expertise: 10, empathy: 22, analysis: 10, execution: 12, creativity: 18 },
  },
}

export function judgeType(answers: AgentType[]): AgentType {
  const counts: Record<AgentType, number> = {
    先読み型: 0,
    設計型: 0,
    突破型: 0,
    共鳴型: 0,
  }
  answers.forEach((a) => counts[a]++)
  const max = Math.max(...Object.values(counts))
  // tie-break: first answer wins
  const tied = (Object.keys(counts) as AgentType[]).filter((k) => counts[k] === max)
  if (tied.length === 1) return tied[0]
  return answers[0] // first answer type wins on tie
}
