import { anthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import type { Message } from '@/lib/agent'

export async function POST(req: Request) {
  const { messages, category, topic, agentType, topicType } = await req.json() as {
    messages: Message[]
    category: string
    topic: string
    agentType: string
    topicType?: 'experience' | 'research'
  }

  const conversation = messages
    .map((m) => `${m.role === 'user' ? 'ユーザー' : 'エージェント'}: ${m.content}`)
    .join('\n')

  const userMsgCount = messages.filter((m) => m.role === 'user').length

  const isResearch = topicType === 'research'

  const { text } = await generateText({
    model: anthropic('claude-haiku-4-5'),
    prompt: isResearch
      ? `以下は、ユーザーがまだ持っていない知識をAIと共同リサーチしてスキル化したセッションの会話です。

カテゴリ：${category}
テーマ：${topic}
エージェントタイプ：${agentType}
タイプ：リサーチ型（ユーザーの目的・コンテキストに最適化した判断フレームワーク）

---
${messages.map((m) => `${m.role === 'user' ? 'ユーザー' : 'エージェント'}: ${m.content}`).join('\n')}
---

このセッションを分析して、以下のJSON形式のみで出力してください（説明文不要）：

{
  "skillNameOptions": [
    "スキル名案1（5〜12文字・このユーザーの目的に特化した名称）",
    "スキル名案2（5〜12文字）",
    "スキル名案3（5〜12文字）"
  ],
  "summary": "このスキルで何を判断できるか・何に使えるか（25〜40文字）",
  "keyPoints": ["ポイント1", "ポイント2", "ポイント3"],
  "rank": 会話の深さ・ユーザーのコンテキストの具体性・判断基準の精度で判定した整数（1〜4）。リサーチ型は経験型より1段低めに設定,
  "content": "## 目的・使いどころ\\n[このスキルをいつ・何のために使うか。ユーザーの目的文脈を踏まえて1〜2文]\\n\\n## 判断軸\\n- [判断基準1]\\n- [判断基準2]\\n- [判断基準3]\\n\\n## 判断プロセス\\n- [手順・アクション1]\\n- [手順・アクション2]\\n- [手順・アクション3]\\n\\n## 重要な視点\\n[この分野で見落としやすい・初心者がハマりやすいポイント（1〜2文）]\\n\\n## 要検証\\n[実際の経験・専門家の確認が必要な部分。何を試して確かめると良いか（1文）]",
  "personaTrait": null,
  "personalContext": "このスキルを必要とした目的・事業・状況のサマリー（例：「〇〇事業の仕入れ判断を目的とした知識」）。実名・社名は使わず抽象化"
}

【ルール】
- リサーチ型スキルなのでcontentの末尾に「要検証」セクションを必ず入れる
- personaTraitはnullにする（経験から生まれる特性ではないため）
- rankは1〜4の範囲。会話が浅ければ2、ユーザーコンテキストが具体的なら3、判断軸が精緻なら4`
      : `以下は、ユーザーがAIエージェントに知識・TIPSを教え込んだセッションの会話です。

カテゴリ：${category}
テーマ：${topic}
エージェントタイプ：${agentType}
ユーザー発言数：${userMsgCount}

---
${conversation}
---

このセッションを分析して、以下のJSON形式のみで出力してください（説明文不要）：

{
  "skillNameOptions": [
    "スキル名案1（5〜12文字・印象的な名称）",
    "スキル名案2（5〜12文字・別の切り口）",
    "スキル名案3（5〜12文字・さらに別の角度）"
  ],
  "summary": "このスキルで何ができるか・どんな判断ができるか（25〜40文字）",
  "keyPoints": ["ポイント1（具体的に）", "ポイント2", "ポイント3"],
  "rank": 会話の深さ・具体性・独自の洞察・実践的な知識量で判定した整数（1〜5）。短い会話は2、具体例が豊富なら3、独自視点や体験談があれば4、深くオリジナルな知見がふんだんにあれば5,
  "content": "## トリガー・使い所\\n[どんな場面・状況でこの知識を使う？具体例を踏まえて1〜2文。会社名・実名は使わず誰にでも応用できる形で]\\n\\n## 判断軸\\n- [判断基準1]\\n- [判断基準2]\\n- [判断基準3（できれば）]\\n\\n## プロセス\\n- [具体的なアクション・手順1]\\n- [アクション2]\\n- [アクション3（できれば）]\\n\\n## メンタルモデル\\n[なぜこのアプローチが機能するか（1〜2文）]\\n\\n## 落とし穴・注意点\\n[よくある失敗・やってはいけないこと（1〜2文）]",
  "personaTrait": {
    "label": "特性ラベル（5〜12文字。行動・思考の特徴を表すキャッチーな名称。例：ROI逆算思考、スピード優先型、構造化モード）",
    "description": "この会話から読み取れた行動・思考・判断スタイルの特性（30〜60文字）"
  },
  "personalContext": "この会話で言及された固有情報のサマリー（例：「〇〇業界・BtoB営業の文脈に基づく知識」）。実名・社名・機密数値・未公開情報が一切含まれない場合はnull"
}

【重要ルール】
- contentは会社名・実名・プロジェクト固有名詞・機密数値を一切含めない。誰でも応用可能な汎用的な記述にする
- personalContextには会話で出てきた固有の文脈情報（業界・規模感・状況など）を要約する。ただし会社名・実名は使わず「〇〇業界」「数十名規模」のような抽象化表現にする
- contentは実際の会話内容を反映した具体的な記述にすること。\\nは改行
- personaTraitは会話から積極的に推定して必ず設定すること。まったく個人の特性が読み取れない場合のみnull`,
    maxOutputTokens: 1400,
  })

  try {
    const cleaned = text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '')
    const json = JSON.parse(cleaned)
    return Response.json(json)
  } catch {
    return Response.json({
      skillNameOptions: [topic.slice(0, 12), `${topic.slice(0, 8)}の技`, `${category}の視点`],
      summary: `${category}分野の知識をインプット`,
      keyPoints: ['セッションで学んだ知識を習得'],
      rank: 2,
      content: `## トリガー・使い所\n${category}分野のシーンで活用できる知識です。\n\n## 判断軸\n- ${topic}に関する判断基準\n\n## プロセス\n- セッションで学んだアプローチを適用する\n\n## メンタルモデル\n${topic}への理解と実践知識。\n\n## 落とし穴・注意点\n状況に応じて柔軟に適用すること。`,
      personaTrait: null,
      personalContext: null,
    })
  }
}
