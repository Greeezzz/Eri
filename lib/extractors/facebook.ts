import { ApiError } from '../errors';
import { btch } from '../btch';
import type { ExtractedMedia } from '../types';

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export async function extractFacebook(url: string): Promise<ExtractedMedia> {
  let res: any;
  try {
    res = await btch('fbdown', url);
  } catch {
    throw new ApiError('UPSTREAM_FAILED', 'Facebook lagi ga bisa diambil. Coba lagi nanti.');
  }

  // Backend bisa membalas { result: {...} } atau objek langsung.
  const body = res?.result && typeof res.result === 'object' ? res.result : res;

  const hd = str(body?.HD) || str(body?.hd);
  const sd = str(body?.Normal_video) || str(body?.SD) || str(body?.sd);
  const media = hd || sd;

  if (!media) {
    throw new ApiError('NOT_FOUND', 'Video Facebook-nya ga ketemu. Pastiin postingannya publik.');
  }

  // Backend kadang mengisi HD dan SD dengan URL yang sama; kalau begitu "HD" cuma klaim kosong.
  const hdIsDistinct = Boolean(hd && sd && hd !== sd);

  return {
    title: 'Facebook video',
    thumbnail: str(body?.thumbnail) || str(body?.Thumbnail),
    downloadUrl: media,
    // HD hanya kalau HD memang berbeda dari versi SD. Kalau URL-nya sama, kualitas tidak terbukti.
    quality: hdIsDistinct ? 'HD' : 'UNKNOWN',
    mediaType: 'video',
    source: 'btch',
  };
}
