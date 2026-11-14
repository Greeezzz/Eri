import { safeFetch } from '../safe-fetch';
import { ApiError } from '../errors';
import type { ExtractedMedia } from '../types';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

export function facebookVideoId(raw: string): string | null {
  try {
    const u = new URL(raw);
    const vParam = u.searchParams.get('v');
    if (vParam && /^\d+$/.test(vParam)) return vParam;

    const path = u.pathname;
    const parts = path.split('/');
    for (let i = 0; i < parts.length; i++) {
      if (['reel', 'videos', 'watch'].includes(parts[i]) && parts[i + 1]) {
        const next = parts[i + 1];
        if (/^\d+$/.test(next)) return next;
      }
    }

    const numIdx = parts.findIndex((seg) => /^\d{10,}$/.test(seg));
    if (numIdx >= 0) return parts[numIdx];

    return null;
  } catch {
    return null;
  }
}

function unescapeFacebookUrl(u: string): string {
  return u
    .replace(/\\u0025/g, '%')
    .replace(/\\u002F/gi, '/')
    .replace(/\\u003A/gi, ':')
    .replace(/\\u0026/gi, '&')
    .replace(/\\u003D/gi, '=')
    .replace(/\\\//g, '/')
    .replace(/\\/g, '');
}

export async function extractFacebook(rawUrl: string): Promise<ExtractedMedia> {
  let videoId = facebookVideoId(rawUrl);
  let resolvedUrl = rawUrl;

  try {
    const headRes = await safeFetch(rawUrl, {
      timeoutMs: 12000,
      headers: { 'User-Agent': BROWSER_UA },
    });
    resolvedUrl = headRes.url;
    await headRes.body?.cancel();
    if (!videoId) {
      videoId = facebookVideoId(resolvedUrl);
    }
  } catch {
    // Abaikan
  }

  const targets = [
    videoId ? `https://m.facebook.com/watch/?v=${videoId}` : null,
    resolvedUrl,
    rawUrl,
  ].filter((t): t is string => Boolean(t));

  let lastError: unknown = null;

  for (const target of targets) {
    try {
      const res = await safeFetch(target, {
        timeoutMs: 15000,
        headers: {
          'User-Agent': BROWSER_UA,
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-Dest': 'document',
          'Upgrade-Insecure-Requests': '1',
          'sec-ch-ua': '"Chromium";v="126", "Google Chrome";v="126", "Not-A.Brand";v="99"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
        },
      });

      if (!res.ok) continue;

      const html = await res.text();

      const hdMatch = html.match(/"browser_native_hd_url":"([^"]+)"/);
      const sdMatch = html.match(/"browser_native_sd_url":"([^"]+)"/);

      const hd = hdMatch ? unescapeFacebookUrl(hdMatch[1]) : null;
      const sd = sdMatch ? unescapeFacebookUrl(sdMatch[1]) : null;

      const hdSrcMatch = !hd ? html.match(/"hd_src":"([^"]+)"/) : null;
      const sdSrcMatch = !sd ? html.match(/"sd_src":"([^"]+)"/) : null;

      const finalHd = hd || (hdSrcMatch ? unescapeFacebookUrl(hdSrcMatch[1]) : null);
      const finalSd = sd || (sdSrcMatch ? unescapeFacebookUrl(sdSrcMatch[1]) : null);

      const media = finalHd || finalSd;
      if (!media) continue;

      const hdIsDistinct = Boolean(finalHd && finalSd && finalHd !== finalSd);

      return {
        title: 'Facebook video',
        downloadUrl: media,
        quality: hdIsDistinct ? 'HD' : 'UNKNOWN',
        qualityNote: hdIsDistinct ? 'resolusi HD (720p+)' : 'kualitas standar',
        mediaType: 'video',
        source: 'facebook',
      };
    } catch (err) {
      lastError = err;
    }
  }

  const detail = lastError instanceof Error ? lastError.message : 'tidak diketahui';
  throw new ApiError(
    'NOT_FOUND',
    `Video Facebook-nya ga ketemu. Pastikan postingannya publik dan link-nya valid (${detail}).`,
  );
}
