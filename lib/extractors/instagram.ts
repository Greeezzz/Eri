import { ApiError } from '../errors';
import { btch } from '../btch';
import { safeFetch, UnsafeUrlError } from '../safe-fetch';
import type { ExtractedMedia } from '../types';

function extensionSays(url: string): 'video' | 'image' | 'unknown' {
  const clean = (url || '').toLowerCase();
  if (!clean) return 'unknown';
  if (/\.mp4(\?|$)/.test(clean)) return 'video';
  if (/\.(jpe?g|webp|png|heic)(\?|$)/.test(clean)) return 'image';
  return 'unknown';
}

/** Cek signature file dari 12 byte pertama — CDN sering pakai octet-stream. */
function sniff(head: Uint8Array): 'video' | 'image' | 'unknown' {
  const ascii = (from: number, to: number) =>
    String.fromCharCode(...Array.from(head.slice(from, to)));

  if (head.length >= 12 && ascii(4, 8) === 'ftyp') {
    const brand = ascii(8, 12);
    // HEIC/AVIF juga punya ftyp, tapi dipakai untuk gambar.
    if (/^(heic|heix|hevc|mif1|msf1|avif)/i.test(brand)) return 'image';
    return 'video';
  }
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'image';
  if (head.length >= 8 && head[0] === 0x89 && ascii(1, 4) === 'PNG') return 'image';
  if (head.length >= 6 && ascii(0, 3) === 'GIF') return 'image';
  if (head.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image';
  return 'unknown';
}

/**
 * CDN Instagram sering memberi URL tanpa ekstensi (`/v2?token=…`)
 * dan content-type `application/octet-stream`, jadi sniff byte awalnya.
 */
async function probeMediaType(url: string): Promise<'video' | 'image' | 'unknown'> {
  try {
    const res = await safeFetch(url, {
      timeoutMs: 10000,
      headers: { Range: 'bytes=0-63' },
    });

    if (!res.ok || !res.body) return 'unknown';

    const reader = res.body.getReader();
    const { value } = await reader.read();
    await reader.cancel().catch(() => {});

    if (!value || value.length < 4) return 'unknown';

    const byType = (res.headers.get('content-type') || '').toLowerCase();
    if (byType.startsWith('video/')) return 'video';
    if (byType.startsWith('image/')) return 'image';

    return sniff(value);
  } catch (err) {
    if (err instanceof UnsafeUrlError) return 'unknown';
    return 'unknown';
  }
}

export async function extractInstagram(url: string): Promise<ExtractedMedia> {
  let res: any;
  try {
    res = await btch('igdl', url);
  } catch {
    throw new ApiError('UPSTREAM_FAILED', 'Instagram lagi ga bisa diambil. Coba lagi nanti.');
  }

  const items: any[] = Array.isArray(res?.result) ? res.result : Array.isArray(res) ? res : [];
  const usable = items.filter(
    (it) => it && typeof it.url === 'string' && it.url.length > 0 && !it.url.includes('...'),
  );

  if (!usable.length) {
    throw new ApiError(
      'NOT_FOUND',
      'Isi postingan Instagram-nya ga ketemu. Mungkin privat atau sudah dihapus.',
    );
  }

  // Urutkan: yang jelas video dulu, lalu yang perlu di-probe, gambar terakhir.
  const ranked = [...usable].sort((a, b) => {
    const rank = (x: any) => {
      const e = extensionSays(x.url);
      return e === 'video' ? 0 : e === 'unknown' ? 1 : 2;
    };
    return rank(a) - rank(b);
  });

  for (const candidate of ranked) {
    const byExt = extensionSays(candidate.url);
    const mediaType = byExt === 'unknown' ? await probeMediaType(candidate.url) : byExt;
    const isVideo = mediaType === 'video';

    // Kalau ini gambar tapi masih ada kandidat lain, coba yang berikutnya.
    if (!isVideo && ranked.length > 1) continue;

    return {
      title: isVideo ? 'Instagram video' : 'Instagram foto',
      thumbnail: typeof candidate.thumbnail === 'string' ? candidate.thumbnail : undefined,
      downloadUrl: candidate.url,
      quality: 'UNKNOWN',
      mediaType: isVideo ? 'video' : 'image',
      source: 'btch',
    };
  }

  const fallback = ranked[0];
  return {
    title: 'Instagram',
    thumbnail: typeof fallback.thumbnail === 'string' ? fallback.thumbnail : undefined,
    downloadUrl: fallback.url,
    quality: 'UNKNOWN',
    mediaType: 'image',
    source: 'btch',
  };
}