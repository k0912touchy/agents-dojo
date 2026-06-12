'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AGENT_TYPES } from '@/lib/quiz'
import { loadAgent, loadDetectedTraits, calcAgentTier, TIER_COLORS, renderStars, BIRTH_THRESHOLD, type Agent, type DetectedTrait, type PersonalKnowledge } from '@/lib/agent'
import ParameterBar from '@/components/ParameterBar'

function SkillContent({ content, accentColor }: { content: string; accentColor: string }) {
  const lines = content.split('\n')
  return (
    <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
      {lines.map((line, i) => {
        if (line.startsWith('## ')) {
          return (
            <p key={i} className="text-xs font-bold mt-3 mb-1.5 first:mt-0" style={{ color: accentColor }}>
              {line.slice(3)}
            </p>
          )
        }
        if (line.startsWith('- ')) {
          return (
            <div key={i} className="flex gap-2 mb-1">
              <span className="text-xs shrink-0 mt-0.5" style={{ color: accentColor }}>▸</span>
              <span className="text-xs leading-relaxed" style={{ color: '#94A3B8' }}>{line.slice(2)}</span>
            </div>
          )
        }
        if (line.trim() === '') return <div key={i} className="h-1" />
        return (
          <p key={i} className="text-xs leading-relaxed mb-1" style={{ color: '#94A3B8' }}>{line}</p>
        )
      })}
    </div>
  )
}

export default function AgentPage() {
  const router = useRouter()
  const [agent, setAgent] = useState<Agent | null>(null)
  const [allTraits, setAllTraits] = useState<DetectedTrait[]>([])
  const [expandedSkill, setExpandedSkill] = useState<number | null>(null)
  const [showPersonalKnowledge, setShowPersonalKnowledge] = useState(false)

  useEffect(() => {
    const a = loadAgent()
    if (!a) { router.push('/'); return }
    if (!a.personaTraits) a.personaTraits = []
    setAgent(a)
    setAllTraits(loadDetectedTraits())
  }, [router])

  if (!agent) return null
  const config = AGENT_TYPES[agent.type]
  const progress = Math.min((agent.totalTokens / BIRTH_THRESHOLD) * 100, 100)
  const isBorn = agent.totalTokens >= BIRTH_THRESHOLD
  const tier = calcAgentTier(agent)

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
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="text-2xl font-bold">{agent.name}</h1>
            <span
              className="text-base font-black px-2.5 py-0.5 rounded-lg"
              style={{ background: `${TIER_COLORS[tier]}22`, color: TIER_COLORS[tier], border: `1px solid ${TIER_COLORS[tier]}55` }}
            >
              {tier}
            </span>
          </div>
          <p className="text-sm" style={{ color: config.color }}>{agent.type}</p>
          <p className="text-xs mt-1" style={{ color: '#64748B' }}>累計 {agent.totalTokens.toLocaleString()} tokens · スキル {agent.skills.length}個</p>
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

      {/* Skills */}
      <div className="mb-5">
        <p className="text-xs font-bold mb-3" style={{ color: '#64748B' }}>
          スキル <span style={{ color: config.color }}>{agent.skills.length}</span>
        </p>
        {agent.skills.length === 0 ? (
          <p className="text-sm" style={{ color: '#4A5568' }}>まだスキルがありません。セッションを開始しよう。</p>
        ) : (
          <div className="flex flex-col gap-3">
            {agent.skills.map((skill, i) => {
              const isOpen = expandedSkill === i
              return (
                <div
                  key={i}
                  className="rounded-xl p-4 transition-all"
                  style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${isOpen ? config.color + '55' : 'rgba(255,255,255,0.06)'}` }}
                >
                  <button
                    className="w-full text-left"
                    onClick={() => setExpandedSkill(isOpen ? null : i)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-bold text-sm">{skill.name}</p>
                      <div className="flex items-center gap-2">
                        {skill.isPrivate && (
                          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(252,129,129,0.12)', color: '#FC8181' }}>🔒</span>
                        )}
                        {skill.rank && (
                          <span className="text-xs tracking-tight" style={{ color: '#FFC300' }}>
                            {renderStars(skill.rank)}
                          </span>
                        )}
                        <span className="text-xs" style={{ color: '#4A5568' }}>#{i + 1}</span>
                        {skill.content && (
                          <span className="text-xs" style={{ color: '#4A5568' }}>{isOpen ? '▲' : '▼'}</span>
                        )}
                      </div>
                    </div>
                    <p className="text-xs" style={{ color: '#64748B' }}>{skill.description}</p>
                  </button>

                  {isOpen && skill.content && (
                    <SkillContent content={skill.content} accentColor={config.color} />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Parameters */}
      <div className="rounded-xl p-5 mb-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <p className="text-xs font-bold mb-4" style={{ color: '#64748B' }}>パラメーター</p>
        <ParameterBar params={agent.params} accentColor={config.color} />
      </div>

      {/* Persona traits */}
      {(agent.personaTraits ?? []).length > 0 && (
        <div className="mb-8">
          <p className="text-xs font-bold mb-3" style={{ color: '#64748B' }}>
            🧬 行動特性 <span style={{ color: '#48BB78' }}>{agent.personaTraits.length}</span>
          </p>
          <div className="flex flex-col gap-2">
            {agent.personaTraits.map((label, i) => {
              const detail = allTraits.find((t) => t.label === label)
              return (
                <div key={i} className="rounded-xl px-4 py-3" style={{ background: 'rgba(72,187,120,0.06)', border: '1px solid rgba(72,187,120,0.15)' }}>
                  <p className="text-xs font-bold mb-1" style={{ color: '#48BB78' }}>{label}</p>
                  {detail && <p className="text-xs" style={{ color: '#64748B' }}>{detail.description}</p>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Personal knowledge */}
      {(agent.personalKnowledge ?? []).length > 0 && (
        <div className="mb-8">
          <button
            className="flex items-center gap-2 mb-3 w-full text-left"
            onClick={() => setShowPersonalKnowledge((v) => !v)}
          >
            <p className="text-xs font-bold" style={{ color: '#4A5568' }}>
              🔒 固有知識 <span style={{ color: '#94A3B8' }}>{agent.personalKnowledge!.length}</span>
            </p>
            <span className="text-xs" style={{ color: '#4A5568' }}>{showPersonalKnowledge ? '▲' : '▼'}</span>
          </button>
          {showPersonalKnowledge && (
            <div className="flex flex-col gap-2">
              <p className="text-xs mb-2 px-1" style={{ color: '#4A5568' }}>スキルとは別軸で管理されます。共有・公開時には除外されます。</p>
              {agent.personalKnowledge!.map((pk: PersonalKnowledge, i: number) => (
                <div key={i} className="rounded-xl px-4 py-3" style={{ background: 'rgba(148,163,184,0.04)', border: '1px solid rgba(148,163,184,0.1)' }}>
                  <p className="text-xs font-bold mb-0.5" style={{ color: '#94A3B8' }}>{pk.linkedSkillName} の固有文脈</p>
                  <p className="text-xs" style={{ color: '#64748B' }}>{pk.summary}</p>
                </div>
              ))}
            </div>
          )}
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
