'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { loadAgent, saveAgent } from '@/lib/storage'
import type { KnowledgeItem } from '@/lib/dojo'

type Mode = 'select' | 'research-topic' | 'research-narrow' | 'research-preview' | 'user-write' | 'done'

interface NarrowQuestion {
  id: string
  question: string
  options: string[]
}

export default function KnowledgeNewPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('select')
  const [topic, setTopic] = useState('')
  const [narrowQuestions, setNarrowQuestions] = useState<NarrowQuestion[]>([])
  const [narrowAnswers, setNarrowAnswers] = useState<Record<string, string>>({})
  const [researchContent, setResearchContent] = useState('')
  const [userContent, setUserContent] = useState('')
  const [userTitle, setUserTitle] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const contentRef = useRef('')

  async function handleTopicSubmit() {
    if (!topic.trim()) return
    setIsLoading(true)
    try {
      const res = await fetch('/api/knowledge/narrow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic }),
      })
      const { questions } = await res.json()
      setNarrowQuestions(questions)
      setMode('research-narrow')
    } catch {
      // Skip narrowing if it fails
      await runResearch({})
    } finally {
      setIsLoading(false)
    }
  }

  async function runResearch(answers: Record<string, string>) {
    setMode('research-preview')
    setResearchContent('')
    contentRef.current = ''

    const res = await fetch('/api/knowledge/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, narrowingAnswers: answers }),
    })

    const reader = res.body?.getReader()
    const decoder = new TextDecoder()
    if (!reader) return

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value)
      contentRef.current += chunk
      setResearchContent((prev) => prev + chunk)
    }
  }

  function handleNarrowAnswer(questionId: string, answer: string) {
    const newAnswers = { ...narrowAnswers, [questionId]: answer }
    setNarrowAnswers(newAnswers)

    const allAnswered = narrowQuestions.every((q) => newAnswers[q.id])
    if (allAnswered) {
      runResearch(newAnswers)
    }
  }

  function saveResearchedKnowledge() {
    const agent = loadAgent()
    if (!agent) return
    const item: KnowledgeItem = {
      id: crypto.randomUUID(),
      title: topic,
      domain: topic,
      content: contentRef.current,
      source: 'ai-researched',
      createdAt: new Date().toISOString(),
      tags: [],
    }
    agent.knowledge.push(item)
    saveAgent(agent)
    setMode('done')
    setTimeout(() => router.push('/agent'), 1500)
  }

  function saveUserKnowledge() {
    if (!userTitle.trim() || !userContent.trim()) return
    const agent = loadAgent()
    if (!agent) return
    const item: KnowledgeItem = {
      id: crypto.randomUUID(),
      title: userTitle,
      domain: userTitle,
      content: userContent,
      source: 'user-authored',
      createdAt: new Date().toISOString(),
      tags: [],
    }
    agent.knowledge.push(item)
    saveAgent(agent)
    setMode('done')
    setTimeout(() => router.push('/agent'), 1500)
  }

  if (mode === 'done') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="text-center fade-in-up">
          <div className="text-4xl mb-4">📚</div>
          <p className="text-lg font-bold">知識を追加しました</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen max-w-lg mx-auto px-4 py-6">
      <button onClick={() => router.back()} className="flex items-center gap-1 text-xs mb-6"
        style={{ color: 'var(--text-muted)' }}>
        ← 戻る
      </button>

      {/* Mode select */}
      {mode === 'select' && (
        <div className="fade-in-up">
          <h1 className="text-xl font-bold mb-2">知識を与える</h1>
          <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>
            どちらの方法で知識を追加しますか？
          </p>
          <div className="flex flex-col gap-4">
            <button
              onClick={() => setMode('research-topic')}
              className="w-full text-left p-5 rounded-xl border transition-all hover:scale-[1.01]"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}>
              <p className="text-base font-bold mb-1">🔍 AIに調べさせる</p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                テーマを入力するとAIがリサーチして知識ドキュメントを生成。
                内容を確認してから保存できます。
              </p>
            </button>
            <button
              onClick={() => setMode('user-write')}
              className="w-full text-left p-5 rounded-xl border transition-all hover:scale-[1.01]"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}>
              <p className="text-base font-bold mb-1">✍️ 自分で書く</p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                自分の知識・経験・ノウハウを直接テキストで入力します。
                社外秘や個人の暗黙知の保存に。
              </p>
            </button>
          </div>
        </div>
      )}

      {/* Research: topic input */}
      {mode === 'research-topic' && (
        <div className="fade-in-up">
          <h1 className="text-xl font-bold mb-2">何を調べさせますか？</h1>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            具体的なテーマを入力してください
          </p>
          <input
            autoFocus
            type="text"
            placeholder="例: 業務委託契約の実務、SaaSのユニットエコノミクス"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleTopicSubmit()}
            className="w-full px-4 py-3 rounded-xl outline-none mb-4"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)',
            }}
          />
          <button
            onClick={handleTopicSubmit}
            disabled={!topic.trim() || isLoading}
            className="w-full py-4 rounded-xl font-bold transition-all hover:scale-[1.02] disabled:opacity-40"
            style={{ background: 'var(--accent)', color: 'var(--accent-on)' }}>
            {isLoading ? '絞り込み質問を生成中...' : '次へ →'}
          </button>
        </div>
      )}

      {/* Research: narrowing Q&A */}
      {mode === 'research-narrow' && (
        <div className="fade-in-up">
          <h1 className="text-xl font-bold mb-2">用途を絞り込む</h1>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            「{topic}」をあなたの用途に合わせてカスタマイズします
          </p>
          <div className="flex flex-col gap-6">
            {narrowQuestions.map((q) => (
              <div key={q.id}>
                <p className="text-sm font-bold mb-3">{q.question}</p>
                <div className="flex flex-col gap-2">
                  {q.options.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => handleNarrowAnswer(q.id, opt)}
                      className="w-full text-left px-4 py-3 rounded-xl border text-sm transition-all"
                      style={{
                        background: narrowAnswers[q.id] === opt ? 'var(--accent-dim)' : 'var(--bg-surface)',
                        borderColor: narrowAnswers[q.id] === opt ? 'var(--accent-border)' : 'var(--border-default)',
                        color: narrowAnswers[q.id] === opt ? 'var(--accent)' : 'var(--text-primary)',
                      }}>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Research: preview */}
      {mode === 'research-preview' && (
        <div className="fade-in-up">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-bold">生成された知識</h1>
            {researchContent && (
              <button
                onClick={saveResearchedKnowledge}
                className="text-sm px-4 py-2 rounded-lg font-bold transition-all hover:scale-[1.02]"
                style={{ background: 'var(--accent)', color: 'var(--accent-on)' }}>
                保存する
              </button>
            )}
          </div>
          {!researchContent ? (
            <div className="text-center py-12">
              <div className="text-3xl mb-3 animate-pulse">🔍</div>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>リサーチ中...</p>
            </div>
          ) : (
            <div className="rounded-xl p-4"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
              <pre className="text-sm leading-relaxed whitespace-pre-wrap"
                style={{ color: 'var(--text-secondary)', fontFamily: 'inherit' }}>
                {researchContent}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* User write */}
      {mode === 'user-write' && (
        <div className="fade-in-up">
          <h1 className="text-xl font-bold mb-6">知識を書く</h1>
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs font-bold mb-2" style={{ color: 'var(--text-muted)' }}>タイトル</p>
              <input
                autoFocus
                type="text"
                placeholder="例: 営業の判断軸"
                value={userTitle}
                onChange={(e) => setUserTitle(e.target.value)}
                className="w-full px-4 py-3 rounded-xl outline-none"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
            <div>
              <p className="text-xs font-bold mb-2" style={{ color: 'var(--text-muted)' }}>内容</p>
              <textarea
                rows={12}
                placeholder="知識・経験・判断軸・ノウハウを自由に書いてください"
                value={userContent}
                onChange={(e) => setUserContent(e.target.value)}
                className="w-full px-4 py-3 rounded-xl outline-none resize-none"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
            <button
              onClick={saveUserKnowledge}
              disabled={!userTitle.trim() || !userContent.trim()}
              className="w-full py-4 rounded-xl font-bold transition-all hover:scale-[1.02] disabled:opacity-40"
              style={{ background: 'var(--accent)', color: 'var(--accent-on)' }}>
              保存する
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
