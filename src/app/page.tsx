'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { QUIZ_QUESTIONS, judgeType, AGENT_TYPES, type AgentType } from '@/lib/quiz'
import { loadAgent, type Agent } from '@/lib/agent'

type Mode = 'loading' | 'resume' | 'intro' | 'quiz'

export default function HomePage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('loading')
  const [savedAgent, setSavedAgent] = useState<Agent | null>(null)
  const [step, setStep] = useState(1)
  const [answers, setAnswers] = useState<AgentType[]>([])
  const [selected, setSelected] = useState<AgentType | null>(null)
  const [transitioning, setTransitioning] = useState(false)

  useEffect(() => {
    const a = loadAgent()
    if (a) {
      setSavedAgent(a)
      setMode('resume')
    } else {
      setMode('intro')
    }
  }, [])

  function handleSelect(type: AgentType) {
    if (transitioning) return
    setSelected(type)
    setTransitioning(true)
    setTimeout(() => {
      const newAnswers = [...answers, type]
      if (step < 3) {
        setAnswers(newAnswers)
        setSelected(null)
        setTransitioning(false)
        setStep(step + 1)
      } else {
        const agentType = judgeType(newAnswers)
        localStorage.setItem('dojo_quiz_answers', JSON.stringify(newAnswers))
        localStorage.setItem('dojo_agent_type', agentType)
        router.push('/birth')
      }
    }, 500)
  }

  function startNew() {
    localStorage.removeItem('dojo_agent')
    setSavedAgent(null)
    setMode('intro')
  }

  if (mode === 'loading') return null

  // Returning user: saved agent exists
  if (mode === 'resume' && savedAgent) {
    const config = AGENT_TYPES[savedAgent.type]
    const progress = Math.min((savedAgent.totalTokens / 5000) * 100, 100)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="max-w-md w-full fade-in-up">
          <p className="text-xs tracking-widest mb-6 text-center" style={{ color: '#FFC300' }}>おかえり</p>

          {/* Agent card */}
          <div
            className="rounded-2xl p-6 mb-6 cursor-pointer transition-all hover:scale-[1.01]"
            style={{ background: config.bgColor, border: `1px solid ${config.color}` }}
            onClick={() => router.push('/agent')}
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="text-4xl">{config.emoji}</div>
              <div>
                <h2 className="text-xl font-bold">{savedAgent.name}</h2>
                <p className="text-sm" style={{ color: config.color }}>{savedAgent.type}</p>
              </div>
            </div>

            <div className="flex gap-4 mb-4 text-sm">
              <div>
                <p className="text-xs mb-0.5" style={{ color: '#64748B' }}>スキル</p>
                <p className="font-bold">{savedAgent.skills.length} 個</p>
              </div>
              <div>
                <p className="text-xs mb-0.5" style={{ color: '#64748B' }}>行動特性</p>
                <p className="font-bold">{(savedAgent.personaTraits ?? []).length} 件</p>
              </div>
              <div>
                <p className="text-xs mb-0.5" style={{ color: '#64748B' }}>累計tokens</p>
                <p className="font-bold">{savedAgent.totalTokens.toLocaleString()}</p>
              </div>
            </div>

            {/* Progress */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span style={{ color: '#64748B' }}>誕生まで</span>
                <span style={{ color: '#FFC300' }}>
                  {savedAgent.totalTokens >= 5000
                    ? '誕生済み 🎉'
                    : `${Math.round(progress)}%`}
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div className="h-full rounded-full" style={{ width: `${progress}%`, background: '#FFC300' }} />
              </div>
            </div>

            <p className="text-xs mt-3" style={{ color: '#4A5568' }}>タップして詳細を見る →</p>
          </div>

          <button
            onClick={() => router.push('/train')}
            className="w-full py-4 rounded-xl font-bold text-base transition-all hover:scale-[1.02] mb-3"
            style={{ background: '#FFC300', color: '#0A0F2C' }}
          >
            続きを教え込む →
          </button>
          <button
            onClick={startNew}
            className="w-full py-3 rounded-xl text-sm transition-all hover:opacity-70"
            style={{ border: '1px solid rgba(255,255,255,0.1)', color: '#64748B' }}
          >
            新しいエージェントを作る
          </button>
        </div>
      </div>
    )
  }

  // Intro screen
  if (mode === 'intro') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="max-w-md w-full text-center fade-in-up">
          <div className="text-5xl mb-6">⚔️</div>
          <h1 className="text-3xl font-bold mb-2 tracking-tight">Agents DOJO</h1>
          <p className="text-sm mb-1" style={{ color: '#FFC300' }}>β版 デモ</p>
          <p className="mt-6 text-base leading-relaxed" style={{ color: '#94A3B8' }}>
            覚えてくれるAIを、自分で作る。<br />育てるほど、仕事が変わる。
          </p>
          <p className="mt-8 text-sm" style={{ color: '#64748B' }}>
            まず、あなたの思考タイプを診断します。<br />3問・約2分
          </p>
          <button
            onClick={() => setMode('quiz')}
            className="mt-10 w-full py-4 rounded-xl text-base font-bold tracking-wide transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: '#FFC300', color: '#0A0F2C' }}
          >
            診断スタート →
          </button>
        </div>
      </div>
    )
  }

  // Quiz
  const question = QUIZ_QUESTIONS[step - 1]
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="max-w-lg w-full fade-in-up">
        <div className="flex gap-2 mb-10">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-1 flex-1 rounded-full transition-all duration-300"
              style={{ background: n <= step ? '#FFC300' : 'rgba(255,255,255,0.1)' }} />
          ))}
        </div>
        <p className="text-xs mb-4 tracking-widest" style={{ color: '#FFC300' }}>Q{step} / 3</p>
        <h2 className="text-xl font-bold leading-relaxed mb-8 whitespace-pre-line">{question.question}</h2>
        <div className="flex flex-col gap-3">
          {question.options.map((opt) => {
            const typeConfig = AGENT_TYPES[opt.type]
            const isSelected = selected === opt.type
            return (
              <button
                key={opt.key}
                onClick={() => handleSelect(opt.type)}
                disabled={transitioning}
                className="w-full text-left px-5 py-4 rounded-xl border transition-all hover:scale-[1.01]"
                style={{
                  background: isSelected ? typeConfig.bgColor : 'rgba(255,255,255,0.04)',
                  borderColor: isSelected ? typeConfig.color : 'rgba(255,255,255,0.1)',
                  color: '#F0F4FF',
                }}
              >
                <span className="text-xs font-bold mr-3 px-2 py-0.5 rounded"
                  style={{ background: isSelected ? typeConfig.color : 'rgba(255,255,255,0.1)', color: isSelected ? '#0A0F2C' : '#94A3B8' }}>
                  {opt.key}
                </span>
                {opt.text}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
