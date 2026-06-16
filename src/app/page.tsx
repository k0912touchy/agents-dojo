'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { loadAgent } from '@/lib/storage'
import { PERSPECTIVE_META, type Agent } from '@/lib/dojo'

export default function HomePage() {
  const router = useRouter()
  const [agent, setAgent] = useState<Agent | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setAgent(loadAgent())
    setLoading(false)
  }, [])

  if (loading) return null

  // Returning user
  if (agent) {
    const pm = PERSPECTIVE_META[agent.persona.perspectiveType]
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="max-w-md w-full fade-in-up">
          <p className="text-xs tracking-widest text-center mb-8" style={{ color: 'var(--accent)' }}>
            DOJO
          </p>

          {/* Agent card */}
          <div
            className="rounded-2xl p-5 mb-5 cursor-pointer transition-all hover:scale-[1.01]"
            style={{ background: pm.bg, border: `1px solid ${pm.color}44` }}
            onClick={() => router.push('/agent')}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="text-3xl">{pm.icon}</div>
              <div>
                <h2 className="text-xl font-bold">{agent.name}</h2>
                <span className="text-xs" style={{ color: pm.color }}>{pm.label}</span>
              </div>
            </div>
            <p className="text-xs leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
              {agent.persona.description.slice(0, 80)}...
            </p>
            <div className="flex gap-4 text-sm">
              <div>
                <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>知識</p>
                <p className="font-bold" style={{ color: pm.color }}>{agent.knowledge.length}</p>
              </div>
              <div>
                <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>経験</p>
                <p className="font-bold" style={{ color: pm.color }}>{agent.experiences.length}</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <button
              onClick={() => router.push('/knowledge/new')}
              className="w-full py-4 rounded-xl font-bold transition-all hover:scale-[1.02]"
              style={{ background: 'var(--accent)', color: 'var(--accent-on)' }}>
              📚 知識を与える
            </button>
            <button
              onClick={() => router.push('/experience/new')}
              className="w-full py-4 rounded-xl font-bold transition-all hover:scale-[1.02]"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}>
              ⚡ 経験を積ませる
            </button>
          </div>
        </div>
      </div>
    )
  }

  // New user
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10">
      <div className="max-w-md w-full fade-in-up">
        <div className="text-center mb-10">
          <p className="text-xs tracking-[0.3em] mb-5" style={{ color: 'var(--accent)' }}>DOJO</p>
          <h1 className="text-3xl font-bold mb-4 leading-tight">
            人格・知識・経験で<br />AIエージェントを設計する
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            普通のAIに足りないのは「経験由来の判断」。<br />
            DOJOはそれを作る場所。
          </p>
        </div>

        {/* 3 axes */}
        <div className="rounded-2xl p-5 mb-8"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
          {[
            { icon: '🧠', title: '人格', desc: '思考スタイル・視点タイプを診断で設計する' },
            { icon: '📚', title: '知識', desc: 'AIに調べさせるか、自分で書いて与える' },
            { icon: '⚡', title: '経験', desc: 'シナリオを経験させ、判断パターンを形成する' },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="flex gap-4 items-start py-3"
              style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <span className="text-xl shrink-0 mt-0.5">{icon}</span>
              <div>
                <p className="text-sm font-bold mb-0.5">{title}</p>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => router.push('/create')}
          className="w-full py-4 rounded-xl font-bold text-base transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: 'var(--accent)', color: 'var(--accent-on)' }}>
          エージェントを設計する →
        </button>
        <p className="text-center text-xs mt-3" style={{ color: 'var(--text-faint)' }}>
          {QUIZ_QUESTIONS_COUNT}問・約2分 · 登録不要
        </p>
      </div>
    </div>
  )
}

const QUIZ_QUESTIONS_COUNT = 4
