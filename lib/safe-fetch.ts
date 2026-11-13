import dns from 'node:dns/promises';
import net from 'node:net';

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeUrlError';
  }
}

const BLOCKED_SUFFIXES = [
  'localhost',
  'local',
  'internal',
  'intranet',
  'home.arpa',
  'localdomain',
];

function ipv4IsPrivate(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;

  if (a === 0) return true;               // 0.0.0.0/8
  if (a === 10) return true;              // 10/8
  if (a === 127) return true;             // loopback
  if (a === 169 && b === 254) return true; // link-local
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
  if (a === 192 && b === 168) return true; // 192.168/16
  if (a === 192 && b === 0) return true;   // 192.0.0/24 + 192.0.2/24 (reserved)
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a >= 224) return true;               // multicast + reserved + broadcast
  return false;
}

function ipv6IsPrivate(ip: string): boolean {
  const addr = ip.toLowerCase().split('%')[0];

  // IPv4-mapped (::ffff:127.0.0.1)
  const mapped = addr.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return ipv4IsPrivate(mapped[1]);

  if (addr === '::' || addr === '::1') return true;
  if (addr.startsWith('fe8') || addr.startsWith('fe9') || addr.startsWith('fea') || addr.startsWith('feb')) return true; // fe80::/10
  if (addr.startsWith('fc') || addr.startsWith('fd')) return true; // fc00::/7 ULA
  if (addr.startsWith('ff')) return true; // multicast

  // IPv4-compatible (::127.0.0.1)
  const compat = addr.match(/^::(\d+\.\d+\.\d+\.\d+)$/);
  if (compat) return true;

  return false;
}

function addressIsPrivate(ip: string): boolean {
  const version = net.isIP(ip);
  if (version === 4) return ipv4IsPrivate(ip);
  if (version === 6) return ipv6IsPrivate(ip);
  return true;
}

/**
 * Validasi awal (tanpa DNS): hanya https, bukan literal IP, bukan host internal.
 */
export function assertPublicHttps(raw: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new UnsafeUrlError('URL tidak bisa di-parse');
  }

  if (parsed.protocol !== 'https:') throw new UnsafeUrlError('Hanya https yang diizinkan');
  if (parsed.username || parsed.password) throw new UnsafeUrlError('URL dengan kredensial ditolak');

  const host = parsed.hostname.toLowerCase().replace(/\.$/, '').replace(/^\[|\]$/g, '');
  if (!host) throw new UnsafeUrlError('Host kosong');

  if (net.isIP(host)) throw new UnsafeUrlError('Literal IP ditolak');
  if (BLOCKED_SUFFIXES.some((s) => host === s || host.endsWith('.' + s))) {
    throw new UnsafeUrlError('Host internal ditolak');
  }
  if (!host.includes('.')) throw new UnsafeUrlError('Host tanpa TLD ditolak');

  return parsed;
}

async function assertResolvesPublic(hostname: string): Promise<void> {
  let records: { address: string }[];
  try {
    records = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new UnsafeUrlError('DNS lookup gagal');
  }
  if (!records.length) throw new UnsafeUrlError('Host tidak punya alamat');
  for (const rec of records) {
    if (addressIsPrivate(rec.address)) {
      throw new UnsafeUrlError('Host mengarah ke alamat privat');
    }
  }
}

export type SafeFetchOptions = {
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxRedirects?: number;
};

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

/**
 * fetch yang menolak SSRF: validasi tiap hop redirect, resolve DNS, tolak alamat privat.
 * Redirect diikuti manual supaya setiap lompatan divalidasi ulang.
 */
export async function safeFetch(rawUrl: string, opts: SafeFetchOptions = {}): Promise<Response> {
  const maxRedirects = opts.maxRedirects ?? 3;
  let current = rawUrl;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const parsed = assertPublicHttps(current);
    await assertResolvesPublic(parsed.hostname);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20000);

    let res: Response;
    try {
      res = await fetch(parsed.toString(), {
        method: 'GET',
        redirect: 'manual',
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          'User-Agent': BROWSER_UA,
          Accept: '*/*',
          ...(opts.headers || {}),
        },
      });
    } catch (err) {
      if (controller.signal.aborted) throw new UnsafeUrlError('Upstream timeout');
      throw err;
    } finally {
      // Body masih di-stream setelah header datang, jadi timer dimatikan di sini.
      clearTimeout(timer);
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) return res;
      await res.body?.cancel();
      current = new URL(location, parsed).toString();
      continue;
    }

    return res;
  }

  throw new UnsafeUrlError('Terlalu banyak redirect');
}
