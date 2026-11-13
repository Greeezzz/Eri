import axios from 'axios';
import { ApiError } from '../errors';
import { btch } from '../btch';
import type { ExtractedMedia } from '../types';

const TIKWM = 'https://www.tikwm.com/api/';

function firstString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0) return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === 'string' && item.length > 0) return item;
    }
  }
  return undefined;
}

function absolute(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('/')) return `https://www.tikwm.com${url}`;
  return url;
}

export async function extractTikTok(url: string): Promise<ExtractedMedia> {
  // 1. TikWM: hdplay = HD tanpa watermark, play = SD tanpa watermark.
  try {
    const res = await axios.get(TIKWM, {
      params: { url, hd: 1 },
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
        Referer: 'https://www.tikwm.com/',
      },
      timeout: 15000,
      validateStatus: () => true,
    });

    const body = res.data as any;
    if (body && body.code === 0 && body.data) {
      const hd = firstString(body.data.hdplay);
      const sd = firstString(body.data.play);
      const media = hd || sd;

      if (media) {
        return {
          title: String(body.data.title || 'TikTok video').trim() || 'TikTok video',
          thumbnail: absolute(firstString(body.data.cover) || firstString(body.data.origin_cover)),
          downloadUrl: absolute(media) as string,
          quality: hd ? 'HD' : 'SD',
          mediaType: 'video',
          source: 'tikwm',
        };
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[eri] TikWM gagal, coba fallback btch:', msg);
  }

  // 2. Fallback btch ttdl: `video` berupa array, ambil elemen pertama yang string.
  try {
    const res = await btch('ttdl', url);
    const media = firstString(res?.hdplay) || firstString(res?.video) || firstString(res?.play);
    if (media) {
      return {
        title: String(res?.title || 'TikTok video').trim() || 'TikTok video',
        thumbnail: absolute(firstString(res?.thumbnail) || firstString(res?.cover)),
        downloadUrl: absolute(media) as string,
        quality: res?.hdplay ? 'HD' : 'UNKNOWN',
        mediaType: 'video',
        source: 'btch',
      };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[eri] btch ttdl gagal:', msg);
  }

  throw new ApiError('NOT_FOUND', 'Video TikTok-nya ga ketemu. Pastiin link-nya publik dan masih ada.');
}
