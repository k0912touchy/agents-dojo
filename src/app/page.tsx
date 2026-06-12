'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { QUIZ_QUESTIONS, judgeType, type AgentType } from '@/lib/quiz'
import { AGENT_TYPES } from '@/lib/quiz'

export default function QuizPage() {
  const router = useRouter()
  const [step, setStep] = useState(0) // 0 = intro, 1-3 = questions
  const [answers, setAnswers] = useState<AgentType[]>([])
  const [selected, setSelected] = useState<AgentType | null>(null)
  const [transitioning, setTransitioning] = useState(false)

  const question = QUIZ_QUESTIONS[step - 1]

  function handleStart() {
    setStep(1)
  }

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
        sessionStorage.setItem('dojo_quiz_answers', JSON.stringify(newAnswers))
        sessionStorage.setItem('dojo_agent_type', agentType)
        router.push('/birth')
      }
    }, 500)
  }

  if (step === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="max-w-md w-full text-center fade-in-up">
          <div className="text-5xl mb-6">⚔️</div>
          <h1 className="text-3xl font-bold mb-2 tracking-tight">Agents DOJO</h1>
          <p className="text-sm mb-1" style={{ color: '#FFC300' }}>β版 デモ</p>
          <p className="mt-6 text-base leading-relaxed" style={{ color: '#94A3B8' }}>
            覚えてくれるAIを、自分で作る。<br />
            育てるほど、仕事が変わる。
          </p>
          <p className="mt-8 text-sm" style={{ color: '#64748B' }}>
            まず、あなたの思考タイプを診断します。<br />
            3問・約2分
          </p>
          <button
            onClick={handleStart}
            className="mt-10 w-full py-4 rounded-xl text-base font-bold tracking-wide transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: '#FFC300', color: '#0A0F2C' }}
          >
            診断スタート →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="max-w-lg w-full fade-in-up">
        {/* Progress */}
        <div className="flex gap-2 mb-10">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-1 flex-1 rounded-full transition-all duration-300"
              style={{ background: n <= step ? '#FFC300' : 'rgba(255,255,255,0.1)' }}
            />
          ))}
        </div>

        {/* Question */}
        <p className="text-xs mb-4 tracking-widest" style={{ color: '#FFC300' }}>
          Q{step} / 3
        </p>
        <h2 className="text-xl font-bold leading-relaxed mb-8 whitespace-pre-line">
          {question.question}
        </h2>

        {/* Options */}
        <div className="flex flex-col gap-3">
          {question.options.map((opt) => {
            const typeConfig = AGENT_TYPES[opt.type]
            const isSelected = selected === opt.type
            return (
              <button
                key={opt.key}
                onClick={() => handleSelect(opt.type)}
                disabled={transitioning}
                className="w-full text-left px-5 py-4 rounded-xl border transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
                style={{
                  background: isSelected ? typeConfig.bgColor : 'rgba(255,255,255,0.04)',
                  borderColor: isSelected ? typeConfig.color : 'rgba(255,255,255,0.1)',
                  color: '#F0F4FF',
                }}
              >
                <span
                  className="text-xs font-bold mr-3 px-2 py-0.5 rounded"
                  style={{
                    background: isSelected ? typeConfig.color : 'rgba(255,255,255,0.1)',
                    color: isSelected ? '#0A0F2C' : '#94A3B8',
                  }}
                >
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
