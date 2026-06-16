'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { loadAgent, saveAgent } from '@/lib/storage'
import type { Experience } from '@/lib/dojo'

const SCENARIO_TEMPLATES = [
  {
    id: 'negotiation',
    title: '交渉シミュレーション',
    description: '価格・条件交渉の場面で判断を積む',
    icon: '🤝',
    turns: 5,
    situations: [
      '相手から当初提示の30%引きを要求された。自社の利益率は15%。どう対応する？',
      '相手が「他社はもっと安い」と言ってきた。証拠はない。',
      '交渉が膠着した。相手は席を立とうとしている。',
      '最終条件を提示した。相手は「持ち帰って検討したい」と言う。',
      '翌日、相手から「5%追加値引きが最後の条件」と連絡が来た。',
    ],
  },
  {
    id: 'investment',
    title: '投資判断シミュレーション',
    description: '新規事業・投資案件への判断を積む',
    icon: '💰',
    turns: 5,
    situations: [
      '有望な新規事業の投資案件。ROI予測は3年で2倍だが根拠が薄い。',
      'チームは全員賛成。だが市場調査が不十分だ。',
      '競合が先行投資を始めたという情報が入った。急ぐべきか？',
      '投資委員会から「もう1ヶ月調査期間を」と言われた。',
      '追加調査の結果、市場規模が当初の70%と判明した。',
    ],
  },
  {
    id: 'crisis',
    title: 'クライシス対応シミュレーション',
    description: '緊急事態での意思決定を積む',
    icon: '🚨',
    turns: 5,
    situations: [
      '製品に重大な不具合が発覚。すでに100社に出荷済み。',
      'メディアから問い合わせが来た。まだ社内で事実確認中。',
      'CEO不在。意思決定権限があいまいな状態で対応が迫られている。',
      '顧客から「SNSで公表する」と脅し的な連絡が来た。',
      '対応策を実施したが、別の問題が発覚した。',
    ],
  },
]

type Phase = 'select' | 'simulating' | 'result'

export default function ExperienceNewPage() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('select')
  const [selectedScenario, setSelectedScenario] = useState<typeof SCENARIO_TEMPLATES[0] | null>(null)
  const [currentTurn, setCurrentTurn] = useState(0)
  const [decisions, setDecisions] = useState<{ situation: string; choice: string; consequence: string }[]>([])
  const [currentChoice, setCurrentChoice] = useState('')
  const [consequence, setConsequence] = useState('')
  const [isGeneratingConsequence, setIsGeneratingConsequence] = useState(false)
  const [experienceResult, setExperienceResult] = useState<{ summary: string; derivedTraits: { label: string; description: string }[] } | null>(null)

  async function generateConsequence(situation: string, choice: string) {
    setIsGeneratingConsequence(true)
    const agent = loadAgent()
    if (!agent) return

    try {
      const res = await fetch('/api/experience/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent,
          scenarioId: selectedScenario!.id,
          scenarioTitle: selectedScenario!.title,
          decisions: [{ situation, choice, consequence: '（評価中）' }],
        }),
      })
      // Use a simple inline consequence for now
      const data = await res.json()
      return data.summary || 'この判断の結果、状況は次のフェーズへ進んだ。'
    } catch {
      return 'この判断を下した。次の場面へ。'
    } finally {
      setIsGeneratingConsequence(false)
    }
  }

  async function handleChoice() {
    if (!currentChoice.trim() || !selectedScenario) return
    const situation = selectedScenario.situations[currentTurn]

    setIsGeneratingConsequence(true)
    const cons = await generateConsequence(situation, currentChoice) ?? ''
    setConsequence(cons)

    const newDecisions = [...decisions, { situation, choice: currentChoice, consequence: cons }]
    setDecisions(newDecisions)

    if (currentTurn + 1 >= selectedScenario.turns) {
      // All turns done — extract traits
      await finishSimulation(newDecisions)
    } else {
      setCurrentTurn(currentTurn + 1)
      setCurrentChoice('')
      setConsequence('')
      setIsGeneratingConsequence(false)
    }
  }

  async function finishSimulation(allDecisions: typeof decisions) {
    const agent = loadAgent()
    if (!agent || !selectedScenario) return

    try {
      const res = await fetch('/api/experience/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent,
          scenarioId: selectedScenario.id,
          scenarioTitle: selectedScenario.title,
          decisions: allDecisions,
        }),
      })
      const result = await res.json()
      setExperienceResult(result)

      // Save to agent
      const experience: Experience = {
        id: crypto.randomUUID(),
        type: 'simulation',
        title: selectedScenario.title,
        derivedTraits: result.derivedTraits ?? [],
        summary: result.summary ?? '',
        completedAt: new Date().toISOString(),
      }
      agent.experiences.push(experience)
      saveAgent(agent)
      setPhase('result')
    } catch {
      setPhase('result')
    } finally {
      setIsGeneratingConsequence(false)
    }
  }

  if (phase === 'result') {
    return (
      <div className="min-h-screen max-w-lg mx-auto px-4 py-6 fade-in-up">
        <div className="text-center mb-8">
          <div className="text-4xl mb-4">⚡</div>
          <h1 className="text-xl font-bold mb-2">経験を積みました</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{selectedScenario?.title}</p>
        </div>

        {experienceResult && (
          <>
            <div className="rounded-xl p-4 mb-4"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
              <p className="text-xs font-bold mb-2" style={{ color: 'var(--text-muted)' }}>経験サマリー</p>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {experienceResult.summary}
              </p>
            </div>

            <div className="rounded-xl p-4 mb-8"
              style={{ background: 'var(--complement-bg)', border: '1px solid rgba(52,211,153,0.2)' }}>
              <p className="text-xs font-bold mb-3" style={{ color: 'var(--complement-color)' }}>
                獲得した思考の癖
              </p>
              <div className="flex flex-col gap-2">
                {experienceResult.derivedTraits.map((t) => (
                  <div key={t.label} className="flex gap-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0"
                      style={{ background: 'rgba(52,211,153,0.15)', color: 'var(--complement-color)' }}>
                      {t.label}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t.description}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <button
          onClick={() => router.push('/agent')}
          className="w-full py-4 rounded-xl font-bold transition-all hover:scale-[1.02]"
          style={{ background: 'var(--accent)', color: 'var(--accent-on)' }}>
          エージェントに反映する →
        </button>
      </div>
    )
  }

  if (phase === 'simulating' && selectedScenario) {
    const situation = selectedScenario.situations[currentTurn]
    return (
      <div className="min-h-screen max-w-lg mx-auto px-4 py-6">
        {/* Progress */}
        <div className="flex gap-1.5 mb-8">
          {selectedScenario.situations.map((_, i) => (
            <div key={i} className="h-1 flex-1 rounded-full"
              style={{ background: i < currentTurn ? 'var(--complement-color)' : i === currentTurn ? 'var(--accent)' : 'var(--border-default)' }} />
          ))}
        </div>

        <p className="text-xs mb-4 tracking-widest" style={{ color: 'var(--accent)' }}>
          場面 {currentTurn + 1} / {selectedScenario.turns}
        </p>

        <div className="rounded-xl p-5 mb-6"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-sm leading-relaxed">{situation}</p>
        </div>

        {consequence && (
          <div className="rounded-xl p-4 mb-4"
            style={{ background: 'var(--complement-bg)', border: '1px solid rgba(52,211,153,0.2)' }}>
            <p className="text-xs font-bold mb-1" style={{ color: 'var(--complement-color)' }}>結果</p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{consequence}</p>
          </div>
        )}

        {!consequence && (
          <>
            <textarea
              rows={4}
              placeholder="あなたのエージェントとしてどう判断・行動しますか？"
              value={currentChoice}
              onChange={(e) => setCurrentChoice(e.target.value)}
              className="w-full px-4 py-3 rounded-xl outline-none resize-none mb-4"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-primary)',
              }}
            />
            <button
              onClick={handleChoice}
              disabled={!currentChoice.trim() || isGeneratingConsequence}
              className="w-full py-4 rounded-xl font-bold transition-all hover:scale-[1.02] disabled:opacity-40"
              style={{ background: 'var(--accent)', color: 'var(--accent-on)' }}>
              {isGeneratingConsequence ? '処理中...' : 'この判断で進む →'}
            </button>
          </>
        )}

        {consequence && currentTurn + 1 < selectedScenario.turns && (
          <button
            onClick={() => {
              setCurrentChoice('')
              setConsequence('')
            }}
            className="w-full py-4 rounded-xl font-bold transition-all hover:scale-[1.02]"
            style={{ background: 'var(--accent)', color: 'var(--accent-on)' }}>
            次の場面へ →
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen max-w-lg mx-auto px-4 py-6">
      <button onClick={() => router.back()} className="flex items-center gap-1 text-xs mb-6"
        style={{ color: 'var(--text-muted)' }}>
        ← 戻る
      </button>
      <h1 className="text-xl font-bold mb-2">経験を積む</h1>
      <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>
        シナリオを選んで、判断を繰り返すことで思考の癖が形成されます
      </p>
      <div className="flex flex-col gap-4">
        {SCENARIO_TEMPLATES.map((s) => (
          <button
            key={s.id}
            onClick={() => { setSelectedScenario(s); setPhase('simulating') }}
            className="w-full text-left p-5 rounded-xl border transition-all hover:scale-[1.01]"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">{s.icon}</span>
              <p className="font-bold">{s.title}</p>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{s.description}</p>
            <p className="text-xs mt-2" style={{ color: 'var(--text-faint)' }}>{s.turns}場面</p>
          </button>
        ))}
      </div>
    </div>
  )
}
