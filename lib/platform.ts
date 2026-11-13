export type Platform = 'tiktok' | 'instagram' | 'facebook' | 'youtube';

export type DetectResult =
  | { ok: true; platform: Platform }
  | { ok: false; code: 'INVALID_URL' | 'UNSUPPORTED_PLATFORM' };

function hostIs(host: string, base: string): boolean {
  return host === base || host.endsWith('.' + base);
}

/**
 * Deteksi platform dari hostname, bukan dari substring query/path.
 * `new URL()` memvalidasi skema, jadi `?x=tiktok.com` di host lain tidak lolos.
 */
export function detectPlatform(raw: string | null | undefined): DetectResult {
  const input = (raw || '').trim();
  if (!input) return { ok: false, code: 'INVALID_URL' };

  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return { ok: false, code: 'INVALID_URL' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, code: 'INVALID_URL' };
  }

  const host = parsed.hostname.toLowerCase().replace(/\.$/, '');

  if (hostIs(host, 'tiktok.com')) return { ok: true, platform: 'tiktok' };
  if (hostIs(host, 'instagram.com')) return { ok: true, platform: 'instagram' };
  if (hostIs(host, 'facebook.com') || hostIs(host, 'fb.com') || hostIs(host, 'fb.watch') || hostIs(host, 'fb.me')) {
    return { ok: true, platform: 'facebook' };
  }
  if (hostIs(host, 'youtube.com') || hostIs(host, 'youtu.be') || hostIs(host, 'youtube-nocookie.com')) {
    return { ok: true, platform: 'youtube' };
  }

  return { ok: false, code: 'UNSUPPORTED_PLATFORM' };
}
