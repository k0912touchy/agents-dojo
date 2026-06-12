import { lookup } from 'dns/promises'

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((n) => isNaN(n) || n < 0 || n > 255)) return false
  const [a, b] = parts
  return (
    a === 127 ||
    a === 10 ||
    a === 0 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254)
  )
}

async function isSafeUrl(urlStr: string): Promise<{ safe: boolean; reason?: string }> {
  let parsed: URL
  try {
    parsed = new URL(urlStr)
  } catch {
    return { safe: false, reason: '無効なURL形式です' }
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { safe: false, reason: 'http/httpsのみ対応しています' }
  }

  const hostname = parsed.hostname.toLowerCase()

  if (['localhost', '0.0.0.0', '::1', '[::1]'].includes(hostname)) {
    return { safe: false, reason: '内部ネットワークへのアクセスはできません' }
  }
  if (hostname.endsWith('.local') || hostname.endsWith('.internal') || hostname.endsWith('.localhost')) {
    return { safe: false, reason: '内部ネットワークへのアクセスはできません' }
  }

  // Direct IPv4 address in hostname
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    if (isPrivateIPv4(hostname)) return { safe: false, reason: '内部IPへのアクセスはできません' }
    return { safe: true }
  }

  // Resolve hostname and check resolved IPs
  try {
    const addresses = await lookup(hostname, { all: true })
    for (const addr of addresses) {
      if (addr.family === 4 && isPrivateIPv4(addr.address)) {
        return { safe: false, reason: '内部ネットワークへのアクセスはできません' }
      }
    }
  } catch {
    return { safe: false, reason: 'ホスト名を解決できませんでした' }
  }

  return { safe: true }
}

export async function POST(req: Request) {
  const { url } = await req.json() as { url: string }

  const safety = await isSafeUrl(url)
  if (!safety.safe) {
    return Response.json({ error: safety.reason ?? '無効なURLです' }, { status: 400 })
  }

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AgentsDojo/1.0)' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const html = await res.text()

    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 4000)

    return Response.json({ content: text, charCount: text.length })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    return Response.json({ error: `取得失敗: ${msg}` }, { status: 400 })
  }
}
