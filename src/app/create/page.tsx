'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { QUIZ_QUESTIONS, computePersonaTraits, type QuizAnswers } from '@/lib/persona-quiz'
import { PERSPECTIVE_META, STANCE_LABEL, type Persona } from '@/lib/dojo'
import { createNewAgent, saveAgent } from '@/lib/storage'

type Phase = 'quiz' | 'generating' | 'reveal' | 'name' | 'done'

export default function CreatePage() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('quiz')
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<QuizAnswers>({})
  const [persona, setPersona] = useState<Persona | null>(null)
  const [name, setName] = useState('')

  async function handleAnswer(optionKey: string) {
    const q = QUIZ_QUESTIONS[step]
    const newAnswers = { ...answers, [q.id]: optionKey }
    setAnswers(newAnswers)

    if (step < QUIZ_QUESTIONS.length - 1) {
      setStep(step + 1)
      return
    }

    // All questions answered — generate persona
    setPhase('generating')
    const computed = computePersonaTraits(newAnswers)

    try {
      const res = await fetch('/api/persona/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...computed, quizAnswers: newAnswers }),
      })
      const { description } = await res.json()
      setPersona({ ...computed, description, quizAnswers: newAnswers })
    } catch {
      setPersona({
        ...computed,
        description: 'このエージェントは独自の思考回路を持ち、あなたの判断を支える。',
        quizAnswers: newAnswers,
      })
    }
    setPhase('reveal')
  }

  function handleConfirmName() {
    if (!name.trim() || !persona) return
    const agent = createNewAgent(name.trim(), persona)
    saveAgent(agent)
    setPhase('done')
    setTimeout(() => router.push('/agent'), 1800)
  }

  const progress = ((step) / QUIZ_QUESTIONS.length) * 100

  // --- Quiz phase ---
  if (phase === 'quiz') {
    const q = QUIZ_QUESTIONS[step]
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="max-w-lg w-full fade-in-up">
          {/* Progress */}
          <div className="flex gap-1.5 mb-10">
            {QUIZ_QUESTIONS.map((_, i) => (
              <div key={i} className="h-1 flex-1 rounded-full transition-all duration-300"
                style={{ background: i < step ? 'var(--accent)' : i === step ? 'var(--accent)' : 'var(--border-default)' }} />
            ))}
          </div>

          <p className="text-xs mb-4 tracking-widest" style={{ color: 'var(--accent)' }}>
            Q{step + 1} / {QUIZ_QUESTIONS.length}
          </p>
          <h2 className="text-xl font-bold leading-relaxed mb-8">{q.question}</h2>

          <div className="flex flex-col gap-3">
            {q.options.map((opt) => (
              <button
                key={opt.key}
                onClick={() => handleAnswer(opt.key)}
                className="w-full text-left px-5 py-4 rounded-xl border transition-all hover:scale-[1.01] active:scale-[0.98]"
                style={{
                  background: 'var(--bg-surface)',
                  borderColor: 'var(--border-default)',
                }}
              >
                <span className="text-xs font-bold mr-3 px-2 py-0.5 rounded"
                  style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)', border: '1px solid var(--border-default)' }}>
                  {opt.key}
                </span>
                {opt.text}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // --- Generating phase ---
  if (phase === 'generating') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="text-center fade-in-up">
          <div className="text-4xl mb-6 animate-pulse">⚙️</div>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>人格を生成しています...</p>
        </div>
      </div>
    )
  }

  // --- Reveal phase ---
  if (phase === 'reveal' && persona) {
    const pm = PERSPECTIVE_META[persona.perspectiveType]
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="max-w-md w-full fade-in-up">
          <p className="text-xs tracking-widest text-center mb-8" style={{ color: 'var(--accent)' }}>
            人格の設計が完了しました
          </p>

          {/* Perspective type badge */}
          <div className="text-center mb-6">
            <div className="text-5xl mb-3">{pm.icon}</div>
            <span
              className="text-base font-bold px-4 py-1.5 rounded-full"
              style={{ background: pm.bg, color: pm.color, border: `1px solid ${pm.color}44` }}
            >
              {pm.label}
            </span>
            <p className="text-sm mt-3" style={{ color: 'var(--text-secondary)' }}>{pm.description}</p>
          </div>

          {/* Persona description */}
          <div className="rounded-xl p-5 mb-5"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
            <p className="text-xs font-bold mb-3" style={{ color: 'var(--text-muted)' }}>思考の特性</p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {persona.description}
            </p>
          </div>

          {/* Trait bars */}
          <div className="rounded-xl p-5 mb-8"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
            <p className="text-xs font-bold mb-4" style={{ color: 'var(--text-muted)' }}>パラメーター</p>
            {[
              { label: 'リスク許容度', value: persona.traits.riskTolerance, left: '低', right: '高' },
              { label: '意思決定スピード', value: persona.traits.decisionSpeed, left: '熟考', right: '即断' },
              { label: '思考の視座', value: persona.traits.abstractionLevel, left: '実務', right: '戦略' },
            ].map(({ label, value, left, right }) => (
              <div key={label} className="mb-3 last:mb-0">
                <div className="flex justify-between text-xs mb-1">
                  <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{STANCE_LABEL[persona.traits.stance]}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs w-6" style={{ color: 'var(--text-faint)' }}>{left}</span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--border-default)' }}>
                    <div className="h-full rounded-full bar-grow"
                      style={{ width: `${value * 100}%`, background: pm.color, '--bar-width': `${value * 100}%` } as React.CSSProperties} />
                  </div>
                  <span className="text-xs w-6 text-right" style={{ color: 'var(--text-faint)' }}>{right}</span>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => setPhase('name')}
            className="w-full py-4 rounded-xl font-bold text-base transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: 'var(--accent)', color: 'var(--accent-on)' }}
          >
            名前をつける →
          </button>
        </div>
      </div>
    )
  }

  // --- Name phase ---
  if (phase === 'name' && persona) {
    const pm = PERSPECTIVE_META[persona.perspectiveType]
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="max-w-md w-full fade-in-up">
          <p className="text-xs tracking-widest text-center mb-8" style={{ color: 'var(--accent)' }}>
            名前をつける
          </p>
          <div className="text-center mb-8">
            <div className="text-4xl mb-3">{pm.icon}</div>
            <p className="text-sm" style={{ color: pm.color }}>{pm.label}</p>
          </div>

          <input
            autoFocus
            type="text"
            placeholder="エージェントの名前"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleConfirmName()}
            maxLength={20}
            className="w-full px-5 py-4 rounded-xl text-lg font-bold text-center outline-none mb-6"
            style={{
              background: 'var(--bg-surface)',
              border: `1px solid ${name ? 'var(--accent)' : 'var(--border-default)'}`,
              color: 'var(--text-primary)',
            }}
          />

          <button
            onClick={handleConfirmName}
            disabled={!name.trim()}
            className="w-full py-4 rounded-xl font-bold text-base transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40"
            style={{ background: 'var(--accent)', color: 'var(--accent-on)' }}
          >
            エージェントを生み出す
          </button>
        </div>
      </div>
    )
  }

  // --- Done phase ---
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="text-center fade-in-up">
        <div className="text-5xl mb-4">✨</div>
        <p className="text-xl font-bold mb-2">{name} が誕生しました</p>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>知識と経験を与えに行く...</p>
      </div>
    </div>
  )
}
