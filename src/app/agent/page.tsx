'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AGENT_TYPES } from '@/lib/quiz'
import { loadAgent, PARAM_LABELS, BIRTH_THRESHOLD, type Agent } from '@/lib/agent'
import ParameterBar from '@/components/ParameterBar'

export default function AgentPage() {
  const router = useRouter()
  const [agent, setAgent] = useState<Agent | null>(null)

  useEffect(() => {
    const a = loadAgent()
    if (!a) { router.push('/'); return }
    if (!a.personaTraits) a.personaTraits = []
    setAgent(a)
  }, [router])

  if (!agent) return null
  const config = AGENT_TYPES[agent.type]
  const progress = Math.min((agent.totalTokens / BIRTH_THRESHOLD) * 100, 100)
  const isBorn = agent.totalTokens >= BIRTH_THRESHOLD

  return (
    <div className="min-h-screen max-w-lg mx-auto px-4 py-6">
      {/* Back */}
      <button onClick={() => router.back()} className="flex items-center gap-1 text-xs mb-6" style={{ color: '#64748B' }}>
        ← 戻る
      </button>

      {/* Agent identity */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-4xl shrink-0" style={{ background: config.bgColor, border: `2px solid ${config.color}` }}>
          {config.emoji}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{agent.name}</h1>
          <p className="text-sm" style={{ color: config.color }}>{agent.type}</p>
          <p className="text-xs mt-1" style={{ color: '#64748B' }}>累計 {agent.totalTokens.toLocaleString()} tokens</p>
        </div>
      </div>

      {/* Birth progress */}
      <div className="rounded-xl p-4 mb-5" style={{ background: 'rgba(255,195,0,0.08)', border: '1px solid rgba(255,195,0,0.15)' }}>
        <div className="flex justify-between text-xs mb-2">
          <span style={{ color: '#FFC300' }}>誕生まで</span>
          <span style={{ color: '#FFC300' }}>
            {isBorn ? '誕生済み 🎉' : `${agent.totalTokens.toLocaleString()} / ${BIRTH_THRESHOLD.toLocaleString()} tokens`}
          </span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${progress}%`, background: '#FFC300' }} />
        </div>
      </div>

      {/* Parameters */}
      <div className="rounded-xl p-5 mb-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <p className="text-xs font-bold mb-4" style={{ color: '#64748B' }}>パラメーター</p>
        <ParameterBar params={agent.params} accentColor={config.color} />
      </div>

      {/* Skills */}
      <div className="mb-5">
        <p className="text-xs font-bold mb-3" style={{ color: '#64748B' }}>
          スキル <span style={{ color: config.color }}>{agent.skills.length}</span>
        </p>
        {agent.skills.length === 0 ? (
          <p className="text-sm" style={{ color: '#4A5568' }}>まだスキルがありません。セッションを開始しよう。</p>
        ) : (
          <div className="flex flex-col gap-3">
            {agent.skills.map((skill, i) => (
              <div key={i} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center justify-between mb-1">
                  <p className="font-bold text-sm">{skill.name}</p>
                  <span className="text-xs" style={{ color: '#4A5568' }}>#{i + 1}</span>
                </div>
                <p className="text-xs" style={{ color: '#64748B' }}>{skill.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Persona traits */}
      {(agent.personaTraits ?? []).length > 0 && (
        <div className="mb-8">
          <p className="text-xs font-bold mb-3" style={{ color: '#64748B' }}>
            🧬 行動特性 <span style={{ color: '#48BB78' }}>{agent.personaTraits.length}</span>
          </p>
          <div className="flex flex-col gap-2">
            {agent.personaTraits.map((trait, i) => (
              <div key={i} className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(72,187,120,0.06)', border: '1px solid rgba(72,187,120,0.15)' }}>
                <span style={{ color: '#94A3B8' }}>{trait}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <button
        onClick={() => router.push('/train')}
        className="w-full py-4 rounded-xl font-bold text-base transition-all hover:scale-[1.02]"
        style={{ background: '#FFC300', color: '#0A0F2C' }}
      >
        教え込みを続ける →
      </button>
    </div>
  )
}
