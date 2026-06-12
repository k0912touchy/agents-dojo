'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AGENT_TYPES } from '@/lib/quiz'
import {
  loadAgent, saveAgent, calcParamGrowth,
  BIRTH_THRESHOLD, type Agent, type Skill, type Message,
} from '@/lib/agent'
import ParameterBar from '@/components/ParameterBar'

type Phase = 'chat' | 'skill-name' | 'skill-revealed' | 'born'

const QUESTS = [
  '最近、仕事で一番悩んでいることを教えて。どこで詰まってる？',
  '今週やろうとしているのに進んでいないことがある？なぜ止まっていると思う？',
  '自分の強みって何だと思う？正直に話してみて。',
  '今の仕事で、もっとうまくやれると感じる部分はどこ？',
]

export default function TrainPage() {
  const router = useRouter()
  const [agent, setAgent] = useState<Agent | null>(null)
  const [phase, setPhase] = useState<Phase>('chat')
  const [quest] = useState(() => QUESTS[Math.floor(Math.random() * QUESTS.length)])
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [tokenCount, setTokenCount] = useState(0)
  const [skillInput, setSkillInput] = useState('')
  const [earnedSkill, setEarnedSkill] = useState<Skill | null>(null)
  const [prevParams, setPrevParams] = useState<Agent['params'] | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const agentRef = useRef<Agent | null>(null)

  useEffect(() => {
    const a = loadAgent()
    if (!a) { router.push('/'); return }
    agentRef.current = a
    setAgent(a)
    setMessages([{ role: 'assistant', content: AGENT_TYPES[a.type].firstLine }])
  }, [router])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming])

  async function sendMessage() {
    if (!input.trim() || streaming || !agentRef.current) return
    const userMsg: Message = { role: 'user', content: input.trim() }
    const history = [...messages, userMsg]
    setMessages(history)
    setInput('')
    setStreaming(true)

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

  function handleEndSession() {
    setPhase('skill-name')
  }

  function handleSkillSubmit() {
    if (!skillInput.trim() || !agentRef.current) return
    const a = agentRef.current
    const newParams = calcParamGrowth(a.params, a.type, Math.max(tokenCount, 500))
    setPrevParams({ ...a.params })

    const skill: Skill = {
      name: skillInput.trim(),
      description: `セッションを通じて獲得。${quest.slice(0, 20)}…`,
      earnedAt: a.totalTokens,
    }

    const updated: Agent = { ...a, params: newParams, skills: [...a.skills, skill] }
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
      router.push('/train')
    }
  }

  if (!agent) return null
  const config = AGENT_TYPES[agent.type]
  const progress = Math.min((agent.totalTokens / BIRTH_THRESHOLD) * 100, 100)
  const isBorn = agent.totalTokens >= BIRTH_THRESHOLD

  return (
    <div className="min-h-screen flex flex-col max-w-lg mx-auto px-4 py-6">

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
          style={{ background: config.bgColor }}
        >
          {config.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-base">{agent.name}</span>
            <span className="text-xs" style={{ color: config.color }}>{agent.type}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progress}%`, background: '#FFC300' }}
              />
            </div>
            <span className="text-xs shrink-0" style={{ color: '#64748B' }}>
              {agent.totalTokens.toLocaleString()} / {BIRTH_THRESHOLD.toLocaleString()} tokens
            </span>
          </div>
        </div>
      </div>

      {phase === 'chat' && (
        <>
          {/* Quest */}
          <div
            className="rounded-xl px-4 py-3 mb-4 text-sm"
            style={{ background: 'rgba(255,195,0,0.08)', border: '1px solid rgba(255,195,0,0.2)' }}
          >
            <span className="text-xs font-bold mr-2" style={{ color: '#FFC300' }}>TODAY&apos;s QUEST</span>
            <span style={{ color: '#D1D5DB' }}>{quest}</span>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto flex flex-col gap-3 mb-4 min-h-0 max-h-[calc(100vh-340px)]">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'assistant' && (
                  <div
                    className="w-6 h-6 rounded-lg flex items-center justify-center text-xs mr-2 mt-1 shrink-0"
                    style={{ background: config.bgColor }}
                  >
                    {config.emoji}
                  </div>
                )}
                <div
                  className="max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed"
                  style={{
                    background: m.role === 'user' ? 'rgba(255,195,0,0.15)' : 'rgba(255,255,255,0.06)',
                    borderBottomRightRadius: m.role === 'user' ? 4 : undefined,
                    borderBottomLeftRadius: m.role === 'assistant' ? 4 : undefined,
                  }}
                >
                  {m.content || (streaming && i === messages.length - 1 ? (
                    <span style={{ color: '#64748B' }}>考え中…</span>
                  ) : '')}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`${agent.name}に話しかける…`}
              disabled={streaming}
              className="flex-1 px-4 py-3 rounded-xl text-sm outline-none"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#F0F4FF',
              }}
            />
            <button
              onClick={sendMessage}
              disabled={streaming || !input.trim()}
              className="px-4 py-3 rounded-xl font-bold text-sm disabled:opacity-30 transition-all"
              style={{ background: '#FFC300', color: '#0A0F2C' }}
            >
              →
            </button>
          </div>

          {messages.length >= 3 && !streaming && (
            <button
              onClick={handleEndSession}
              className="mt-3 w-full py-3 rounded-xl text-sm transition-all hover:opacity-80"
              style={{ border: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8' }}
            >
              セッションを終わる
            </button>
          )}
        </>
      )}

      {phase === 'skill-name' && (
        <div className="flex-1 flex flex-col justify-center fade-in-up">
          <div className="text-center mb-8">
            <div className="text-4xl mb-4">{config.emoji}</div>
            <h2 className="text-lg font-bold mb-2">今日のセッションで何を学んだ？</h2>
            <p className="text-sm" style={{ color: '#64748B' }}>スキル名をつけてカードにしよう</p>
          </div>
          <div
            className="rounded-xl p-4 mb-6 text-sm"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <p className="text-xs mb-2" style={{ color: '#64748B' }}>今日のクエスト</p>
            <p style={{ color: '#94A3B8' }}>{quest}</p>
          </div>
          <input
            type="text"
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSkillSubmit()}
            placeholder="例：課題の言語化、優先順位の再設定…"
            maxLength={30}
            autoFocus
            className="w-full px-4 py-3 rounded-xl text-sm outline-none mb-4"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: `1px solid ${skillInput ? config.color : 'rgba(255,255,255,0.1)'}`,
              color: '#F0F4FF',
            }}
          />
          <button
            onClick={handleSkillSubmit}
            disabled={!skillInput.trim()}
            className="w-full py-4 rounded-xl font-bold text-base disabled:opacity-30 transition-all hover:scale-[1.02]"
            style={{ background: '#FFC300', color: '#0A0F2C' }}
          >
            スキルカードを生成 ✨
          </button>
        </div>
      )}

      {phase === 'skill-revealed' && earnedSkill && (
        <div className="flex-1 flex flex-col justify-center fade-in-up">
          <p className="text-xs text-center tracking-widest mb-6" style={{ color: '#FFC300' }}>SKILL UNLOCKED</p>

          <div
            className="rounded-2xl p-6 mb-6"
            style={{
              background: config.bgColor,
              border: `1px solid ${config.color}`,
              boxShadow: `0 0 24px ${config.color}33`,
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">{config.emoji}</span>
              <span className="text-xs font-bold tracking-wider" style={{ color: config.color }}>
                {agent.type}
              </span>
            </div>
            <h3 className="text-xl font-bold mb-1">{earnedSkill.name}</h3>
            <p className="text-xs" style={{ color: '#94A3B8' }}>{earnedSkill.description}</p>
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <p className="text-xs" style={{ color: '#64748B' }}>{agent.name} のスキル #{agent.skills.length}</p>
            </div>
          </div>

          {prevParams && (
            <div className="rounded-xl p-5 mb-6" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <p className="text-xs mb-4" style={{ color: '#64748B' }}>パラメーター上昇</p>
              <ParameterBar params={agent.params} prevParams={prevParams} accentColor={config.color} />
            </div>
          )}

          <div
            className="rounded-xl p-4 mb-6"
            style={{ background: 'rgba(255,195,0,0.08)', border: '1px solid rgba(255,195,0,0.15)' }}
          >
            <div className="flex justify-between text-xs mb-2">
              <span style={{ color: '#FFC300' }}>誕生まで</span>
              <span style={{ color: '#FFC300' }}>
                {isBorn ? '達成！🎉' : `残り ${(BIRTH_THRESHOLD - agent.totalTokens).toLocaleString()} tokens`}
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${progress}%`, background: '#FFC300' }}
              />
            </div>
          </div>

          <button
            onClick={handleContinue}
            className="w-full py-4 rounded-xl font-bold text-base transition-all hover:scale-[1.02]"
            style={{ background: '#FFC300', color: '#0A0F2C' }}
          >
            {isBorn ? '🎉 誕生！完全体へ' : '次のセッションへ →'}
          </button>
        </div>
      )}

      {phase === 'born' && (
        <div className="flex-1 flex flex-col items-center justify-center text-center fade-in-up">
          <div className="text-6xl mb-6">{config.emoji}</div>
          <p className="text-xs tracking-widest mb-3" style={{ color: '#FFC300' }}>AGENT COMPLETE</p>
          <h2 className="text-2xl font-bold mb-2">{agent.name}、誕生！</h2>
          <p className="text-sm mb-1" style={{ color: config.color }}>{agent.type}</p>
          <p className="text-sm mt-4 mb-2" style={{ color: '#94A3B8' }}>
            スキル {agent.skills.length} 個を習得
          </p>
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
