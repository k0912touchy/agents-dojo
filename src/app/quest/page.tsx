'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AGENT_TYPES } from '@/lib/quiz'
import {
  loadAgent, saveAgent, saveDetectedTrait,
  type Agent, type SkillSeed, type DetectedTrait,
} from '@/lib/agent'

type Phase =
  | 'select'       // 難易度選択
  | 'generating'   // シナリオ生成中
  | 'scenario'     // シナリオ表示 + エージェント回答生成
  | 'responding'   // エージェント回答ストリーミング
  | 'feedback'     // ユーザーフィードバック
  | 'evaluating'   // 評価中
  | 'result'       // 結果表示

const FEEDBACK_TAGS = ['核心をついた', '惜しい', '想定外の切り口', '教え方が足りない', '完璧だった', '別の視点も欲しい']

const DIFFICULTY_CONFIG = {
  1: { label: '通常', stars: '★☆☆', color: '#48BB78', bg: 'rgba(72,187,120,0.08)', border: 'rgba(72,187,120,0.25)', tokenCost: 300, desc: '習得済みスキルを素直に使う問題' },
  2: { label: '難関', stars: '★★☆', color: '#FFC300', bg: 'rgba(255,195,0,0.08)', border: 'rgba(255,195,0,0.25)', tokenCost: 600, desc: '複数スキルの組み合わせが必要' },
  3: { label: '上級', stars: '★★★', color: '#F97316', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.25)', tokenCost: 1000, desc: '想定外の状況・スキルの応用力が試される' },
} as const

interface QuestData {
  title: string
  scenario: string
  hint: string
  tokenCost: number
  difficulty: 1 | 2 | 3
}

interface EvalResult {
  outcome: 'success' | 'partial' | 'failure'
  outcomeReason: string
  skillSeeds: { title: string; summary: string; relatedSkillName?: string }[]
  skillUpdates: { skillName: string; reason: string }[]
  newPersonaTrait: { label: string; description: string } | null
}

export default function QuestPage() {
  const router = useRouter()
  const [agent, setAgent] = useState<Agent | null>(null)
  const [phase, setPhase] = useState<Phase>('select')
  const [difficulty, setDifficulty] = useState<1 | 2 | 3>(1)
  const [quest, setQuest] = useState<QuestData | null>(null)
  const [agentResponse, setAgentResponse] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [feedbackNote, setFeedbackNote] = useState('')
  const [evalResult, setEvalResult] = useState<EvalResult | null>(null)
  const [confirmedSeeds, setConfirmedSeeds] = useState<boolean[]>([])
  const [confirmedUpdate, setConfirmedUpdate] = useState(true)
  const [confirmedTrait, setConfirmedTrait] = useState(true)
  const agentRef = useRef<Agent | null>(null)

  useEffect(() => {
    const a = loadAgent()
    if (!a) { router.push('/'); return }
    if (!a.personaTraits) a.personaTraits = []
    agentRef.current = a
    setAgent(a)
  }, [router])

  async function handleStartQuest() {
    if (!agentRef.current) return
    const a = agentRef.current
    const diff = DIFFICULTY_CONFIG[difficulty]

    if (a.totalTokens < diff.tokenCost) return
    setPhase('generating')

    try {
      const res = await fetch('/api/quest/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentType: a.type,
          agentName: a.name,
          skills: a.skills.map((s) => ({ name: s.name, description: s.description })),
          difficulty,
        }),
      })
      const data = await res.json()
      setQuest({ ...data, difficulty })
      setPhase('scenario')

      // エージェントの回答を生成（ストリーミング）
      setPhase('responding')
      await generateAgentResponse(a, { ...data, difficulty })
    } catch {
      setPhase('select')
    }
  }

  async function generateAgentResponse(a: Agent, q: QuestData) {
    const config = AGENT_TYPES[a.type]
    setAgentResponse('')

    const skillContext = a.skills
      .map((s) => `【${s.name}】${s.description}`)
      .join('\n')

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: q.scenario }],
          agentType: a.type,
          agentName: a.name,
          category: 'クエスト',
          topic: q.title,
          refContent: `あなたはクエストに挑戦しています。以下のスキルを活かして回答してください。\n${skillContext}\n\nヒント：${q.hint}`,
        }),
      })

      if (!res.body) throw new Error('no body')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let content = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        content += decoder.decode(value, { stream: true })
        setAgentResponse(content)
      }

      // トークンを消費
      const tokens = q.tokenCost
      const updated: Agent = {
        ...a,
        totalTokens: Math.max(0, a.totalTokens - tokens),
        sessionTokens: a.sessionTokens,
      }
      agentRef.current = updated
      setAgent(updated)
      saveAgent(updated)

      setPhase('feedback')
    } catch {
      setAgentResponse('回答の生成に失敗しました。')
      setPhase('feedback')
    }
  }

  async function handleSubmitFeedback() {
    if (!agentRef.current || !quest) return
    const a = agentRef.current
    setPhase('evaluating')

    try {
      const res = await fetch('/api/quest/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentType: a.type,
          agentName: a.name,
          scenario: quest.scenario,
          agentResponse,
          userFeedback: { tags: selectedTags, note: feedbackNote || undefined },
          skills: a.skills.map((s) => ({ name: s.name, description: s.description })),
        }),
      })
      const result: EvalResult = await res.json()
      setEvalResult(result)
      setConfirmedSeeds(result.skillSeeds.map(() => true))
      setConfirmedTrait(!!result.newPersonaTrait)
      setPhase('result')
    } catch {
      setPhase('feedback')
    }
  }

  function handleConfirmResult() {
    if (!agentRef.current || !evalResult || !quest) return
    const a = agentRef.current

    const newSeeds: SkillSeed[] = evalResult.skillSeeds
      .filter((_, i) => confirmedSeeds[i])
      .map((s) => ({
        id: `seed-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        title: s.title,
        summary: s.summary,
        relatedSkillName: s.relatedSkillName,
        fromQuestTitle: quest.title,
        discoveredAt: new Date().toISOString(),
      }))

    const newTraits = [...a.personaTraits]
    if (confirmedTrait && evalResult.newPersonaTrait) {
      const t = evalResult.newPersonaTrait
      const detected: DetectedTrait = { label: t.label, description: t.description, detectedAt: new Date().toISOString() }
      saveDetectedTrait(detected)
      if (!newTraits.includes(t.label)) newTraits.push(t.label)
    }

    const updated: Agent = {
      ...a,
      personaTraits: newTraits,
      skillSeeds: [...(a.skillSeeds ?? []), ...newSeeds],
    }
    agentRef.current = updated
    setAgent(updated)
    saveAgent(updated)

    router.push('/agent')
  }

  if (!agent) return null
  const config = AGENT_TYPES[agent.type]

  const OUTCOME_STYLE = {
    success: { label: 'SUCCESS', color: '#48BB78', bg: 'rgba(72,187,120,0.1)' },
    partial: { label: 'PARTIAL', color: '#FFC300', bg: 'rgba(255,195,0,0.1)' },
    failure: { label: 'FAILURE', color: '#FC8181', bg: 'rgba(252,129,129,0.1)' },
  }

  return (
    <div className="min-h-screen flex flex-col max-w-lg mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => phase === 'select' ? router.back() : setPhase('select')} className="text-xs" style={{ color: '#64748B' }}>← 戻る</button>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0" style={{ background: config.bgColor }}>
            {config.emoji}
          </div>
          <span className="text-sm font-bold">{agent.name}</span>
          <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(255,195,0,0.15)', color: '#FFC300' }}>
            {agent.totalTokens.toLocaleString()} tokens
          </span>
        </div>
      </div>

      {/* === 難易度選択 === */}
      {phase === 'select' && (
        <div className="fade-in-up flex flex-col flex-1">
          <p className="text-xs tracking-widest mb-2" style={{ color: '#FFC300' }}>QUEST</p>
          <h1 className="text-2xl font-bold mb-1">クエストに挑む</h1>
          <p className="text-sm mb-6" style={{ color: '#64748B' }}>
            エージェントの実力を試す。トークンを消費して挑戦。
          </p>

          {agent.skills.length === 0 && (
            <div className="rounded-xl p-4 mb-6 text-sm" style={{ background: 'rgba(252,129,129,0.08)', border: '1px solid rgba(252,129,129,0.2)', color: '#FC8181' }}>
              スキルがまだありません。先に教え込みセッションを行ってください。
            </div>
          )}

          <div className="flex flex-col gap-3 mb-6">
            {([1, 2, 3] as const).map((d) => {
              const dc = DIFFICULTY_CONFIG[d]
              const canAfford = agent.totalTokens >= dc.tokenCost
              return (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  disabled={!canAfford}
                  className="w-full text-left p-4 rounded-xl transition-all"
                  style={{
                    background: difficulty === d ? dc.bg : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${difficulty === d ? dc.border : 'rgba(255,255,255,0.08)'}`,
                    opacity: canAfford ? 1 : 0.4,
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base tracking-tight" style={{ color: dc.color }}>{dc.stars}</span>
                      <span className="font-bold text-sm">{dc.label}</span>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.08)', color: canAfford ? '#94A3B8' : '#FC8181' }}>
                      {dc.tokenCost.toLocaleString()} tokens
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: '#64748B' }}>{dc.desc}</p>
                </button>
              )
            })}
          </div>

          <button
            onClick={handleStartQuest}
            disabled={agent.skills.length === 0 || agent.totalTokens < DIFFICULTY_CONFIG[difficulty].tokenCost}
            className="w-full py-4 rounded-xl font-bold text-base disabled:opacity-30 transition-all hover:scale-[1.02]"
            style={{ background: '#FFC300', color: '#0A0F2C' }}
          >
            クエスト開始 → （{DIFFICULTY_CONFIG[difficulty].tokenCost.toLocaleString()} tokens消費）
          </button>
        </div>
      )}

      {/* === 生成中 === */}
      {(phase === 'generating') && (
        <div className="flex-1 flex flex-col items-center justify-center text-center fade-in-up">
          <div className="text-5xl mb-4 animate-pulse">{config.emoji}</div>
          <p className="text-sm" style={{ color: '#94A3B8' }}>クエストを準備中…</p>
        </div>
      )}

      {/* === シナリオ + エージェント回答 === */}
      {(phase === 'scenario' || phase === 'responding' || phase === 'feedback') && quest && (
        <div className="flex-1 flex flex-col fade-in-up">
          {/* Quest header */}
          <div className="rounded-xl p-4 mb-4" style={{ background: DIFFICULTY_CONFIG[quest.difficulty].bg, border: `1px solid ${DIFFICULTY_CONFIG[quest.difficulty].border}` }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold tracking-widest" style={{ color: DIFFICULTY_CONFIG[quest.difficulty].color }}>
                {DIFFICULTY_CONFIG[quest.difficulty].stars} {DIFFICULTY_CONFIG[quest.difficulty].label}
              </span>
            </div>
            <h2 className="font-bold text-base mb-2">{quest.title}</h2>
            <p className="text-sm leading-relaxed" style={{ color: '#D1D5DB' }}>{quest.scenario}</p>
            <p className="text-xs mt-2 px-2 py-1 rounded inline-block" style={{ background: 'rgba(255,255,255,0.06)', color: '#64748B' }}>
              💡 {quest.hint}
            </p>
          </div>

          {/* Agent response */}
          <div className="flex gap-3 mb-4">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0 mt-1" style={{ background: config.bgColor }}>
              {config.emoji}
            </div>
            <div className="flex-1 rounded-2xl rounded-tl-none px-4 py-3 text-sm leading-relaxed" style={{ background: 'rgba(255,255,255,0.06)' }}>
              {phase === 'responding' && !agentResponse
                ? <span style={{ color: '#64748B' }}>考え中…</span>
                : <span className="whitespace-pre-wrap">{agentResponse}</span>
              }
            </div>
          </div>

          {/* Feedback section */}
          {phase === 'feedback' && (
            <div className="flex-1 flex flex-col">
              <p className="text-xs font-bold mb-3" style={{ color: '#64748B' }}>この回答をどう評価する？</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {FEEDBACK_TAGS.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setSelectedTags((prev) =>
                      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
                    )}
                    className="px-3 py-1.5 rounded-full text-xs transition-all"
                    style={{
                      background: selectedTags.includes(tag) ? 'rgba(255,195,0,0.2)' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${selectedTags.includes(tag) ? 'rgba(255,195,0,0.5)' : 'rgba(255,255,255,0.1)'}`,
                      color: selectedTags.includes(tag) ? '#FFC300' : '#64748B',
                    }}
                  >
                    {tag}
                  </button>
                ))}
              </div>
              <textarea
                value={feedbackNote}
                onChange={(e) => setFeedbackNote(e.target.value)}
                placeholder="補足コメント（任意）"
                rows={2}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none mb-4"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#F0F4FF' }}
              />
              <button
                onClick={handleSubmitFeedback}
                className="w-full py-4 rounded-xl font-bold text-base transition-all hover:scale-[1.02]"
                style={{ background: '#FFC300', color: '#0A0F2C' }}
              >
                結果を見る →
              </button>
            </div>
          )}
        </div>
      )}

      {/* === 評価中 === */}
      {phase === 'evaluating' && (
        <div className="flex-1 flex flex-col items-center justify-center text-center fade-in-up">
          <div className="text-5xl mb-4 animate-pulse">{config.emoji}</div>
          <p className="text-sm" style={{ color: '#94A3B8' }}>クエストを評価中…</p>
          <p className="text-xs mt-2" style={{ color: '#64748B' }}>スキルの種を探しています</p>
        </div>
      )}

      {/* === 結果 === */}
      {phase === 'result' && evalResult && quest && (
        <div className="flex-1 flex flex-col fade-in-up">
          {/* Outcome */}
          <div className="text-center mb-5">
            <p className="text-xs tracking-widest mb-2" style={{ color: '#64748B' }}>QUEST RESULT</p>
            <div className="inline-block px-4 py-1.5 rounded-full mb-3"
              style={{ background: OUTCOME_STYLE[evalResult.outcome].bg, border: `1px solid ${OUTCOME_STYLE[evalResult.outcome].color}44` }}>
              <span className="text-sm font-black tracking-widest" style={{ color: OUTCOME_STYLE[evalResult.outcome].color }}>
                {OUTCOME_STYLE[evalResult.outcome].label}
              </span>
            </div>
            <p className="text-sm" style={{ color: '#94A3B8' }}>{evalResult.outcomeReason}</p>
          </div>

          {/* Skill seeds */}
          {evalResult.skillSeeds.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-bold mb-3" style={{ color: '#64748B' }}>💡 スキルの種</p>
              {evalResult.skillSeeds.map((seed, i) => (
                <div
                  key={i}
                  className="rounded-xl px-4 py-3 mb-2 flex items-start gap-3"
                  style={{ background: 'rgba(255,195,0,0.06)', border: `1px solid ${confirmedSeeds[i] ? 'rgba(255,195,0,0.3)' : 'rgba(255,255,255,0.08)'}` }}
                >
                  <div className="flex-1">
                    <p className="text-sm font-bold mb-0.5" style={{ color: '#FFC300' }}>{seed.title}</p>
                    <p className="text-xs" style={{ color: '#64748B' }}>{seed.summary}</p>
                    {seed.relatedSkillName && (
                      <p className="text-xs mt-1" style={{ color: '#4A5568' }}>→ {seed.relatedSkillName} と関連</p>
                    )}
                  </div>
                  <button
                    onClick={() => setConfirmedSeeds((prev) => prev.map((v, j) => j === i ? !v : v))}
                    className="text-xs px-2 py-1 rounded-lg shrink-0"
                    style={{
                      background: confirmedSeeds[i] ? 'rgba(255,195,0,0.2)' : 'rgba(255,255,255,0.05)',
                      color: confirmedSeeds[i] ? '#FFC300' : '#4A5568',
                    }}
                  >
                    {confirmedSeeds[i] ? '受け取る ✓' : '見送る'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Skill update */}
          {evalResult.skillUpdates.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-bold mb-3" style={{ color: '#64748B' }}>📈 スキル深化</p>
              {evalResult.skillUpdates.map((u, i) => (
                <div key={i} className="rounded-xl px-4 py-3 mb-2 flex items-center justify-between"
                  style={{ background: 'rgba(72,187,120,0.06)', border: `1px solid ${confirmedUpdate ? 'rgba(72,187,120,0.3)' : 'rgba(255,255,255,0.08)'}` }}>
                  <div>
                    <p className="text-sm font-bold" style={{ color: '#48BB78' }}>{u.skillName}</p>
                    <p className="text-xs" style={{ color: '#64748B' }}>{u.reason}</p>
                  </div>
                  <button
                    onClick={() => setConfirmedUpdate((v) => !v)}
                    className="text-xs px-2 py-1 rounded-lg shrink-0"
                    style={{
                      background: confirmedUpdate ? 'rgba(72,187,120,0.2)' : 'rgba(255,255,255,0.05)',
                      color: confirmedUpdate ? '#48BB78' : '#4A5568',
                    }}
                  >
                    {confirmedUpdate ? '記録する ✓' : '見送る'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* New trait */}
          {evalResult.newPersonaTrait && (
            <div className="mb-4">
              <p className="text-xs font-bold mb-3" style={{ color: '#64748B' }}>🧬 行動特性の発現</p>
              <div className="rounded-xl px-4 py-3 flex items-center justify-between"
                style={{ background: 'rgba(99,102,241,0.06)', border: `1px solid ${confirmedTrait ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.08)'}` }}>
                <div>
                  <p className="text-sm font-bold" style={{ color: '#818CF8' }}>{evalResult.newPersonaTrait.label}</p>
                  <p className="text-xs" style={{ color: '#64748B' }}>{evalResult.newPersonaTrait.description}</p>
                </div>
                <button
                  onClick={() => setConfirmedTrait((v) => !v)}
                  className="text-xs px-2 py-1 rounded-lg shrink-0"
                  style={{
                    background: confirmedTrait ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)',
                    color: confirmedTrait ? '#818CF8' : '#4A5568',
                  }}
                >
                  {confirmedTrait ? '付与する ✓' : '見送る'}
                </button>
              </div>
            </div>
          )}

          {evalResult.skillSeeds.length === 0 && evalResult.skillUpdates.length === 0 && !evalResult.newPersonaTrait && (
            <div className="rounded-xl px-4 py-3 mb-4 text-sm" style={{ background: 'rgba(255,255,255,0.03)', color: '#64748B' }}>
              今回は新たなスキルの種は見つかりませんでした。教え込みを続けるとエージェントが成長します。
            </div>
          )}

          <div className="flex gap-2 mt-auto">
            <button
              onClick={() => { setPhase('select'); setQuest(null); setAgentResponse(''); setSelectedTags([]); setFeedbackNote(''); setEvalResult(null) }}
              className="flex-1 py-3 rounded-xl text-sm"
              style={{ border: '1px solid rgba(255,255,255,0.1)', color: '#64748B' }}
            >
              もう一度挑戦
            </button>
            <button
              onClick={handleConfirmResult}
              className="flex-1 py-4 rounded-xl font-bold text-sm transition-all hover:scale-[1.02]"
              style={{ background: '#FFC300', color: '#0A0F2C' }}
            >
              確定してエージェントへ →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
