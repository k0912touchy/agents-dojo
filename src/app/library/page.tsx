'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AGENT_TYPES, type AgentType } from '@/lib/quiz'
import {
  loadAgent, loadAgentArchive, calcAgentTier, renderStars, TIER_COLORS, PARAM_LABELS,
  type Agent,
} from '@/lib/agent'

type ExportTarget = 'claude' | 'gpt' | 'markdown' | 'claudecode' | 'mcp'

const PERSONALITY: Record<AgentType, string> = {
  先読み型: '知的で分析的。先を見越した視点でアドバイスし、「つまり〜ということですね」という口調で本質を整理します。',
  設計型: '体系的で整理好き。「ステップで言うと」「構造化すると」という口調で、物事を整理してから答えます。',
  突破型: '前のめりで実行重視。「まずやってみよう」「具体的に言うと」という口調で、即行動できる答えを出します。',
  共鳴型: '共感的で丁寧。「深いですね」「その視点から言うと」という口調で、相手の状況に寄り添った回答をします。',
}

function expandContent(raw: string): string {
  return raw.replace(/\\n/g, '\n')
}

function prepareAgent(agent: Agent): Omit<Agent, 'personalKnowledge'> {
  const { personalKnowledge: _pk, ...rest } = agent
  return {
    ...rest,
    skills: agent.skills
      .filter((s) => !s.isPrivate)
      .map((s) => ({ ...s, content: s.content ? expandContent(s.content) : s.content })),
  }
}

// ---- content generators ----

function generateSystemPrompt(agent: Agent, target: ExportTarget): string {
  const skillsText = agent.skills
    .map((skill) => {
      const stars = skill.rank ? ' ' + '★'.repeat(skill.rank) : ''
      let text = `### ${skill.name}${stars}\n${skill.description}\n`
      if (skill.content) text += '\n' + expandContent(skill.content) + '\n'
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
      : `You are「${agent.name}」, a specialized AI agent (${agent.type}). Use the skills and frameworks below to answer questions with expertise.`
  return `${intro}\n\n## 専門スキル（${agent.skills.length}個）\n\n${skillsText}${traitsText}\n## 応答スタイル\n${PERSONALITY[agent.type] ?? '専門的かつ実践的に回答します。'}\n- 具体的なシーン・状況に基づいてアドバイスする\n- 習得したスキルの判断軸・プロセスを活用して答える\n- 一般論より、このエージェントが学んだ独自の視点・経験則を優先する\n- 個人情報・機密情報を含む回答はしない`
}

function generateMarkdown(agent: Agent): string {
  const tier = calcAgentTier(agent)
  const date = new Date().toISOString().slice(0, 10)
  const skillsText = agent.skills
    .map((skill, i) => {
      const stars = skill.rank ? '★'.repeat(skill.rank) + '☆'.repeat(5 - skill.rank) : ''
      let text = `### ${i + 1}. ${skill.name}${stars ? `　${stars}` : ''}\n\n> ${skill.description}\n\n`
      if (skill.content) text += expandContent(skill.content) + '\n\n'
      return text
    })
    .join('---\n\n')
  const traitsText =
    agent.personaTraits.length > 0
      ? `## 行動・思考特性\n\n${agent.personaTraits.map((t) => `- **${t}**`).join('\n')}\n\n`
      : ''
  const paramsText = Object.entries(agent.params)
    .map(([key, val]) => `| ${PARAM_LABELS[key] ?? key} | ${'█'.repeat(Math.floor(val / 10))}${'░'.repeat(10 - Math.floor(val / 10))} ${val}/99 |`)
    .join('\n')
  return `# ${agent.name} — ${agent.type}（${tier}ティア）\n\n> Agents DOJO で育成されたAIエージェント\n> 累計 ${agent.totalTokens.toLocaleString()} tokens ｜ スキル ${agent.skills.length}個 ｜ 行動特性 ${agent.personaTraits.length}件\n> エクスポート日：${date}\n\n---\n\n## スキル一覧\n\n${skillsText}${traitsText}## パラメーター\n\n| パラメーター | 値 |\n|---|---|\n${paramsText}\n\n---\n\n## 応答スタイル\n\n${PERSONALITY[agent.type] ?? '専門的かつ実践的に回答します。'}\n\n---\n\n*このファイルは [Agents DOJO](https://agents-dojo-web.vercel.app) から生成されました*\n`
}

function generateClaudeCodeMd(agent: Agent): string {
  const tier = calcAgentTier(agent)
  const date = new Date().toISOString().slice(0, 10)
  const skillsText = agent.skills
    .map((skill) => {
      const stars = skill.rank ? `（${'★'.repeat(skill.rank)}）` : ''
      let text = `### ${skill.name}${stars}\n\n${skill.description}\n\n`
      if (skill.content) text += expandContent(skill.content) + '\n\n'
      return text
    })
    .join('---\n\n')
  const traitsText =
    agent.personaTraits.length > 0
      ? `## 思考・行動特性\n\n${agent.personaTraits.map((t) => `- ${t}`).join('\n')}\n\n`
      : ''
  return `# ${agent.name}のナレッジ（Agents DOJO）\n\nこのファイルは **${agent.name}**（${agent.type} / ${tier}ティア）のスキルと知識の記録です。\nClaude Codeはこの内容を参照して、このエージェントの専門知識・判断軸・思考パターンで応答します。\nエクスポート日：${date}\n\n---\n\n## 専門スキル\n\n${skillsText}${traitsText}## 応答スタイル\n\n${PERSONALITY[agent.type] ?? '専門的かつ実践的に回答します。'}\n- 具体的なシーン・状況に基づいてアドバイスする\n- 一般論より、このエージェントが学んだ独自の視点・経験則を優先する\n- 個人情報・機密情報を含む回答はしない\n`
}

function generateMcpServer(agent: Agent): string {
  const prepared = prepareAgent(agent)
  const jsonStr = JSON.stringify(prepared)
  // base64 encode for safe embedding (handles all Unicode / special chars)
  const bytes: number[] = []
  for (let i = 0; i < jsonStr.length; i++) {
    const cp = jsonStr.charCodeAt(i)
    if (cp < 0x80) {
      bytes.push(cp)
    } else if (cp < 0x800) {
      bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f))
    } else {
      bytes.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f))
    }
  }
  const b64 = btoa(String.fromCharCode(...bytes))
  const safeName = agent.name.toLowerCase().replace(/[^\w]/g, '-')

  return `#!/usr/bin/env node
// Agents DOJO MCP Server — ${agent.name}
// Generated: ${new Date().toISOString().slice(0, 10)}
//
// セットアップ:
//   mkdir -p ~/.agents-dojo
//   mv このファイル ~/.agents-dojo/${safeName}-mcp.js
//   claude mcp add ${safeName} -s user -- node ~/.agents-dojo/${safeName}-mcp.js
//
// 確認: Claude Code で /mcp と入力

'use strict';
var readline = require('readline');

var AGENT = JSON.parse(Buffer.from('${b64}', 'base64').toString('utf-8'));

var TOOLS = [
  {
    name: 'get_agent_profile',
    description: AGENT.name + 'のプロフィール・タイプ・行動特性・パラメーターを取得',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'get_skills',
    description: AGENT.name + 'が持つスキルの一覧（名前・説明・ランク）を取得',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'get_skill_detail',
    description: '特定スキルの詳細（判断軸・プロセス・メンタルモデル）を取得',
    inputSchema: {
      type: 'object',
      properties: { skill_name: { type: 'string', description: 'スキル名（部分一致で検索）' } },
      required: ['skill_name']
    }
  },
  {
    name: 'search_skills',
    description: AGENT.name + 'のスキルをキーワードで検索',
    inputSchema: {
      type: 'object',
      properties: { keyword: { type: 'string', description: '検索キーワード' } },
      required: ['keyword']
    }
  }
];

function callTool(name, args) {
  switch (name) {
    case 'get_agent_profile':
      return { name: AGENT.name, type: AGENT.type, totalTokens: AGENT.totalTokens,
               personaTraits: AGENT.personaTraits, params: AGENT.params, skillCount: AGENT.skills.length };
    case 'get_skills':
      return AGENT.skills.map(function(s) {
        return { name: s.name, description: s.description, rank: s.rank ? '\\u2605'.repeat(s.rank) : null };
      });
    case 'get_skill_detail': {
      var q = (args.skill_name || '').toLowerCase();
      var skill = AGENT.skills.find(function(s) { return s.name.toLowerCase().indexOf(q) !== -1; });
      if (!skill) return { error: 'Not found: ' + args.skill_name };
      return { name: skill.name, description: skill.description, rank: skill.rank, content: skill.content || '' };
    }
    case 'search_skills': {
      var kw = (args.keyword || '').toLowerCase();
      return AGENT.skills.filter(function(s) {
        return s.name.toLowerCase().indexOf(kw) !== -1 ||
               s.description.toLowerCase().indexOf(kw) !== -1 ||
               (s.content || '').toLowerCase().indexOf(kw) !== -1;
      }).map(function(s) { return { name: s.name, description: s.description }; });
    }
    default: return { error: 'Unknown tool: ' + name };
  }
}

var rl = readline.createInterface({ input: process.stdin, terminal: false });
rl.on('line', function(line) {
  line = line.trim();
  if (!line) return;
  var msg;
  try { msg = JSON.parse(line); } catch(e) { return; }
  var res;
  if (msg.method === 'initialize') {
    res = { jsonrpc: '2.0', id: msg.id, result: {
      protocolVersion: '2024-11-05', capabilities: { tools: {} },
      serverInfo: { name: 'agents-dojo-${safeName}', version: '1.0.0' }
    }};
  } else if (msg.method === 'tools/list') {
    res = { jsonrpc: '2.0', id: msg.id, result: { tools: TOOLS } };
  } else if (msg.method === 'tools/call') {
    var result = callTool(msg.params.name, msg.params.arguments || {});
    res = { jsonrpc: '2.0', id: msg.id, result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }};
  } else if (msg.method && msg.method.indexOf('notifications/') === 0) {
    return;
  } else if (msg.id !== undefined) {
    res = { jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: 'Method not found' } };
  } else { return; }
  process.stdout.write(JSON.stringify(res) + '\\n');
});
process.stderr.write('[Agents DOJO MCP] ${agent.name} ready\\n');
`
}

function downloadFile(content: string, filename: string, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ---- export modal ----

const TABS: { id: ExportTarget; label: string; icon: string }[] = [
  { id: 'claude', label: 'Claude Projects', icon: '🟠' },
  { id: 'gpt', label: 'Custom GPT', icon: '🟢' },
  { id: 'markdown', label: 'Markdown', icon: '📝' },
  { id: 'claudecode', label: 'CLAUDE.md', icon: '⌨️' },
  { id: 'mcp', label: 'MCP Server', icon: '🔌' },
]

type SetupInfo = { title: string; steps: { num: string; text: string }[]; tip: string }

function getSetup(target: ExportTarget, agentName: string, safeName: string): SetupInfo {
  const map: Record<ExportTarget, SetupInfo> = {
    claude: {
      title: 'Claude Projects への設定方法',
      steps: [
        { num: '01', text: 'claude.ai → Projects → New project' },
        { num: '02', text: 'Project instructions に上記プロンプトを貼り付けて保存' },
        { num: '03', text: 'プロジェクト内のチャットで自動適用される' },
      ],
      tip: `スキルが増えたらプロンプトを更新するだけで${agentName}がさらに賢くなります。`,
    },
    gpt: {
      title: 'Custom GPT への設定方法',
      steps: [
        { num: '01', text: 'chatgpt.com → Explore GPTs → Create → Configure タブ' },
        { num: '02', text: 'Instructions に上記プロンプトを貼り付けて Save' },
        { num: '03', text: 'Knowledge にMarkdownファイルをアップロードするとさらに精度↑' },
      ],
      tip: 'Name に agentName を設定しておくと区別しやすいです。',
    },
    markdown: {
      title: 'Markdownファイルの活用',
      steps: [
        { num: '01', text: 'Notion / Obsidian に貼り付けてナレッジ管理' },
        { num: '02', text: 'Custom GPT の Knowledge にアップロードしてRAG活用' },
        { num: '03', text: 'チームに共有してエージェントの専門知識を横展開' },
      ],
      tip: 'スキルが増えるたびに再エクスポートすると最新ナレッジが反映されます。',
    },
    claudecode: {
      title: 'Claude Code CLAUDE.md への設定',
      steps: [
        { num: '01', text: '~/.claude/CLAUDE.md に保存 → 全プロジェクトで有効' },
        { num: '02', text: 'プロジェクトルートの CLAUDE.md に追記 → そのプロジェクト専用' },
        { num: '03', text: 'Claude Code のセッション開始時に自動で読み込まれる' },
      ],
      tip: '複数エージェントのファイルを組み合わせるとClaude Codeの専門知識を積み上げられます。',
    },
    mcp: {
      title: 'Claude Code MCP Server のセットアップ',
      steps: [
        { num: '01', text: `ファイルを保存: mkdir -p ~/.agents-dojo && mv ${safeName}-mcp.js ~/.agents-dojo/` },
        { num: '02', text: `MCP登録: claude mcp add ${safeName} -s user -- node ~/.agents-dojo/${safeName}-mcp.js` },
        { num: '03', text: 'Claude Code で /mcp と入力して接続確認 → 4つのツールが使えます' },
      ],
      tip: 'スキルが増えたらファイルを再ダウンロードして置き換えるだけで最新化できます。',
    },
  }
  return { ...map[target], tip: map[target].tip.replace('agentName', agentName) }
}

function ExportModal({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const [target, setTarget] = useState<ExportTarget>('claude')
  const [copied, setCopied] = useState(false)
  const [downloaded, setDownloaded] = useState(false)
  const safeName = agent.name.toLowerCase().replace(/[^\w]/g, '-')

  const isDownloadable = target === 'markdown' || target === 'claudecode' || target === 'mcp'

  const content =
    target === 'markdown' ? generateMarkdown(agent)
    : target === 'claudecode' ? generateClaudeCodeMd(agent)
    : target === 'mcp' ? generateMcpServer(agent)
    : generateSystemPrompt(agent, target)

  const setup = getSetup(target, agent.name, safeName)

  const mcpCommand = `claude mcp add ${safeName} -s user -- node ~/.agents-dojo/${safeName}-mcp.js`

  function handleCopy() {
    const text = target === 'mcp' ? mcpCommand : content
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleDownload() {
    const filename =
      target === 'markdown' ? `${agent.name}_skills.md`
      : target === 'claudecode' ? `CLAUDE_${agent.name}.md`
      : `${safeName}-mcp.js`
    const mime = target === 'mcp' ? 'text/javascript' : 'text/markdown'
    downloadFile(content, filename, mime)
    setDownloaded(true)
    setTimeout(() => setDownloaded(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(7,12,31,0.97)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div>
          <p className="text-xs tracking-widest mb-0.5" style={{ color: '#FFC300' }}>DEPLOY AGENT</p>
          <h2 className="font-bold text-base">{agent.name} を使う</h2>
        </div>
        <button onClick={onClose} className="text-xl px-2" style={{ color: '#64748B' }}>✕</button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        {/* Scrollable tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 mb-5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setTarget(tab.id); setCopied(false); setDownloaded(false) }}
              className="flex-shrink-0 py-2 px-3 rounded-xl text-xs font-bold transition-all"
              style={{
                background: target === tab.id ? '#FFC300' : 'rgba(255,255,255,0.05)',
                color: target === tab.id ? '#0A0F2C' : '#64748B',
                border: target === tab.id ? 'none' : '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* MCP special: command block */}
        {target === 'mcp' && (
          <div className="rounded-xl px-4 py-3 mb-4" style={{ background: 'rgba(255,195,0,0.06)', border: '1px solid rgba(255,195,0,0.2)' }}>
            <p className="text-xs font-bold mb-2" style={{ color: '#FFC300' }}>🔌 登録コマンド</p>
            <code className="text-xs block leading-relaxed" style={{ color: '#F0F4FF', wordBreak: 'break-all' }}>{mcpCommand}</code>
          </div>
        )}

        {/* Content preview */}
        <div className="rounded-xl mb-4 overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="flex items-center justify-between px-4 py-2.5" style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-xs font-bold" style={{ color: '#64748B' }}>
              {target === 'mcp' ? 'MCPサーバー (.js)' : isDownloadable ? 'ファイルプレビュー' : 'システムプロンプト'}
            </p>
            <p className="text-xs" style={{ color: '#4A5568' }}>{content.length.toLocaleString()} 文字</p>
          </div>
          <div className="px-4 py-3 max-h-44 overflow-y-auto">
            <pre className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: '#94A3B8', fontFamily: 'monospace' }}>
              {content.slice(0, 500)}{content.length > 500 ? '\n\n…（以下省略）' : ''}
            </pre>
          </div>
        </div>

        {/* MCP tools preview */}
        {target === 'mcp' && (
          <div className="rounded-xl p-4 mb-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-xs font-bold mb-3" style={{ color: '#64748B' }}>使えるツール（4個）</p>
            {[
              { name: 'get_agent_profile', desc: 'エージェントのプロフィール・特性・パラメーター' },
              { name: 'get_skills', desc: 'スキル一覧（名前・説明・ランク）' },
              { name: 'get_skill_detail', desc: '特定スキルの詳細（判断軸・プロセス・メンタルモデル）' },
              { name: 'search_skills', desc: 'キーワードでスキル検索' },
            ].map(({ name, desc }) => (
              <div key={name} className="flex gap-2 items-start mb-2">
                <code className="text-xs px-1.5 py-0.5 rounded shrink-0" style={{ background: 'rgba(255,195,0,0.1)', color: '#FFC300' }}>{name}</code>
                <p className="text-xs" style={{ color: '#64748B' }}>{desc}</p>
              </div>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div className={`gap-2 mb-6 ${isDownloadable ? 'flex' : ''}`}>
          {isDownloadable && (
            <button
              onClick={handleDownload}
              className="flex-1 py-4 rounded-xl font-bold text-sm transition-all hover:scale-[1.02]"
              style={{ background: downloaded ? '#48BB78' : '#3B82F6', color: '#fff' }}
            >
              {downloaded ? '✅ 完了' : `⬇ ${target === 'mcp' ? '.js' : '.md'}をDL`}
            </button>
          )}
          <button
            onClick={handleCopy}
            className={`py-4 rounded-xl font-bold text-sm transition-all hover:scale-[1.02] ${isDownloadable ? 'flex-1' : 'w-full text-base'}`}
            style={{ background: copied ? '#48BB78' : '#FFC300', color: '#0A0F2C' }}
          >
            {copied ? '✅ コピー完了' : target === 'mcp' ? '📋 コマンドをコピー' : isDownloadable ? '📋 コピー' : '📋 全文をコピー'}
          </button>
        </div>

        {/* Setup guide */}
        <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-xs font-bold mb-4 tracking-widest" style={{ color: '#64748B' }}>{setup.title}</p>
          <div className="flex flex-col gap-4">
            {setup.steps.map(({ num, text }) => (
              <div key={num} className="flex gap-3 items-start">
                <div className="text-xs font-black shrink-0 w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,195,0,0.1)', color: '#FFC300' }}>{num}</div>
                <p className="text-sm leading-relaxed" style={{ color: '#94A3B8' }}>{text}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 text-xs leading-relaxed" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', color: '#4A5568' }}>
            💡 {setup.tip}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---- agent card ----

function AgentCard({
  agent, isActive, onUse, onView,
}: { agent: Agent; isActive: boolean; onUse: () => void; onView: () => void }) {
  const config = AGENT_TYPES[agent.type]
  const tier = calcAgentTier(agent)
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${isActive ? config.color + '55' : 'rgba(255,255,255,0.08)'}`, background: isActive ? config.bgColor : 'rgba(255,255,255,0.03)' }}>
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
              {isActive && <span className="text-xs px-2 py-0.5 rounded shrink-0" style={{ background: 'rgba(255,195,0,0.2)', color: '#FFC300' }}>育成中</span>}
            </div>
            <p className="text-xs" style={{ color: config.color }}>{agent.type}</p>
          </div>
        </div>
        <div className="flex gap-4 text-xs mb-4">
          {[['スキル', `${agent.skills.length}個`], ['行動特性', `${agent.personaTraits.length}件`], ['累計tokens', agent.totalTokens.toLocaleString()]].map(([label, val]) => (
            <div key={label}>
              <p className="mb-0.5" style={{ color: '#64748B' }}>{label}</p>
              <p className="font-bold">{val}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={onUse} className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.01]" style={{ background: '#FFC300', color: '#0A0F2C' }}>
            このエージェントを使う →
          </button>
          <button onClick={onView} className="px-4 py-2.5 rounded-xl text-sm transition-all" style={{ border: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8' }}>
            詳細
          </button>
        </div>
      </div>

      {agent.skills.length > 0 && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={() => setExpanded((v) => !v)} className="w-full flex items-center justify-between px-4 py-3 text-xs" style={{ color: '#64748B' }}>
            <span>スキル一覧</span><span>{expanded ? '▲' : '▼'}</span>
          </button>
          {expanded && (
            <div className="px-4 pb-4 flex flex-col gap-2">
              {agent.skills.map((skill, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{skill.name}</p>
                    <p className="text-xs truncate" style={{ color: '#64748B' }}>{skill.description}</p>
                  </div>
                  {skill.rank && <span className="text-xs shrink-0" style={{ color: '#FFC300' }}>{renderStars(skill.rank)}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---- page ----

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
      <button onClick={() => router.back()} className="flex items-center gap-1 text-xs mb-6" style={{ color: '#64748B' }}>← 戻る</button>
      <div className="mb-6">
        <h1 className="text-xl font-bold">マイエージェント</h1>
        <p className="text-xs mt-1" style={{ color: '#64748B' }}>{allAgents.length}体のエージェント</p>
      </div>

      {allAgents.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-4xl mb-4">⚔️</p>
          <p className="text-sm mb-6" style={{ color: '#94A3B8' }}>まだエージェントがいません</p>
          <button onClick={() => router.push('/')} className="px-6 py-3 rounded-xl font-bold text-sm" style={{ background: '#FFC300', color: '#0A0F2C' }}>
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
              onView={() => { if (agent.name === activeAgent?.name) router.push('/agent') }}
            />
          ))}
        </div>
      )}

      {exportAgent && <ExportModal agent={exportAgent} onClose={() => setExportAgent(null)} />}
    </div>
  )
}
