import { NextResponse } from 'next/server';
import { detectPlatform } from '@/lib/platform';
import { extractMedia } from '@/lib/extractors';
import { ApiError, toApiError } from '@/lib/errors';
import { signMediaUrl, sanitizeFilename } from '@/lib/sign';
import type { DownloadPayload } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function fail(err: ApiError) {
  return NextResponse.json(
    { success: false, code: err.code, message: err.message },
    { status: err.status },
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get('url');

  const detected = detectPlatform(raw);
  if (!detected.ok) {
    return detected.code === 'INVALID_URL'
      ? fail(new ApiError('INVALID_URL', 'Link-nya belum bener, coba cek lagi.'))
      : fail(
          new ApiError('UNSUPPORTED_PLATFORM', 'Baru bisa TikTok, Instagram, Facebook, sama YouTube.'),
        );
  }

  try {
    const media = await extractMedia(detected.platform, (raw as string).trim());

    if (!media.downloadUrl || typeof media.downloadUrl !== 'string') {
      throw new ApiError('UPSTREAM_FAILED', 'Sumbernya ga ngasih file yang bisa diambil.');
    }

    const filename = sanitizeFilename(media.title, media.mediaType === 'image' ? 'jpg' : 'mp4');

    const payload: DownloadPayload = {
      platform: detected.platform,
      title: media.title,
      thumbnail: media.thumbnail ? signMediaUrl('thumb', media.thumbnail) : null,
      downloadUrl: signMediaUrl('video', media.downloadUrl, filename),
      quality: media.quality,
      mediaType: media.mediaType,
      source: media.source,
      filename,
    };

    return NextResponse.json(
      { success: true, data: payload },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    // Kalau extractor sudah kasih ApiError dengan pesan spesifik, teruskan apa adanya.
    const out = err instanceof ApiError ? err : toApiError(err);
    console.error('[eri] download gagal:', out.code, err);
    return fail(out);
  }
}
