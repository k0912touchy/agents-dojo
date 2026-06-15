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
    "スキル名案1（4〜7文字・パンチがある・ゲームアイテム感。例：ROI先読み・仕入れ眼・判断の型）",
    "スキル名案2（4〜7文字・カタカナ・体言止め・動詞系でも可）",
    "スキル名案3（4〜7文字・別の角度）"
  ],
  "summary": "このスキルで何を判断できるか・何に使えるか（25〜40文字）",
  "keyPoints": ["ポイント1", "ポイント2", "ポイント3"],
  "rank": 会話の深さ・ユーザーのコンテキストの具体性・判断基準の精度で判定した整数（1〜4）。リサーチ型は経験型より1段低めに設定,
  "content": "## 目的・使いどころ\\n[このスキルをいつ・何のために使うか。ユーザーの目的文脈を踏まえて1〜2文]\\n\\n## 判断軸\\n- [判断基準1]\\n- [判断基準2]\\n- [判断基準3]\\n\\n## 判断プロセス\\n- [手順・アクション1]\\n- [手順・アクション2]\\n- [手順・アクション3]\\n\\n## 重要な視点\\n[この分野で見落としやすい・初心者がハマりやすいポイント（1〜2文）]\\n\\n## 要検証\\n[実際の経験・専門家の確認が必要な部分。何を試して確かめると良いか（1文）]",
  "personaTrait": {
    "label": "4〜8文字。ユーザーの学習スタイル・思考の癖・知識への向き合い方を表すキャッチーな特性名。例：「フレーム依存型」「目的逆算型」「構造化中毒」「先読み学習」「事例ハンター」",
    "description": "この会話から読み取れたユーザーの学び方・思考パターン・判断スタイルの特性（25〜50文字）"
  },
  "personalContext": "このスキルを必要とした目的・事業・状況のサマリー（例：「〇〇事業の仕入れ判断を目的とした知識」）。実名・社名は使わず抽象化"
}

【ルール】
- リサーチ型スキルなのでcontentの末尾に「要検証」セクションを必ず入れる
- personaTraitは学習スタイル・思考傾向から必ず推定して設定する（nullにしない）
- rankは1〜4の範囲。会話が浅ければ2、ユーザーコンテキストが具体的なら3、判断軸が精緻なら4
- スキル名は漢字4文字の塊を避ける。短くてパンチがある名前を優先`
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
    "スキル名案1（4〜7文字・パンチがある・ゲームアイテム感。例：判断の型・ROI先読み・巻き込み術・案件制御）",
    "スキル名案2（4〜7文字・カタカナ・体言止め・動詞系でも可）",
    "スキル名案3（4〜7文字・さらに別の角度）"
  ],
  "summary": "このスキルで何ができるか・どんな判断ができるか（25〜40文字）",
  "keyPoints": ["ポイント1（具体的に）", "ポイント2", "ポイント3"],
  "rank": 会話の深さ・具体性・独自の洞察・実践的な知識量で判定した整数（1〜5）。短い会話は2、具体例が豊富なら3、独自視点や体験談があれば4、深くオリジナルな知見がふんだんにあれば5,
  "content": "## トリガー・使い所\\n[どんな場面・状況でこの知識を使う？具体例を踏まえて1〜2文。会社名・実名は使わず誰にでも応用できる形で]\\n\\n## 判断軸\\n- [判断基準1]\\n- [判断基準2]\\n- [判断基準3（できれば）]\\n\\n## プロセス\\n- [具体的なアクション・手順1]\\n- [アクション2]\\n- [アクション3（できれば）]\\n\\n## メンタルモデル\\n[なぜこのアプローチが機能するか（1〜2文）]\\n\\n## 落とし穴・注意点\\n[よくある失敗・やってはいけないこと（1〜2文）]",
  "personaTrait": {
    "label": "4〜8文字。会話から読み取れる思考の癖・口癖・判断スタイル・行動パターンを表すキャッチーな特性名。ゲームのステータス感で。例：「逆算脳」「事例コレクター」「構造化中毒」「最悪先読み」「スピード至上」「数字起点型」「俯瞰モード」「型破り思考」",
    "description": "この会話から読み取れた口癖・思考パターン・判断の癖・行動スタイルの具体的な説明（25〜50文字）"
  },
  "personalContext": "この会話で言及された固有情報のサマリー（例：「〇〇業界・BtoB営業の文脈に基づく知識」）。実名・社名・機密数値・未公開情報が一切含まれない場合はnull"
}

【重要ルール】
- スキル名は漢字4文字の塊・長い熟語を避ける。短くてかっこいい・ゲームアイテム感のある名前を優先
- contentは会社名・実名・プロジェクト固有名詞・機密数値を一切含めない
- personalContextには会話で出てきた固有の文脈情報を要約。会社名・実名は使わず抽象化
- contentは実際の会話内容を反映した具体的な記述にすること。\\nは改行
- personaTraitは必ず設定する。口癖・思考の癖・判断スタイル・行動パターンから積極的に推定する。「〇〇型」「〇〇中毒」「〇〇脳」「〇〇思考」のようなキャラ感のあるラベルにする`,
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
