/**
 * Client tipis untuk API btch-downloader (BOTCAHX).
 *
 * Library `btch-downloader` mengunci baseUrl ke `backend1.tioo.eu.org`.
 * Saat backend itu 503, semua fungsi IG/FB/YT mati tanpa fallback.
 * Di sini base host dicoba bergiliran sampai ada yang menjawab.
 */

const BACKENDS = [
  'https://backend2.tioo.eu.org',
  'https://backend1.tioo.eu.org',
];

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

export type BtchEndpoint = 'ttdl' | 'igdl' | 'fbdown' | 'youtube';

export class BtchError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'BtchError';
    this.status = status;
  }
}

async function callBackend(base: string, endpoint: BtchEndpoint, url: string, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${base}/${endpoint}?url=${encodeURIComponent(url)}`, {
      headers: {
        'User-Agent': UA,
        Accept: 'application/json',
        'X-Client-Version': '6.4.0',
      },
      signal: controller.signal,
      cache: 'no-store',
    });

    const text = await res.text();

    if (!res.ok) {
      throw new BtchError(`${endpoint} ${res.status}: ${text.slice(0, 160)}`, res.status);
    }

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new BtchError(`${endpoint} mengembalikan bukan JSON: ${text.slice(0, 160)}`, res.status);
    }

    // Backend bisa balas 200 tapi status:false (mis. "503 Service Unavailable").
    const asAny = json as { status?: boolean | string; message?: string; result?: unknown };
    const failed =
      asAny?.status === false ||
      asAny?.status === 'false' ||
      (typeof asAny?.message === 'string' && /service unavailable|too many|rate limit/i.test(asAny.message));

    if (failed) {
      throw new BtchError(`${endpoint} gagal: ${asAny?.message || 'upstream menolak'}`, 503);
    }

    return json;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Panggil endpoint btch dengan failover antar host.
 * Melempar BtchError kalau semua host gagal.
 */
export async function btch(endpoint: BtchEndpoint, url: string, timeoutMs = 25000): Promise<any> {
  const errors: string[] = [];

  for (const base of BACKENDS) {
    try {
      return await callBackend(base, endpoint, url, timeoutMs);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${base.replace('https://', '')} → ${msg}`);
      console.warn(`[eri] btch ${endpoint} lewat ${base} gagal: ${msg}`);
    }
  }

  throw new BtchError(`Semua backend btch gagal (${endpoint}): ${errors.join(' | ')}`);
}
