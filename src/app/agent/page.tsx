'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { loadAgent, deleteAgent } from '@/lib/storage'
import { PERSPECTIVE_META, STANCE_LABEL, type Agent } from '@/lib/dojo'

export default function AgentPage() {
  const router = useRouter()
  const [agent, setAgent] = useState<Agent | null>(null)
  const [expandedKnowledge, setExpandedKnowledge] = useState<string | null>(null)

  useEffect(() => {
    const a = loadAgent()
    if (!a) { router.push('/'); return }
    setAgent(a)
  }, [router])

  if (!agent) return null

  const pm = PERSPECTIVE_META[agent.persona.perspectiveType]

  return (
    <div className="min-h-screen max-w-lg mx-auto px-4 py-6">
      <button onClick={() => router.push('/')} className="flex items-center gap-1 text-xs mb-6"
        style={{ color: 'var(--text-muted)' }}>
        ← ホームに戻る
      </button>

      {/* Agent identity */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0"
          style={{ background: pm.bg, border: `2px solid ${pm.color}` }}>
          {pm.icon}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{agent.name}</h1>
          <span className="text-xs px-2 py-0.5 rounded-full font-bold"
            style={{ background: pm.bg, color: pm.color, border: `1px solid ${pm.color}44` }}>
            {pm.label}
          </span>
        </div>
      </div>

      {/* Persona */}
      <div className="rounded-xl p-5 mb-4"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
        <p className="text-xs font-bold mb-3" style={{ color: 'var(--text-muted)' }}>🧠 人格</p>
        <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
          {agent.persona.description}
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            { label: STANCE_LABEL[agent.persona.traits.stance] },
            { label: agent.persona.traits.riskTolerance < 0.4 ? 'リスク慎重' : agent.persona.traits.riskTolerance > 0.6 ? 'リスク積極' : 'リスク中程度' },
            { label: agent.persona.traits.decisionSpeed < 0.4 ? '熟考型' : agent.persona.traits.decisionSpeed > 0.6 ? '即断型' : '状況対応型' },
            { label: agent.persona.traits.abstractionLevel < 0.4 ? '実務寄り' : agent.persona.traits.abstractionLevel > 0.6 ? '戦略寄り' : 'バランス型' },
          ].map(({ label }) => (
            <span key={label} className="text-xs px-2.5 py-1 rounded-full"
              style={{ background: pm.bg, color: pm.color, border: `1px solid ${pm.color}33` }}>
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Knowledge */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
            📚 知識 <span style={{ color: 'var(--accent)' }}>{agent.knowledge.length}</span>
          </p>
          <button
            onClick={() => router.push('/knowledge/new')}
            className="text-xs px-3 py-1.5 rounded-lg font-bold transition-all hover:scale-[1.02]"
            style={{ background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}>
            ＋ 追加
          </button>
        </div>

        {agent.knowledge.length === 0 ? (
          <div className="rounded-xl p-5 text-center"
            style={{ background: 'var(--bg-surface)', border: '1px dashed var(--border-default)' }}>
            <p className="text-sm mb-1" style={{ color: 'var(--text-faint)' }}>まだ知識がありません</p>
            <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
              AIに調べさせるか、自分で書いて与えましょう
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {agent.knowledge.map((k) => {
              const isOpen = expandedKnowledge === k.id
              return (
                <div key={k.id} className="rounded-xl overflow-hidden"
                  style={{ background: 'var(--bg-surface)', border: `1px solid ${isOpen ? 'var(--accent-border)' : 'var(--border-subtle)'}` }}>
                  <button className="w-full text-left px-4 py-3 flex items-center justify-between"
                    onClick={() => setExpandedKnowledge(isOpen ? null : k.id)}>
                    <div>
                      <p className="text-sm font-bold">{k.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{k.domain}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded"
                          style={{
                            background: k.source === 'ai-researched' ? 'rgba(99,102,241,0.15)' : 'var(--bg-surface)',
                            color: k.source === 'ai-researched' ? '#818CF8' : 'var(--text-muted)',
                          }}>
                          {k.source === 'ai-researched' ? '🔍 AIリサーチ' : '✍️ ユーザー作成'}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs" style={{ color: 'var(--text-faint)' }}>{isOpen ? '▲' : '▼'}</span>
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                      <pre className="text-xs leading-relaxed mt-3 whitespace-pre-wrap"
                        style={{ color: 'var(--text-secondary)', fontFamily: 'inherit' }}>
                        {k.content.slice(0, 800)}{k.content.length > 800 ? '...' : ''}
                      </pre>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Experiences */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
            ⚡ 経験 <span style={{ color: 'var(--complement-color)' }}>{agent.experiences.length}</span>
          </p>
          <button
            onClick={() => router.push('/experience/new')}
            className="text-xs px-3 py-1.5 rounded-lg font-bold transition-all hover:scale-[1.02]"
            style={{ background: 'var(--complement-bg)', color: 'var(--complement-color)', border: '1px solid rgba(52,211,153,0.3)' }}>
            ＋ 経験させる
          </button>
        </div>

        {agent.experiences.length === 0 ? (
          <div className="rounded-xl p-5 text-center"
            style={{ background: 'var(--bg-surface)', border: '1px dashed var(--border-default)' }}>
            <p className="text-sm mb-1" style={{ color: 'var(--text-faint)' }}>まだ経験がありません</p>
            <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
              シナリオを経験させて、思考の癖を形成しましょう
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {agent.experiences.map((exp) => (
              <div key={exp.id} className="rounded-xl px-4 py-3"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                <p className="text-sm font-bold mb-1">{exp.title}</p>
                <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>{exp.summary}</p>
                <div className="flex flex-wrap gap-1.5">
                  {exp.derivedTraits.map((t) => (
                    <span key={t.label} className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: 'var(--complement-bg)', color: 'var(--complement-color)', border: '1px solid rgba(52,211,153,0.25)' }}>
                      {t.label}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Danger zone */}
      <div className="pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <button
          onClick={() => {
            if (confirm(`${agent.name} を削除しますか？この操作は取り消せません。`)) {
              deleteAgent()
              router.push('/')
            }
          }}
          className="text-xs py-2 px-4 rounded-lg transition-all hover:opacity-80"
          style={{ border: '1px solid rgba(248,113,113,0.3)', color: 'var(--contrarian-color)' }}>
          このエージェントを削除
        </button>
      </div>
    </div>
  )
}
