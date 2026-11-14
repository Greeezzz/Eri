/**
 * Pengambil media Instagram tanpa API pihak ketiga.
 *
 * Semua API publik IG (btch, vreden, dll) sekarang balas 401/403 karena
 * Instagram mewajibkan login untuk endpoint API-nya. Yang masih jalan adalah
 * halaman web biasa, TAPI hanya kalau fingerprint TLS-nya mirip browser —
 * request fetch biasa dibalas halaman login.
 *
 * Karena itu modul ini meniru cara kerja yt-dlp: ambil halaman publik
 * (bukan endpoint API), lalu baca JSON yang sudah tertanam di HTML-nya.
 */

import { safeFetch } from '../safe-fetch';
import { ApiError } from '../errors';
import type { ExtractedMedia } from '../types';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

type IgItem = {
  isVideo: boolean;
  mediaUrl: string;
  thumbnail?: string;
};

/** Ambil shortcode dari URL reel/post/tv. */
export function instagramShortcode(raw: string): string | null {
  try {
    const u = new URL(raw);
    const m = u.pathname.match(/\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

function unescapeJsonFragment(value: string): string {
  // Nilai di dalam HTML di-escape berlapis (\\/ dan \\").
  return value
    .replace(/\\\\\//g, '/')
    .replace(/\\\//g, '/')
    .replace(/\\\\"/g, '"')
    .replace(/\\"/g, '"')
    .replace(/\\\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

/**
 * Ambil objek JSON pertama yang utuh dari sebuah string.
 * Regex saja tidak cukup: nilai di dalam HTML mengandung kutip yang di-escape,
 * sehingga potongan yang ditangkap bisa terputus di tengah objek.
 */
function extractJsonObject(input: string): string | null {
  const start = input.indexOf('{');
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < input.length; i++) {
    const ch = input[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return input.slice(start, i + 1);
    }
  }

  return null;
}

/**
 * Kumpulkan kandidat media dari HTML halaman IG.
 * Dipakai untuk postingan tunggal maupun carousel (sidecar).
 */
function parseMediaItems(html: string): IgItem[] {
  const items: IgItem[] = [];
  const seen = new Set<string>();

  const push = (url: string | undefined, isVideo: boolean, thumbnail?: string) => {
    if (!url) return;
    const clean = unescapeJsonFragment(url);
    if (!/^https:\/\//.test(clean) || clean.includes('...')) return;
    if (seen.has(clean)) return;
    seen.add(clean);
    items.push({ isVideo, mediaUrl: clean, thumbnail });
  };

  // 1. Blok utama: contextJSON berisi gql_data.shortcode_media (post tunggal).
  const ctxMatch = html.match(/"contextJSON":"([\s\S]*?)","/);
  if (ctxMatch) {
    const decoded = unescapeJsonFragment(ctxMatch[1]);
    const json = extractJsonObject(decoded);
    try {
      if (!json) throw new Error('blok JSON tidak ketemu');
      const parsed = JSON.parse(json);
      const media = parsed?.gql_data?.shortcode_media;
      if (media) {
        const thumb = typeof media.display_url === 'string' ? media.display_url : undefined;

        // Carousel: kumpulkan semua anak.
        const children = media.edge_sidecar_to_children?.edges;
        if (Array.isArray(children) && children.length) {
          for (const edge of children) {
            const node = edge?.node;
            if (!node) continue;
            if (node.is_video && node.video_url) push(node.video_url, true, node.display_url);
            else push(node.display_url, false);
          }
        } else if (media.is_video && media.video_url) {
          push(media.video_url, true, thumb);
        } else {
          push(media.display_url, false);
        }
      }
    } catch {
      // Blok tidak valid JSON utuh; lanjut ke pola cadangan di bawah.
    }
  }

  // 2. Cadangan: cari video_url mentah di seluruh HTML.
  if (!items.some((i) => i.isVideo)) {
    for (const m of html.matchAll(/"video_url":"([^"]+)"/g)) {
      push(m[1], true);
    }
  }

  // 3. Cadangan terakhir: display_url mentah (gambar).
  if (!items.length) {
    for (const m of html.matchAll(/"display_url":"([^"]+)"/g)) {
      push(m[1], false);
    }
  }

  return items;
}

export async function fetchInstagramMedia(rawUrl: string): Promise<ExtractedMedia> {
  const shortcode = instagramShortcode(rawUrl);
  if (!shortcode) {
    throw new ApiError('INVALID_URL', 'Link Instagram-nya ga dikenali.');
  }

  // Halaman /embed/captioned/ masih bisa dibaca server (halaman utama dibalas
  // versi tanpa data media untuk request non-browser). Yang utama dulu.
  const targets = [
    `https://www.instagram.com/reel/${shortcode}/embed/captioned/`,
    `https://www.instagram.com/p/${shortcode}/embed/captioned/`,
    `https://www.instagram.com/reel/${shortcode}/`,
    `https://www.instagram.com/p/${shortcode}/`,
  ];

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

      if (!res.ok) {
        lastError = new Error(`halaman IG balas ${res.status}`);
        continue;
      }

      const html = await res.text();
      const items = parseMediaItems(html);

      if (!items.length) {
        lastError = new Error('media tidak ditemukan di halaman');
        continue;
      }

      // Utamakan video; kalau carousel, ambil video pertama, kalau tidak ada ambil gambar pertama.
      const video = items.find((i) => i.isVideo);
      const chosen = video ?? items[0];

      const isVideo = chosen.isVideo;
      const total = items.length;

      return {
        title: isVideo ? 'Instagram video' : 'Instagram foto',
        thumbnail: chosen.thumbnail ?? items.find((i) => i.thumbnail)?.thumbnail,
        downloadUrl: chosen.mediaUrl,
        quality: 'UNKNOWN',
        qualityNote: total > 1 ? `${total} media, ambil ${isVideo ? 'video' : 'foto'} pertama` : undefined,
        mediaType: isVideo ? 'video' : 'image',
        source: 'instagram',
      };
    } catch (err) {
      lastError = err;
    }
  }

  const detail = lastError instanceof Error ? lastError.message : 'tidak diketahui';
  throw new ApiError(
    'UPSTREAM_FAILED',
    `Instagram nolak permintaannya (${detail}). Biasanya karena postingan privat atau IG minta login.`,
  );
}
