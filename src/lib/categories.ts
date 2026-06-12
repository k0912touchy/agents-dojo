export interface Category {
  id: string
  label: string
  emoji: string
  description: string
  placeholder: string
}

export const CATEGORIES: Category[] = [
  {
    id: 'strategy',
    label: '戦略',
    emoji: '♟️',
    description: '事業戦略・競合・意思決定',
    placeholder: '例：OKRの立て方、競合分析の視点…',
  },
  {
    id: 'marketing',
    label: 'マーケティング',
    emoji: '📣',
    description: 'ブランド・広告・顧客獲得',
    placeholder: '例：STP分析、Meta広告のCBO構造…',
  },
  {
    id: 'finance',
    label: '金融・財務',
    emoji: '📊',
    description: '財務・投資・数字の読み方',
    placeholder: '例：キャッシュフローの見方、ROI計算…',
  },
  {
    id: 'legal',
    label: '法務・契約',
    emoji: '⚖️',
    description: '契約・法律・リスク管理',
    placeholder: '例：業務委託契約の注意点、NDA…',
  },
  {
    id: 'framework',
    label: 'フレームワーク',
    emoji: '🧩',
    description: '思考ツール・問題解決手法',
    placeholder: '例：MECE、ロジックツリー、SCAMPER…',
  },
  {
    id: 'thinking',
    label: '視点・考え方',
    emoji: '💡',
    description: '文章や決断からあなたの思考パターンを抽出',
    placeholder: '例：最近した意思決定、書いた文章、判断の基準…',
  },
  {
    id: 'other',
    label: 'その他',
    emoji: '✏️',
    description: '自由に教え込む',
    placeholder: 'テーマを入力してください…',
  },
]
