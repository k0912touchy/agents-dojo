'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AGENT_TYPES, type AgentType } from '@/lib/quiz'
import {
  loadAgent, loadAgentArchive, calcAgentTier, renderStars, TIER_COLORS,
  type Agent,
} from '@/lib/agent'

type ExportTarget = 'claude' | 'gpt'

const PERSONALITY: Record<AgentType, string> = {
  先読み型: '知的で分析的。先を見越した視点でアドバイスし、「つまり〜ということですね」という口調で本質を整理します。',
  設計型: '体系的で整理好き。「ステップで言うと」「構造化すると」という口調で、物事を整理してから答えます。',
  突破型: '前のめりで実行重視。「まずやってみよう」「具体的に言うと」という口調で、即行動できる答えを出します。',
  共鳴型: '共感的で丁寧。「深いですね」「その視点から言うと」という口調で、相手の状況に寄り添った回答をします。',
}

function generateSystemPrompt(agent: Agent, target: ExportTarget): string {
  const skillsText = agent.skills
    .map((skill) => {
      const stars = skill.rank ? ' ' + '★'.repeat(skill.rank) : ''
      let text = `### ${skill.name}${stars}\n${skill.description}\n`
      if (skill.content) {
        text += '\n' + skill.content.replace(/\\n/g, '\n') + '\n'
      }
      return text
    })
    .join('\n---\n\n')

  const traitsText =
    agent.personaTraits.length > 0
      ? `\n## 思考・行動特性\n${agent.personaTraits.map((t) => `- ${t}`).join('\n')}\n`
      : ''

  const intro =
    target === 'claude'
      ? `あなたは「${agent.name}」というAIエージェントです。${agent.type}として、以下の専門スキルと知識を持っています。ユーザーの質問に対して、これらのスキルの判断軸・プロセス・メンタルモデルを活用して回答してください。`
      : `You are「${agent.name}」, a specialized AI agent with the ${agent.type} profile. Use the skills and knowledge below to answer user questions with expertise.`

  return `${intro}

## 専門スキル（${agent.skills.length}個）

${skillsText}${traitsText}
## 応答スタイル
${PERSONALITY[agent.type] ?? '専門的かつ実践的に回答します。'}
- 具体的なシーン・状況に基づいてアドバイスする
- 習得したスキルの判断軸・プロセスを活用して答える
- 一般論より、このエージェントが学んだ独自の視点・経験則を優先する
- 個人情報・機密情報を含む回答はしない（固有知識は学習外）`
}

const CLAUDE_STEPS = [
  { num: '01', text: 'claude.ai を開き、左サイドバーの「Projects」をクリック' },
  { num: '02', text: '「New project」→ プロジェクト名を入力して作成' },
  { num: '03', text: '「Project instructions」に上記のプロンプトを貼り付けて保存' },
]

const GPT_STEPS = [
  { num: '01', text: 'chatgpt.com を開き、「Explore GPTs」→「Create」をクリック' },
  { num: '02', text: '「Configure」タブ → Name にエージェント名を入力' },
  { num: '03', text: '「Instructions」に上記のプロンプトを貼り付けて「Save」' },
]

function ExportModal({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const [target, setTarget] = useState<ExportTarget>('claude')
  const [copied, setCopied] = useState(false)
  const prompt = generateSystemPrompt(agent, target)

  function handleCopy() {
    navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const steps = target === 'claude' ? CLAUDE_STEPS : GPT_STEPS

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'rgba(7,12,31,0.97)' }}
    >
      <div className="flex items-center justify-between px-4 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div>
          <p className="text-xs tracking-widest mb-0.5" style={{ color: '#FFC300' }}>DEPLOY AGENT</p>
          <h2 className="font-bold text-base">{agent.name} を使う</h2>
        </div>
        <button onClick={onClose} className="text-xl px-2" style={{ color: '#64748B' }}>✕</button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        {/* Tab */}
        <div className="flex gap-2 mb-5">
          {(['claude', 'gpt'] as ExportTarget[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTarget(t); setCopied(false) }}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={{
                background: target === t ? '#FFC300' : 'rgba(255,255,255,0.05)',
                color: target === t ? '#0A0F2C' : '#64748B',
                border: target === t ? 'none' : '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {t === 'claude' ? '🟠 Claude Projects' : '🟢 Custom GPT'}
            </button>
          ))}
        </div>

        {/* Prompt box */}
        <div className="rounded-xl mb-4 overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="flex items-center justify-between px-4 py-2.5" style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-xs font-bold" style={{ color: '#64748B' }}>システムプロンプト</p>
            <p className="text-xs" style={{ color: '#4A5568' }}>{prompt.length.toLocaleString()} 文字</p>
          </div>
          <div className="px-4 py-3 max-h-48 overflow-y-auto">
            <pre className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: '#94A3B8', fontFamily: 'monospace' }}>
              {prompt.slice(0, 600)}{prompt.length > 600 ? '\n…（以下省略）' : ''}
            </pre>
          </div>
        </div>

        <button
          onClick={handleCopy}
          className="w-full py-4 rounded-xl font-bold text-base transition-all hover:scale-[1.02] mb-6"
          style={{ background: copied ? '#48BB78' : '#FFC300', color: '#0A0F2C' }}
        >
          {copied ? '✅ コピーしました！' : '📋 プロンプト全文をコピー'}
        </button>

        {/* Steps guide */}
        <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-xs font-bold mb-4 tracking-widest" style={{ color: '#64748B' }}>
            {target === 'claude' ? 'Claude Projects への設定方法' : 'Custom GPT への設定方法'}
          </p>
          <div className="flex flex-col gap-4">
            {steps.map(({ num, text }) => (
              <div key={num} className="flex gap-3 items-start">
                <div className="text-xs font-black shrink-0 w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,195,0,0.1)', color: '#FFC300' }}>{num}</div>
                <p className="text-sm leading-relaxed" style={{ color: '#94A3B8' }}>{text}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 text-xs leading-relaxed" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', color: '#4A5568' }}>
            💡 設定後は「{agent.name}に聞く」感覚で使えます。スキルを追加するたびにプロンプトを更新するとエージェントが賢くなります。
          </div>
        </div>
      </div>
    </div>
  )
}

function AgentCard({
  agent,
  isActive,
  onUse,
  onView,
}: {
  agent: Agent
  isActive: boolean
  onUse: () => void
  onView: () => void
}) {
  const config = AGENT_TYPES[agent.type]
  const tier = calcAgentTier(agent)
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${isActive ? config.color + '55' : 'rgba(255,255,255,0.08)'}`, background: isActive ? config.bgColor : 'rgba(255,255,255,0.03)' }}>
      {/* Header */}
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0" style={{ background: isActive ? 'rgba(255,255,255,0.1)' : config.bgColor }}>
            {config.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="font-bold text-base truncate">{agent.name}</p>
              <span className="text-xs font-black px-2 py-0.5 rounded shrink-0"
                style={{ background: `${TIER_COLORS[tier]}22`, color: TIER_COLORS[tier], border: `1px solid ${TIER_COLORS[tier]}55` }}>
                {tier}
              </span>
              {isActive && (
                <span className="text-xs px-2 py-0.5 rounded shrink-0" style={{ background: 'rgba(255,195,0,0.2)', color: '#FFC300' }}>育成中</span>
              )}
            </div>
            <p className="text-xs" style={{ color: config.color }}>{agent.type}</p>
          </div>
        </div>

        <div className="flex gap-4 text-xs mb-4">
          <div>
            <p className="mb-0.5" style={{ color: '#64748B' }}>スキル</p>
            <p className="font-bold">{agent.skills.length}個</p>
          </div>
          <div>
            <p className="mb-0.5" style={{ color: '#64748B' }}>行動特性</p>
            <p className="font-bold">{agent.personaTraits.length}件</p>
          </div>
          <div>
            <p className="mb-0.5" style={{ color: '#64748B' }}>累計tokens</p>
            <p className="font-bold">{agent.totalTokens.toLocaleString()}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onUse}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.01]"
            style={{ background: '#FFC300', color: '#0A0F2C' }}
          >
            このエージェントを使う →
          </button>
          <button
            onClick={onView}
            className="px-4 py-2.5 rounded-xl text-sm transition-all"
            style={{ border: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8' }}
          >
            詳細
          </button>
        </div>
      </div>

      {/* Skills list */}
      {agent.skills.length > 0 && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-xs"
            style={{ color: '#64748B' }}
          >
            <span>スキル一覧</span>
            <span>{expanded ? '▲' : '▼'}</span>
          </button>
          {expanded && (
            <div className="px-4 pb-4 flex flex-col gap-2">
              {agent.skills.map((skill, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{skill.name}</p>
                    <p className="text-xs truncate" style={{ color: '#64748B' }}>{skill.description}</p>
                  </div>
                  {skill.rank && (
                    <span className="text-xs shrink-0" style={{ color: '#FFC300' }}>{renderStars(skill.rank)}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function LibraryPage() {
  const router = useRouter()
  const [activeAgent, setActiveAgent] = useState<Agent | null>(null)
  const [archivedAgents, setArchivedAgents] = useState<Agent[]>([])
  const [exportAgent, setExportAgent] = useState<Agent | null>(null)

  useEffect(() => {
    setActiveAgent(loadAgent())
    setArchivedAgents(loadAgentArchive())
  }, [])

  const allAgents = [
    ...(activeAgent ? [activeAgent] : []),
    ...archivedAgents.filter((a) => a.name !== activeAgent?.name || a.type !== activeAgent?.type),
  ]

  return (
    <div className="min-h-screen max-w-lg mx-auto px-4 py-6">
      <button onClick={() => router.back()} className="flex items-center gap-1 text-xs mb-6" style={{ color: '#64748B' }}>
        ← 戻る
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">マイエージェント</h1>
          <p className="text-xs mt-1" style={{ color: '#64748B' }}>{allAgents.length}体のエージェント</p>
        </div>
      </div>

      {allAgents.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-4xl mb-4">⚔️</p>
          <p className="text-sm mb-1" style={{ color: '#94A3B8' }}>まだエージェントがいません</p>
          <p className="text-xs mb-6" style={{ color: '#4A5568' }}>最初のエージェントを育ててみよう</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 rounded-xl font-bold text-sm"
            style={{ background: '#FFC300', color: '#0A0F2C' }}
          >
            エージェントを作る →
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {allAgents.map((agent, i) => (
            <AgentCard
              key={`${agent.name}-${i}`}
              agent={agent}
              isActive={agent.name === activeAgent?.name && agent.type === activeAgent?.type}
              onUse={() => setExportAgent(agent)}
              onView={() => {
                if (agent.name === activeAgent?.name) router.push('/agent')
              }}
            />
          ))}
        </div>
      )}

      {exportAgent && (
        <ExportModal agent={exportAgent} onClose={() => setExportAgent(null)} />
      )}
    </div>
  )
}
