'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { AGENT_TYPES, type AgentType } from '@/lib/quiz'
import { PARAM_LABELS, saveAgent, type Agent } from '@/lib/agent'
import ParameterBar from '@/components/ParameterBar'

export default function BirthPage() {
  const router = useRouter()
  const [agentType, setAgentType] = useState<AgentType | null>(null)
  const [name, setName] = useState('')
  const [phase, setPhase] = useState<'reveal' | 'name' | 'born'>('reveal')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const type = localStorage.getItem('dojo_agent_type') as AgentType | null
    if (!type) { router.push('/'); return }
    setAgentType(type)
  }, [router])

  useEffect(() => {
    if (phase === 'name') inputRef.current?.focus()
  }, [phase])

  function handleConfirmName() {
    if (!name.trim() || !agentType) return
    const config = AGENT_TYPES[agentType]
    const agent: Agent = {
      name: name.trim(),
      type: agentType,
      params: { ...config.params },
      skills: [],
      personaTraits: [],
      totalTokens: 0,
      spentTokens: 0,
      sessionTokens: 0,
    }
    saveAgent(agent)
    setPhase('born')
    setTimeout(() => router.push('/train'), 2200)
  }

  if (!agentType) return null

  const config = AGENT_TYPES[agentType]

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full">

        {phase === 'reveal' && (
          <div className="text-center fade-in-up">
            <p className="text-xs tracking-widest mb-8" style={{ color: '#FFC300' }}>
              診断結果
            </p>
            <div
              className="w-24 h-24 rounded-2xl flex items-center justify-center text-5xl mx-auto mb-6"
              style={{ background: config.bgColor, border: `2px solid ${config.color}` }}
            >
              {config.emoji}
            </div>
            <h2 className="text-3xl font-bold mb-3" style={{ color: config.color }}>
              {config.type}
            </h2>
            <p className="text-sm leading-relaxed mb-10" style={{ color: '#94A3B8' }}>
              {config.description}
            </p>

            <div className="rounded-2xl p-5 mb-8" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-xs mb-4" style={{ color: '#64748B' }}>初期パラメーター</p>
              <ParameterBar params={config.params} accentColor={config.color} />
            </div>

            <button
              onClick={() => setPhase('name')}
              className="w-full py-4 rounded-xl font-bold text-base transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: '#FFC300', color: '#0A0F2C' }}
            >
              このエージェントを育てる →
            </button>
          </div>
        )}

        {phase === 'name' && (
          <div className="text-center fade-in-up">
            <div
              className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl mx-auto mb-6"
              style={{ background: config.bgColor }}
            >
              {config.emoji}
            </div>
            <h2 className="text-xl font-bold mb-2">エージェントに名前をつける</h2>
            <p className="text-sm mb-8" style={{ color: '#64748B' }}>
              あなたの専属AIエージェントです
            </p>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleConfirmName()}
              placeholder="例：Kai、分析くん、など"
              maxLength={20}
              className="w-full px-4 py-3 rounded-xl text-center text-lg outline-none transition-all"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: `1px solid ${name ? config.color : 'rgba(255,255,255,0.1)'}`,
                color: '#F0F4FF',
              }}
            />
            <button
              onClick={handleConfirmName}
              disabled={!name.trim()}
              className="mt-6 w-full py-4 rounded-xl font-bold text-base transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-30"
              style={{ background: '#FFC300', color: '#0A0F2C' }}
            >
              決定
            </button>
          </div>
        )}

        {phase === 'born' && (
          <div className="text-center fade-in-up">
            <div className="text-6xl mb-6 animate-bounce">{config.emoji}</div>
            <p className="text-xs tracking-widest mb-3" style={{ color: '#FFC300' }}>AGENT BORN</p>
            <h2 className="text-2xl font-bold mb-2">{name} 誕生！</h2>
            <p className="text-sm" style={{ color: config.color }}>{config.type}</p>
            <p className="mt-8 text-sm" style={{ color: '#64748B' }}>最初のセッションを始めます…</p>
          </div>
        )}

      </div>
    </div>
  )
}
