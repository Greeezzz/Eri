import crypto from 'node:crypto';

export type ProxyKind = 'video' | 'thumb';

const DEV_FALLBACK_SECRET = 'eri-dev-only-insecure-secret-do-not-use-in-prod';
const TTL_MS = 15 * 60 * 1000;

let warned = false;

export function getProxySecret(): string {
  const secret = process.env.PROXY_SECRET;
  if (secret && secret.length > 0) return secret;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('PROXY_SECRET belum diisi. Set di Vercel → Settings → Environment Variables.');
  }
  if (!warned) {
    warned = true;
    console.warn('[eri] PROXY_SECRET kosong, pakai secret dev sementara. Jangan dipakai di production.');
  }
  return DEV_FALLBACK_SECRET;
}

function hmac(kind: ProxyKind, url: string, exp: number): string {
  return crypto
    .createHmac('sha256', getProxySecret())
    .update(`${kind}|${url}|${exp}`)
    .digest('base64url');
}

export function signMediaUrl(kind: ProxyKind, url: string, name?: string): string {
  const exp = Date.now() + TTL_MS;
  const sig = hmac(kind, url, exp);
  const params = new URLSearchParams({ kind, u: url, exp: String(exp), sig });
  if (name) params.set('name', name);
  return `/api/proxy?${params.toString()}`;
}

export function verifyMediaSignature(
  kind: string | null,
  url: string | null,
  exp: string | null,
  sig: string | null,
): { ok: true; kind: ProxyKind; url: string } | { ok: false; reason: string } {
  if (kind !== 'video' && kind !== 'thumb') return { ok: false, reason: 'kind tidak valid' };
  if (!url) return { ok: false, reason: 'u kosong' };
  if (!exp) return { ok: false, reason: 'exp kosong' };
  if (!sig) return { ok: false, reason: 'sig kosong' };

  const expNum = Number(exp);
  if (!Number.isFinite(expNum)) return { ok: false, reason: 'exp tidak valid' };
  if (expNum < Date.now()) return { ok: false, reason: 'exp kedaluwarsa' };

  const expected = hmac(kind, url, expNum);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: 'sig salah' };
  }

  return { ok: true, kind, url };
}

/** Nama file aman untuk Content-Disposition. */
export function sanitizeFilename(input: string | null | undefined, ext = 'mp4'): string {
  const base = (input || 'eri-video')
    .normalize('NFKC')
    .replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^[._]+|[._]+$/g, '')
    .slice(0, 100);
  const safe = base || 'eri-video';
  return safe.toLowerCase().endsWith('.' + ext) ? safe : `${safe}.${ext}`;
}
