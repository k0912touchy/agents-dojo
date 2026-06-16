import { anthropic } from '@ai-sdk/anthropic'
import { streamText } from 'ai'

export async function POST(req: Request) {
  const { topic, narrowingAnswers } = await req.json() as {
    topic: string
    narrowingAnswers: Record<string, string>
  }

  const contextLines = Object.entries(narrowingAnswers)
    .map(([q, a]) => `- ${q}: ${a}`)
    .join('\n')

  const result = streamText({
    model: anthropic('claude-haiku-4-5'),
    maxOutputTokens: 1200,
    prompt: `「${topic}」について、AIエージェントが判断・助言に使える実務的な知識ドキュメントを作成してください。

## ユーザーの用途・文脈
${contextLines || '（指定なし）'}

## 出力形式（Markdown）

# ${topic}

## 概要
[この知識が何で、どう使うか 2〜3文]

## 重要な判断軸
- [判断軸1]
- [判断軸2]
- [判断軸3]

## 実務上のポイント
- [具体的なポイント1]
- [ポイント2]
- [ポイント3]

## よくある落とし穴
- [注意点1]
- [注意点2]

## 要確認事項
[専門家への確認や最新情報の確認が必要な部分]

## ルール
- 一般論の羅列にしない。ユーザーの用途に引き寄せた内容にする
- 「〜の場合は〜」という判断基準の形で書く
- 会社名・実名は使わない`,
  })

  return result.toTextStreamResponse()
}
