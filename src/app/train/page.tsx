'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AGENT_TYPES } from '@/lib/quiz'
import { CATEGORIES, type Category } from '@/lib/categories'
import {
  loadAgent, saveAgent, calcParamGrowth,
  BIRTH_THRESHOLD, type Agent, type Skill, type Message,
} from '@/lib/agent'
import ParameterBar from '@/components/ParameterBar'

type Phase = 'category' | 'topic' | 'chat' | 'generating' | 'skill-confirm' | 'skill-revealed' | 'born'

interface SkillProposal {
  skillName: string
  summary: string
  keyPoints: string[]
  personaInsight: string | null
}

const SESSION_WRAP_THRESHOLD = 7 // user messages before suggesting wrap-up

export default function TrainPage() {
  const router = useRouter()
  const [agent, setAgent] = useState<Agent | null>(null)
  const [phase, setPhase] = useState<Phase>('category')
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [topic, setTopic] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [tokenCount, setTokenCount] = useState(0)
  const [userMsgCount, setUserMsgCount] = useState(0)
  const [skillProposal, setSkillProposal] = useState<SkillProposal | null>(null)
  const [skillName, setSkillName] = useState('')
  const [earnedSkill, setEarnedSkill] = useState<Skill | null>(null)
  const [prevParams, setPrevParams] = useState<Agent['params'] | null>(null)
  const [newPersonaTrait, setNewPersonaTrait] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const agentRef = useRef<Agent | null>(null)

  useEffect(() => {
    const a = loadAgent()
    if (!a) { router.push('/'); return }
    // migrate old agents without personaTraits
    if (!a.personaTraits) a.personaTraits = []
    agentRef.current = a
    setAgent(a)
  }, [router])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleCategorySelect(cat: Category) {
    setSelectedCategory(cat)
    setPhase('topic')
  }

  function handleTopicConfirm() {
    if (!topic.trim() || !agentRef.current || !selectedCategory) return
    const a = agentRef.current
    const config = AGENT_TYPES[a.type]
    const openings: Record<string, string> = {
      先読み型: `「${topic}」ですね。${config.emoji} まず全体像から教えてもらえますか？どんな構造・考え方を持っていますか？`,
      設計型: `「${topic}」について教えてもらえるんですね。${config.emoji} ステップや順序でいうと、どこから話しますか？`,
      突破型: `「${topic}」！${config.emoji} 早速聞かせてください。一番重要だと思うことから教えて！`,
      共鳴型: `「${topic}」について教えてもらえるんですね。${config.emoji} どんなきっかけでこの知識を大切にするようになったか、教えてもらえますか？`,
    }
    setMessages([{ role: 'assistant', content: openings[a.type] ?? `「${topic}」について教えてください！` }])
    setPhase('chat')
  }

  async function sendMessage() {
    if (!input.trim() || streaming || !agentRef.current || !selectedCategory) return
    const userMsg: Message = { role: 'user', content: input.trim() }
    const history = [...messages, userMsg]
    setMessages(history)
    setInput('')
    setStreaming(true)
    setUserMsgCount((c) => c + 1)

    const a = agentRef.current
    let assistantContent = ''
    setMessages([...history, { role: 'assistant', content: '' }])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: m.content })),
          agentType: a.type,
          agentName: a.name,
          category: selectedCategory.label,
          topic,
        }),
      })

      if (!res.body) throw new Error('no body')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        assistantContent += decoder.decode(value, { stream: true })
        setMessages([...history, { role: 'assistant', content: assistantContent }])
      }

      const tokens = Math.ceil((userMsg.content.length + assistantContent.length) * 1.3)
      setTokenCount((prev) => prev + tokens)
      const updated: Agent = {
        ...a,
        totalTokens: a.totalTokens + tokens,
        sessionTokens: a.sessionTokens + tokens,
      }
      agentRef.current = updated
      setAgent(updated)
      saveAgent(updated)
    } catch (e) {
      console.error(e)
    } finally {
      setStreaming(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  async function handleEndSession() {
    if (!agentRef.current || !selectedCategory) return
    setPhase('generating')

    try {
      const res = await fetch('/api/generate-skill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          category: selectedCategory.label,
          topic,
          agentType: agentRef.current.type,
        }),
      })
      const proposal: SkillProposal = await res.json()
      setSkillProposal(proposal)
      setSkillName(proposal.skillName)
      setPhase('skill-confirm')
    } catch {
      setSkillProposal({ skillName: topic, summary: `${selectedCategory.label}の知識`, keyPoints: [], personaInsight: null })
      setSkillName(topic)
      setPhase('skill-confirm')
    }
  }

  function handleSkillConfirm() {
    if (!skillName.trim() || !agentRef.current || !skillProposal) return
    const a = agentRef.current
    const newParams = calcParamGrowth(a.params, a.type, Math.max(tokenCount, 500))
    setPrevParams({ ...a.params })

    const skill: Skill = {
      name: skillName.trim(),
      description: skillProposal.summary,
      earnedAt: a.totalTokens,
    }

    const newTraits = [...(a.personaTraits ?? [])]
    if (skillProposal.personaInsight && !newTraits.includes(skillProposal.personaInsight)) {
      newTraits.push(skillProposal.personaInsight)
      setNewPersonaTrait(skillProposal.personaInsight)
    }

    const updated: Agent = { ...a, params: newParams, skills: [...a.skills, skill], personaTraits: newTraits }
    agentRef.current = updated
    setAgent(updated)
    saveAgent(updated)
    setEarnedSkill(skill)
    setPhase('skill-revealed')
  }

  function handleContinue() {
    if (!agentRef.current) return
    if (agentRef.current.totalTokens >= BIRTH_THRESHOLD) {
      setPhase('born')
    } else {
      setPhase('category')
      setSelectedCategory(null)
      setTopic('')
      setMessages([])
      setTokenCount(0)
      setUserMsgCount(0)
      setSkillProposal(null)
      setEarnedSkill(null)
      setPrevParams(null)
      setNewPersonaTrait(null)
    }
  }

  if (!agent) return null
  const config = AGENT_TYPES[agent.type]
  const progress = Math.min((agent.totalTokens / BIRTH_THRESHOLD) * 100, 100)
  const isBorn = agent.totalTokens >= BIRTH_THRESHOLD
  const isNearingWrap = userMsgCount >= SESSION_WRAP_THRESHOLD

  return (
    <div className="min-h-screen flex flex-col max-w-lg mx-auto px-4 py-6">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: config.bgColor }}>
          {config.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-bold text-base">{agent.name}</span>
            <span className="text-xs" style={{ color: config.color }}>{agent.type}</span>
            {agent.skills.length > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: config.bgColor, color: config.color }}>
                スキル×{agent.skills.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: '#FFC300' }} />
            </div>
            <span className="text-xs shrink-0" style={{ color: '#64748B' }}>
              {agent.totalTokens.toLocaleString()} / {BIRTH_THRESHOLD.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Category selection */}
      {phase === 'category' && (
        <div className="fade-in-up">
          <p className="text-sm font-bold mb-1">今日は何を教える？</p>
          <p className="text-xs mb-5" style={{ color: '#64748B' }}>
            {agent.name} があなたの知識・視点を学びます
          </p>
          <div className="grid grid-cols-2 gap-3">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleCategorySelect(cat)}
                className="text-left p-4 rounded-xl border transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' }}
              >
                <div className="text-2xl mb-2">{cat.emoji}</div>
                <div className="font-bold text-sm mb-1">{cat.label}</div>
                <div className="text-xs leading-relaxed" style={{ color: '#64748B' }}>{cat.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Topic input */}
      {phase === 'topic' && selectedCategory && (
        <div className="fade-in-up flex flex-col flex-1">
          <button onClick={() => setPhase('category')} className="flex items-center gap-1 text-xs mb-6 w-fit" style={{ color: '#64748B' }}>
            ← 戻る
          </button>
          <div className="text-2xl mb-3">{selectedCategory.emoji}</div>
          <h2 className="text-lg font-bold mb-1">{selectedCategory.label}</h2>
          <p className="text-sm mb-6" style={{ color: '#64748B' }}>何を教え込みたい？</p>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={selectedCategory.placeholder}
            rows={3}
            autoFocus
            className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none mb-4"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: `1px solid ${topic ? config.color : 'rgba(255,255,255,0.1)'}`,
              color: '#F0F4FF',
            }}
          />
          {selectedCategory.id === 'thinking' && (
            <div className="rounded-xl px-4 py-3 mb-4 text-xs leading-relaxed" style={{ background: 'rgba(255,195,0,0.08)', border: '1px solid rgba(255,195,0,0.15)', color: '#94A3B8' }}>
              💡 意思決定の経緯・書いた文章・判断の基準など貼るとAIが思考パターンを抽出します
            </div>
          )}
          <button
            onClick={handleTopicConfirm}
            disabled={!topic.trim()}
            className="w-full py-4 rounded-xl font-bold text-base disabled:opacity-30 transition-all hover:scale-[1.02]"
            style={{ background: '#FFC300', color: '#0A0F2C' }}
          >
            セッション開始 →
          </button>
        </div>
      )}

      {/* Chat */}
      {phase === 'chat' && (
        <>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs px-2 py-1 rounded" style={{ background: config.bgColor, color: config.color }}>
              {selectedCategory?.emoji} {selectedCategory?.label}
            </span>
            <span className="text-xs truncate" style={{ color: '#94A3B8' }}>{topic}</span>
          </div>

          {/* Wrap-up nudge */}
          {isNearingWrap && !streaming && (
            <div className="rounded-xl px-4 py-3 mb-3 text-xs" style={{ background: 'rgba(255,195,0,0.08)', border: '1px solid rgba(255,195,0,0.2)' }}>
              <span style={{ color: '#FFC300' }}>✨ だいぶ話せたね！</span>
              <span style={{ color: '#94A3B8' }}> スキルカードにまとめるタイミングかも</span>
            </div>
          )}

          <div className="flex-1 overflow-y-auto flex flex-col gap-3 mb-4 min-h-0 max-h-[calc(100vh-350px)]">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs mr-2 mt-1 shrink-0" style={{ background: config.bgColor }}>
                    {config.emoji}
                  </div>
                )}
                <div
                  className="max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap"
                  style={{
                    background: m.role === 'user' ? 'rgba(255,195,0,0.15)' : 'rgba(255,255,255,0.06)',
                    borderBottomRightRadius: m.role === 'user' ? 4 : undefined,
                    borderBottomLeftRadius: m.role === 'assistant' ? 4 : undefined,
                  }}
                >
                  {m.content || (streaming && i === messages.length - 1
                    ? <span style={{ color: '#64748B' }}>考え中…</span>
                    : '')}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`${agent.name}に教える…`}
              disabled={streaming}
              className="flex-1 px-4 py-3 rounded-xl text-sm outline-none"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#F0F4FF' }}
            />
            <button
              onClick={sendMessage}
              disabled={streaming || !input.trim()}
              className="px-4 py-3 rounded-xl font-bold text-sm disabled:opacity-30"
              style={{ background: '#FFC300', color: '#0A0F2C' }}
            >
              →
            </button>
          </div>

          {messages.length >= 4 && !streaming && (
            <button
              onClick={handleEndSession}
              className="mt-3 w-full py-3 rounded-xl text-sm transition-all"
              style={{
                border: `1px solid ${isNearingWrap ? '#FFC300' : 'rgba(255,255,255,0.1)'}`,
                color: isNearingWrap ? '#FFC300' : '#94A3B8',
                background: isNearingWrap ? 'rgba(255,195,0,0.08)' : 'transparent',
              }}
            >
              ✨ スキルカードを作る
            </button>
          )}
        </>
      )}

      {/* Generating */}
      {phase === 'generating' && (
        <div className="flex-1 flex flex-col items-center justify-center text-center fade-in-up">
          <div className="text-4xl mb-4 animate-pulse">{config.emoji}</div>
          <p className="text-sm" style={{ color: '#94A3B8' }}>セッション内容を整理中…</p>
          <p className="text-xs mt-2" style={{ color: '#64748B' }}>スキルカードを生成しています</p>
        </div>
      )}

      {/* Skill confirm */}
      {phase === 'skill-confirm' && skillProposal && (
        <div className="flex-1 flex flex-col justify-center fade-in-up">
          <p className="text-xs text-center tracking-widest mb-4" style={{ color: '#FFC300' }}>SKILL PROPOSAL</p>

          {/* Skill preview card */}
          <div className="rounded-2xl p-5 mb-5" style={{ background: config.bgColor, border: `1px solid ${config.color}` }}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">{config.emoji}</span>
              <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.1)', color: config.color }}>
                {selectedCategory?.label}
              </span>
            </div>
            <p className="text-lg font-bold mb-2" style={{ color: '#F0F4FF' }}>{skillProposal.skillName}</p>
            <p className="text-xs mb-3" style={{ color: '#94A3B8' }}>{skillProposal.summary}</p>
            {skillProposal.keyPoints.length > 0 && (
              <ul className="space-y-1.5">
                {skillProposal.keyPoints.map((pt, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs" style={{ color: '#D1D5DB' }}>
                    <span style={{ color: config.color }}>▸</span>
                    {pt}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Persona insight preview */}
          {skillProposal.personaInsight && (
            <div className="rounded-xl px-4 py-3 mb-4 text-xs" style={{ background: 'rgba(72,187,120,0.08)', border: '1px solid rgba(72,187,120,0.2)' }}>
              <p className="font-bold mb-1" style={{ color: '#48BB78' }}>🧬 行動特性を検出</p>
              <p style={{ color: '#94A3B8' }}>{skillProposal.personaInsight}</p>
            </div>
          )}

          <p className="text-xs font-bold mb-2" style={{ color: '#64748B' }}>スキル名を確認・編集</p>
          <input
            type="text"
            value={skillName}
            onChange={(e) => setSkillName(e.target.value)}
            maxLength={20}
            autoFocus
            className="w-full px-4 py-3 rounded-xl text-sm outline-none mb-5"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: `1px solid ${skillName ? config.color : 'rgba(255,255,255,0.1)'}`,
              color: '#F0F4FF',
            }}
          />

          <button
            onClick={handleSkillConfirm}
            disabled={!skillName.trim()}
            className="w-full py-4 rounded-xl font-bold text-base disabled:opacity-30 transition-all hover:scale-[1.02]"
            style={{ background: '#FFC300', color: '#0A0F2C' }}
          >
            このスキルで確定 ✨
          </button>
        </div>
      )}

      {/* Skill revealed */}
      {phase === 'skill-revealed' && earnedSkill && (
        <div className="flex-1 flex flex-col justify-center fade-in-up">
          <p className="text-xs text-center tracking-widest mb-5" style={{ color: '#FFC300' }}>SKILL UNLOCKED</p>

          <div
            className="rounded-2xl p-6 mb-5"
            style={{ background: config.bgColor, border: `1px solid ${config.color}`, boxShadow: `0 0 24px ${config.color}33` }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{config.emoji}</span>
                <span className="text-xs font-bold" style={{ color: config.color }}>{agent.type}</span>
              </div>
              <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.08)', color: '#64748B' }}>
                #{agent.skills.length}
              </span>
            </div>
            <h3 className="text-xl font-bold mb-1">{earnedSkill.name}</h3>
            <p className="text-xs mb-3" style={{ color: '#94A3B8' }}>{earnedSkill.description}</p>
            {skillProposal?.keyPoints && skillProposal.keyPoints.length > 0 && (
              <ul className="space-y-1.5 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                {skillProposal.keyPoints.map((pt, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs" style={{ color: '#64748B' }}>
                    <span style={{ color: config.color }}>▸</span>{pt}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* New persona trait */}
          {newPersonaTrait && (
            <div className="rounded-xl px-4 py-3 mb-5 text-xs fade-in-up" style={{ background: 'rgba(72,187,120,0.08)', border: '1px solid rgba(72,187,120,0.25)' }}>
              <p className="font-bold mb-1" style={{ color: '#48BB78' }}>🧬 ペルソナに追加</p>
              <p style={{ color: '#94A3B8' }}>{newPersonaTrait}</p>
              <p className="mt-1" style={{ color: '#4A5568' }}>次のセッションからエージェントの振る舞いに反映されます</p>
            </div>
          )}

          {prevParams && (
            <div className="rounded-xl p-5 mb-5" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <p className="text-xs mb-4" style={{ color: '#64748B' }}>パラメーター上昇</p>
              <ParameterBar params={agent.params} prevParams={prevParams} accentColor={config.color} />
            </div>
          )}

          <div className="rounded-xl p-4 mb-5" style={{ background: 'rgba(255,195,0,0.08)', border: '1px solid rgba(255,195,0,0.15)' }}>
            <div className="flex justify-between text-xs mb-2">
              <span style={{ color: '#FFC300' }}>誕生まで</span>
              <span style={{ color: '#FFC300' }}>
                {isBorn ? '達成！🎉' : `残り ${(BIRTH_THRESHOLD - agent.totalTokens).toLocaleString()} tokens`}
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${progress}%`, background: '#FFC300' }} />
            </div>
          </div>

          <button
            onClick={handleContinue}
            className="w-full py-4 rounded-xl font-bold text-base transition-all hover:scale-[1.02]"
            style={{ background: '#FFC300', color: '#0A0F2C' }}
          >
            {isBorn ? '🎉 誕生！完全体へ' : '続けて教え込む →'}
          </button>
        </div>
      )}

      {/* Born */}
      {phase === 'born' && (
        <div className="flex-1 flex flex-col items-center justify-center text-center fade-in-up">
          <div className="text-6xl mb-6">{config.emoji}</div>
          <p className="text-xs tracking-widest mb-3" style={{ color: '#FFC300' }}>AGENT COMPLETE</p>
          <h2 className="text-2xl font-bold mb-2">{agent.name}、誕生！</h2>
          <p className="text-sm" style={{ color: config.color }}>{agent.type}</p>
          <p className="text-sm mt-3 mb-1" style={{ color: '#94A3B8' }}>スキル {agent.skills.length} 個を習得</p>
          {agent.personaTraits.length > 0 && (
            <p className="text-sm" style={{ color: '#48BB78' }}>行動特性 {agent.personaTraits.length} 件を記録</p>
          )}
          <div className="rounded-xl p-5 w-full mt-6" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <ParameterBar params={agent.params} accentColor={config.color} />
          </div>
          <button
            onClick={() => router.push('/')}
            className="mt-8 w-full py-4 rounded-xl font-bold text-base transition-all hover:scale-[1.02]"
            style={{ background: '#FFC300', color: '#0A0F2C' }}
          >
            新しいエージェントを育てる
          </button>
        </div>
      )}
    </div>
  )
}
