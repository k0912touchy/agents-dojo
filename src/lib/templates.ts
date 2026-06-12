export interface KnowledgeTemplate {
  id: string
  emoji: string
  name: string
  tagline: string
  category: string  // matches Category.id
  topicHint: string
  content: string   // base knowledge injected as refContent
}

export const KNOWLEDGE_TEMPLATES: KnowledgeTemplate[] = [
  {
    id: 'gtd',
    emoji: '📥',
    name: 'GTD（タスク管理）',
    tagline: '頭の中を空にして、確実に動く',
    category: 'framework',
    topicHint: 'GTDを自分流にアレンジしたタスク管理術',
    content: `GTD（Getting Things Done）はDavid Allenが提唱するタスク管理手法。
基本ステップ：①収集（気になることをすべて書き出す）②整理（次のアクションを決める）③整理（プロジェクト・カレンダー・いつかリストに振り分け）④レビュー（週次で全体を見直す）⑤実行
核心は「頭の中に情報を残さない」こと。次のアクションを明確にするのが最重要。`,
  },
  {
    id: 'okr',
    emoji: '🎯',
    name: 'OKR（目標管理）',
    tagline: '野心的な目標と計測可能な成果',
    category: 'strategy',
    topicHint: 'OKRを使ったチームの目標設定と管理',
    content: `OKR（Objectives and Key Results）はIntel・Googleが広めた目標管理フレームワーク。
Objective（目標）：定性的・野心的・刺激的な方向性。Key Results（主要成果）：目標達成の証明となる定量指標、3〜5個。
四半期単位で設定し、60〜70%達成が理想（100%は目標が低すぎる）。毎週の進捗確認と四半期末の振り返りがセット。`,
  },
  {
    id: 'star',
    emoji: '⭐',
    name: 'STAR法（伝え方）',
    tagline: '経験を「再現性のある武器」に変える',
    category: 'thinking',
    topicHint: 'STAR法を使った経験の整理・伝え方',
    content: `STAR法は経験・実績を構造的に伝えるフレームワーク。
S（Situation）：背景・状況。T（Task）：自分に課された課題・役割。A（Action）：自分が取った具体的な行動。R（Result）：結果・成果・学び。
面接・報告・提案など「自分の貢献を伝える」場面で使う。Actionの具体性が最も重要。`,
  },
  {
    id: '3c',
    emoji: '🔍',
    name: '3C分析（市場・競合）',
    tagline: '自社の強みを戦略的ポジションに変える',
    category: 'strategy',
    topicHint: '3C分析を使った事業・施策の設計',
    content: `3C分析は市場環境を「顧客・競合・自社」の3軸で整理するフレームワーク。
Customer（顧客）：誰の何の課題を解くか。Competitor（競合）：どう差別化するか。Company（自社）：何が強みか。
3Cの交点に「勝てるポジション」がある。顧客から始めるのが鉄則で、自社から始めると内向きになる。`,
  },
  {
    id: 'pyramid',
    emoji: '🔺',
    name: 'ピラミッド原則（論理構成）',
    tagline: '結論から話す、が腹落ちするまで',
    category: 'thinking',
    topicHint: 'ピラミッド原則を使った論理的な文章・話し方',
    content: `ピラミッド原則（Minto Pyramid Principle）はBarbara Mintoが提唱する論理的コミュニケーション手法。
構造：最初に結論→理由を3つ（MECE）→各理由の根拠。SoWhat（だから何？）とWhySo（なぜそう言える？）を常に意識する。
文書・プレゼン・口頭説明すべてに使える。聞き手の時間を奪わないことが目的。`,
  },
  {
    id: 'jobs',
    emoji: '💼',
    name: 'ジョブ理論（顧客理解）',
    tagline: '人が「雇う」ものは機能じゃなくて体験',
    category: 'marketing',
    topicHint: 'ジョブ理論を使ったユーザー・顧客理解',
    content: `ジョブ理論（Jobs to be Done）はClayton Christensenが提唱する顧客理解フレームワーク。
人は「特定の仕事（ジョブ）を片付けるために」製品・サービスを「雇う」。ジョブ＝機能的ニーズ＋感情的ニーズ＋社会的ニーズの3層。
「誰が・どんな状況で・どんな進歩を求めているか」を問う。競合は同業他社だけでなく、同じジョブを片付ける別手段すべて。`,
  },
  {
    id: 'pdca',
    emoji: '🔄',
    name: 'PDCA（業務改善）',
    tagline: '仮説と検証を高速で回す',
    category: 'framework',
    topicHint: 'PDCAを回した業務改善・学習の進め方',
    content: `PDCAはPlan（計画）→Do（実行）→Check（評価）→Action（改善）のサイクル。
効果的に回すコツ：①Planで仮説を明確に立てる②Doは素早く小さく③Checkは数字で評価する④Actionで次のPlanに繋げる。
単なる振り返りではなく「仮説の検証サイクル」として使うことが重要。速く回すほど学習が速くなる。`,
  },
  {
    id: 'cf',
    emoji: '💡',
    name: 'クリティカルシンキング',
    tagline: '「なぜ？」を3回で本質を掴む',
    category: 'thinking',
    topicHint: 'クリティカルシンキングを使った問題分析・意思決定',
    content: `クリティカルシンキングは感情や先入観に頼らず、論理的に物事を判断する思考法。
主要スキル：①前提を疑う（それは本当か？）②因果関係を確認する（相関≠因果）③反証を探す（反対意見を意識的に考える）④優先順位を付ける（全部は解けない）。
「なぜ？」を繰り返すことで表面的な問題から根本原因へ辿り着く。`,
  },
]
