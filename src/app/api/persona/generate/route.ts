import { anthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import type { PerspectiveType, StanceType } from '@/lib/dojo'

export async function POST(req: Request) {
  const { perspectiveType, traits, quizAnswers } = await req.json() as {
    perspectiveType: PerspectiveType
    traits: {
      riskTolerance: number
      decisionSpeed: number
      abstractionLevel: number
      stance: StanceType
    }
    quizAnswers: Record<string, string>
  }

  const perspectiveDesc = {
    mirror: '分身型 — ユーザーの思考を深掘りし、言語化・整理するのが得意',
    complement: '補完型 — ユーザーが見えていない視点・盲点を埋めるのが得意',
    contrarian: '対立型 — ユーザーの判断に反論・批判して穴を先に洗い出すのが得意',
  }[perspectiveType]

  const stanceDesc = {
    analytical: 'データ・論理・数値から入る',
    intuitive: '直感・全体感から入って後で検証する',
    critical: 'まずリスク・失敗ケースを洗い出す',
    empathetic: '関係者の感情・合意形成を重視する',
  }[traits.stance]

  const { text } = await generateText({
    model: anthropic('claude-haiku-4-5'),
    maxOutputTokens: 300,
    prompt: `以下の特性を持つAIエージェントの「人格説明文」を日本語で書いてください。
読み手はこのエージェントを使うユーザーです。
「このエージェントはこう考える・こう動く」という描写を3〜4文で。
ゲームのキャラクター紹介のように、個性・癖・強みが伝わる文体にしてください。

特性:
- 視点タイプ: ${perspectiveDesc}
- 判断スタイル: ${stanceDesc}
- リスク許容度: ${traits.riskTolerance < 0.4 ? '低い（慎重）' : traits.riskTolerance > 0.6 ? '高い（積極）' : '中程度'}
- 意思決定スピード: ${traits.decisionSpeed < 0.4 ? '熟考型（じっくり）' : traits.decisionSpeed > 0.6 ? '即断型（素早い）' : '状況依存'}
- 思考の視座: ${traits.abstractionLevel < 0.4 ? '戦術・実務寄り（具体的な手順を重視）' : traits.abstractionLevel > 0.6 ? '戦略・構造寄り（全体像から入る）' : 'バランス型'}

説明文のみを出力してください。タイトルや箇条書きは不要。`,
  })

  return Response.json({ description: text.trim() })
}
