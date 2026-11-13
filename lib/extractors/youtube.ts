import { ApiError } from '../errors';
import { btch } from '../btch';
import type { ExtractedMedia } from '../types';

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export async function extractYouTube(url: string): Promise<ExtractedMedia> {
  let res: any;
  try {
    res = await btch('youtube', url);
  } catch {
    throw new ApiError('UPSTREAM_FAILED', 'YouTube lagi ga bisa diambil. Coba lagi nanti.');
  }

  const body = res?.result && typeof res.result === 'object' ? res.result : res;
  const media = str(body?.mp4) || str(body?.video);

  if (!media) {
    throw new ApiError('NOT_FOUND', 'Video YouTube-nya ga ketemu. Mungkin dibatasi umur atau region.');
  }

  return {
    title: str(body?.title) || 'YouTube video',
    thumbnail: str(body?.thumbnail),
    // Backend hanya memberi satu link mp4 tanpa info resolusi → jangan klaim HD.
    quality: 'UNKNOWN',
    downloadUrl: media,
    mediaType: 'video',
    source: 'btch',
  };
}
