'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AGENT_TYPES } from '@/lib/quiz'
import { CATEGORIES, type Category } from '@/lib/categories'
import { KNOWLEDGE_TEMPLATES, type KnowledgeTemplate } from '@/lib/templates'
import {
  loadAgent, saveAgent, calcParamGrowth,
  saveDetectedTrait, PARAM_LABELS, TIER_COLORS, renderStars,
  BIRTH_THRESHOLD, type Agent, type Skill, type Message, type DetectedTrait, type SkillRank, type PersonalKnowledge,
} from '@/lib/agent'
import ParameterBar from '@/components/ParameterBar'

type Phase = 'category' | 'topic' | 'chat' | 'generating' | 'skill-confirm' | 'skill-revealed' | 'born'

interface SkillProposal {
  skillNameOptions: string[]
  summary: string
  keyPoints: string[]
  rank?: number
  content?: string
  personaTrait: { label: string; description: string } | null
  personalContext?: string | null
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
  const [skillNameCustom, setSkillNameCustom] = useState(false)
  const [earnedSkill, setEarnedSkill] = useState<Skill | null>(null)
  const [prevParams, setPrevParams] = useState<Agent['params'] | null>(null)
  const [addTrait, setAddTrait] = useState(true)
  const [newPersonaTrait, setNewPersonaTrait] = useState<DetectedTrait | null>(null)
  const [refUrl, setRefUrl] = useState('')
  const [refContent, setRefContent] = useState('')
  const [fetchingUrl, setFetchingUrl] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [topicMode, setTopicMode] = useState<'free' | 'template'>('free')
  const [selectedTemplate, setSelectedTemplate] = useState<KnowledgeTemplate | null>(null)
  const [newPersonalKnowledge, setNewPersonalKnowledge] = useState<PersonalKnowledge | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<HTMLTextAreaElement>(null)
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
    setTopicMode('free')
    setSelectedTemplate(null)
    setTopic('')
    setPhase('topic')
  }

  function handleTemplateSelect(tpl: KnowledgeTemplate) {
    const cat = CATEGORIES.find((c) => c.id === tpl.category) ?? CATEGORIES[CATEGORIES.length - 1]
    setSelectedCategory(cat)
    setSelectedTemplate(tpl)
    setTopic(tpl.topicHint)
    setRefContent(tpl.content)
    setRefUrl('')
    setTopicMode('template')
    setPhase('topic')
  }

  async function handleTopicConfirm() {
    if (!topic.trim() || !agentRef.current || !selectedCategory) return
    const a = agentRef.current
    const config = AGENT_TYPES[a.type]

    if (refUrl.trim()) {
      setFetchingUrl(true)
      setFetchError('')
      try {
        const res = await fetch('/api/fetch-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: refUrl.trim() }),
        })
        const data = await res.json()
        if (data.error) {
          setFetchError(data.error)
          setFetchingUrl(false)
          return
        }
        setRefContent(data.content)
      } catch {
        setFetchError('URLの取得に失敗しました')
        setFetchingUrl(false)
        return
      }
      setFetchingUrl(false)
    }

    const openings: Record<string, string> = {
      先読み型: `「${topic}」ですね。${config.emoji} まず具体的なシーンから入らせてください。最近これを実際に使った・判断した場面を一つ教えてもらえますか？`,
      設計型: `「${topic}」を体系化して覚えます！${config.emoji} まず直近でこれを使った場面を一つ教えてもらえますか？実際の状況から整理していきたいので。`,
      突破型: `「${topic}」！${config.emoji} 具体的な話から入ろう。最近これを使ったシーンを一つ教えて。どんな状況だった？`,
      共鳴型: `「${topic}」について教えてもらえるんですね。${config.emoji} これが特に役に立った・大切だと感じた場面はありますか？具体的なエピソードから聞かせてください。`,
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
    if (chatInputRef.current) {
      chatInputRef.current.style.height = 'auto'
    }
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
          refContent: refContent || undefined,
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
      setSkillName(proposal.skillNameOptions?.[0] ?? topic)
      setSkillNameCustom(false)
      setAddTrait(true)
      setPhase('skill-confirm')
    } catch {
      setSkillProposal({ skillNameOptions: [topic], summary: `${selectedCategory.label}の知識`, keyPoints: [], personaTrait: null })
      setSkillName(topic)
      setPhase('skill-confirm')
    }
  }

  function handleSkillConfirm() {
    if (!skillName.trim() || !agentRef.current || !skillProposal) return
    const a = agentRef.current
    const newParams = calcParamGrowth(a.params, a.type, Math.max(tokenCount, 500), selectedCategory?.id)
    setPrevParams({ ...a.params })

    const rawRank = skillProposal.rank
    const skill: Skill = {
      name: skillName.trim(),
      description: skillProposal.summary,
      earnedAt: a.totalTokens,
      rank: (rawRank && rawRank >= 1 && rawRank <= 5) ? rawRank as SkillRank : undefined,
      content: skillProposal.content,
    }

    // 固有知識の抽出・保存
    let newPk: PersonalKnowledge | null = null
    if (skillProposal.personalContext) {
      newPk = {
        summary: skillProposal.personalContext,
        linkedSkillName: skillName.trim(),
        detectedAt: new Date().toISOString(),
      }
      setNewPersonalKnowledge(newPk)
    }

    const newTraits = [...(a.personaTraits ?? [])]
    const pt = skillProposal.personaTrait

    if (pt) {
      const detected: DetectedTrait = { label: pt.label, description: pt.description, detectedAt: new Date().toISOString() }
      saveDetectedTrait(detected)
      if (addTrait && !newTraits.includes(pt.label)) {
        newTraits.push(pt.label)
        setNewPersonaTrait(detected)
      }
    }

    const updatedPk = newPk
      ? [...(a.personalKnowledge ?? []), newPk]
      : (a.personalKnowledge ?? [])
    const updated: Agent = { ...a, params: newParams, skills: [...a.skills, skill], personaTraits: newTraits, personalKnowledge: updatedPk }
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
      setSkillNameCustom(false)
      setEarnedSkill(null)
      setPrevParams(null)
      setNewPersonaTrait(null)
      setRefUrl('')
      setRefContent('')
      setFetchError('')
      setTopicMode('free')
      setSelectedTemplate(null)
      setNewPersonalKnowledge(null)
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
          {/* テンプレートから始める */}
          <div className="mb-6 rounded-xl p-4" style={{ background: 'rgba(255,195,0,0.06)', border: '1px solid rgba(255,195,0,0.2)' }}>
            <p className="text-xs font-bold mb-1" style={{ color: '#FFC300' }}>📚 フレームワークから始める</p>
            <p className="text-xs mb-3" style={{ color: '#64748B' }}>知識がなくてもOK。世の中のフレームワークをベースに自分流を教え込む</p>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {KNOWLEDGE_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => handleTemplateSelect(tpl)}
                  className="flex-shrink-0 text-left px-3 py-2.5 rounded-xl border transition-all"
                  style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,195,0,0.25)', minWidth: '140px', maxWidth: '160px' }}
                >
                  <div className="text-lg mb-1">{tpl.emoji}</div>
                  <div className="text-xs font-bold leading-tight mb-1" style={{ color: '#F0F4FF' }}>{tpl.name}</div>
                  <div className="text-xs leading-tight" style={{ color: '#64748B' }}>{tpl.tagline}</div>
                </button>
              ))}
            </div>
          </div>

          <p className="text-sm font-bold mb-1">自分の知識を教える</p>
          <p className="text-xs mb-5" style={{ color: '#64748B' }}>
            カテゴリを選んで {agent.name} に知識・視点を入れ込む
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
                <div className="text-xs leading-relaxed mb-2" style={{ color: '#64748B' }}>{cat.description}</div>
                <div className="flex gap-1 flex-wrap">
                  {cat.paramBoosts.map((param) => (
                    <span
                      key={param}
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(255,195,0,0.12)', color: '#FFC300' }}
                    >
                      {PARAM_LABELS[param]}↑
                    </span>
                  ))}
                </div>
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
          <p className="text-sm mb-4" style={{ color: '#64748B' }}>何を教え込みたい？</p>

          {/* テンプレートモードバナー */}
          {topicMode === 'template' && selectedTemplate && (
            <div className="rounded-xl px-4 py-3 mb-4 text-xs" style={{ background: 'rgba(255,195,0,0.08)', border: '1px solid rgba(255,195,0,0.25)' }}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold" style={{ color: '#FFC300' }}>{selectedTemplate.emoji} {selectedTemplate.name}</span>
                <button
                  onClick={() => { setTopicMode('free'); setSelectedTemplate(null); setRefContent(''); setTopic('') }}
                  className="text-xs" style={{ color: '#64748B' }}
                >
                  ✕ 解除
                </button>
              </div>
              <p style={{ color: '#94A3B8' }}>フレームワークの基礎知識をベースに、あなた流のアレンジを教え込みます</p>
            </div>
          )}

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

          {/* Reference URL */}
          <div className="mb-4">
            <p className="text-xs mb-2" style={{ color: '#4A5568' }}>📎 参考URLを追加（任意）</p>
            <input
              type="url"
              value={refUrl}
              onChange={(e) => { setRefUrl(e.target.value); setFetchError('') }}
              placeholder="https://..."
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${refContent ? 'rgba(72,187,120,0.4)' : 'rgba(255,255,255,0.08)'}`,
                color: '#F0F4FF',
              }}
            />
            {refContent && (
              <p className="text-xs mt-1.5" style={{ color: '#48BB78' }}>
                ✅ {refContent.length.toLocaleString()}文字取得済み
              </p>
            )}
            {fetchError && (
              <p className="text-xs mt-1.5" style={{ color: '#FC8181' }}>{fetchError}</p>
            )}
          </div>

          <button
            onClick={handleTopicConfirm}
            disabled={!topic.trim() || fetchingUrl}
            className="w-full py-4 rounded-xl font-bold text-base disabled:opacity-30 transition-all hover:scale-[1.02]"
            style={{ background: '#FFC300', color: '#0A0F2C' }}
          >
            {fetchingUrl ? 'URL取得中…' : 'セッション開始 →'}
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

          <div className="flex gap-2 items-end">
            <textarea
              ref={chatInputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                const el = e.target
                el.style.height = 'auto'
                el.style.height = Math.min(el.scrollHeight, 120) + 'px'
              }}
              onKeyDown={handleKeyDown}
              placeholder={`${agent.name}に教える…`}
              disabled={streaming}
              rows={1}
              className="flex-1 px-4 py-3 rounded-xl outline-none resize-none"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#F0F4FF',
                lineHeight: '1.5',
                minHeight: '44px',
                maxHeight: '120px',
                overflowY: 'auto',
              }}
            />
            <button
              onClick={sendMessage}
              disabled={streaming || !input.trim()}
              className="px-4 rounded-xl font-bold text-sm disabled:opacity-30 shrink-0"
              style={{ background: '#FFC300', color: '#0A0F2C', height: '44px' }}
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

          {/* Key points preview */}
          <div className="rounded-2xl p-5 mb-5" style={{ background: config.bgColor, border: `1px solid ${config.color}` }}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">{config.emoji}</span>
              <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.1)', color: config.color }}>
                {selectedCategory?.label}
              </span>
            </div>
            <p className="text-xs mb-3" style={{ color: '#94A3B8' }}>{skillProposal.summary}</p>
            {skillProposal.keyPoints.length > 0 && (
              <ul className="space-y-1.5">
                {skillProposal.keyPoints.map((pt, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs" style={{ color: '#D1D5DB' }}>
                    <span style={{ color: config.color }}>▸</span>{pt}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Skill name selection */}
          <p className="text-xs font-bold mb-3" style={{ color: '#64748B' }}>スキル名を選ぶ</p>
          <div className="flex flex-col gap-2 mb-3">
            {skillProposal.skillNameOptions.map((name, i) => (
              <button
                key={i}
                onClick={() => { setSkillName(name); setSkillNameCustom(false) }}
                className="w-full px-4 py-3 rounded-xl text-sm text-left font-bold transition-all"
                style={{
                  background: skillName === name && !skillNameCustom ? config.bgColor : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${skillName === name && !skillNameCustom ? config.color : 'rgba(255,255,255,0.1)'}`,
                  color: skillName === name && !skillNameCustom ? '#F0F4FF' : '#94A3B8',
                }}
              >
                {name}
              </button>
            ))}
            <button
              onClick={() => { setSkillNameCustom(true); setSkillName('') }}
              className="w-full px-4 py-3 rounded-xl text-sm text-left transition-all"
              style={{
                background: skillNameCustom ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${skillNameCustom ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.08)'}`,
                color: '#64748B',
              }}
            >
              ✏️ 自分で入力する
            </button>
          </div>
          {skillNameCustom && (
            <input
              type="text"
              value={skillName}
              onChange={(e) => setSkillName(e.target.value)}
              maxLength={20}
              autoFocus
              placeholder="スキル名を入力…"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none mb-3"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: `1px solid ${skillName ? config.color : 'rgba(255,255,255,0.1)'}`,
                color: '#F0F4FF',
              }}
            />
          )}

          {/* Persona trait toggle */}
          {skillProposal.personaTrait && (
            <button
              onClick={() => setAddTrait((v) => !v)}
              className="w-full rounded-xl px-4 py-3 mb-5 text-xs text-left transition-all"
              style={{
                background: addTrait ? 'rgba(72,187,120,0.08)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${addTrait ? 'rgba(72,187,120,0.3)' : 'rgba(255,255,255,0.08)'}`,
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <p className="font-bold" style={{ color: addTrait ? '#48BB78' : '#4A5568' }}>
                  🧬 行動特性を検出：{skillProposal.personaTrait.label}
                </p>
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{
                    background: addTrait ? '#48BB78' : 'rgba(255,255,255,0.08)',
                    color: addTrait ? '#0A0F2C' : '#64748B',
                  }}
                >
                  {addTrait ? '付与する ✓' : '付与しない'}
                </span>
              </div>
              <p style={{ color: '#64748B' }}>{skillProposal.personaTrait.description}</p>
            </button>
          )}

          <button
            onClick={handleSkillConfirm}
            disabled={!skillName.trim()}
            className="w-full py-4 rounded-xl font-bold text-base disabled:opacity-30 transition-all hover:scale-[1.02]"
            style={{ background: '#FFC300', color: '#0A0F2C' }}
          >
            確定 ✨
          </button>
        </div>
      )}

      {/* Skill revealed */}
      {phase === 'skill-revealed' && earnedSkill && (
        <div className="flex-1 flex flex-col justify-center fade-in-up">
          <p className="text-xs text-center tracking-widest mb-5" style={{ color: '#FFC300' }}>SKILL UNLOCKED</p>

          <div
            className="rounded-2xl p-6 mb-5 skill-unlock glow-pulse"
            style={{ background: config.bgColor, border: `1px solid ${config.color}` }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{config.emoji}</span>
                <span className="text-xs font-bold" style={{ color: config.color }}>{agent.type}</span>
              </div>
              <div className="flex items-center gap-2">
                {earnedSkill.rank && (
                  <span className="text-sm tracking-tight" style={{ color: '#FFC300' }}>
                    {renderStars(earnedSkill.rank)}
                  </span>
                )}
                <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.08)', color: '#64748B' }}>
                  #{agent.skills.length}
                </span>
              </div>
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
            <div className="rounded-xl px-4 py-3 mb-3 text-xs fade-in-up" style={{ background: 'rgba(72,187,120,0.08)', border: '1px solid rgba(72,187,120,0.25)' }}>
              <p className="font-bold mb-1" style={{ color: '#48BB78' }}>🧬 ペルソナに追加：{newPersonaTrait.label}</p>
              <p style={{ color: '#94A3B8' }}>{newPersonaTrait.description}</p>
            </div>
          )}

          {/* Personal knowledge */}
          {newPersonalKnowledge && (
            <div className="rounded-xl px-4 py-3 mb-5 text-xs fade-in-up" style={{ background: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.15)' }}>
              <p className="font-bold mb-1" style={{ color: '#94A3B8' }}>🔒 固有知識として記録：</p>
              <p style={{ color: '#64748B' }}>{newPersonalKnowledge.summary}</p>
              <p className="mt-1" style={{ color: '#4A5568' }}>スキルとは別軸で管理。共有時には除外されます</p>
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
