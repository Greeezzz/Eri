import { verifyMediaSignature, sanitizeFilename } from '@/lib/sign';
import { safeFetch, UnsafeUrlError } from '@/lib/safe-fetch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function forbidden(reason: string) {
  return new Response(JSON.stringify({ success: false, code: 'FORBIDDEN', message: reason }), {
    status: 403,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function encodeRFC5987(value: string): string {
  return encodeURIComponent(value).replace(/['()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const verified = verifyMediaSignature(
    searchParams.get('kind'),
    searchParams.get('u'),
    searchParams.get('exp'),
    searchParams.get('sig'),
  );

  if (!verified.ok) {
    return forbidden('Tanda tangan link tidak valid atau sudah kedaluwarsa.');
  }

  const { kind, url } = verified;

  try {
    const upstream = await safeFetch(url, {
      timeoutMs: 25000,
      headers: kind === 'thumb' ? { Accept: 'image/avif,image/webp,image/*,*/*;q=0.8' } : { Accept: '*/*' },
    });

    if (!upstream.ok || !upstream.body) {
      return new Response(
        JSON.stringify({
          success: false,
          code: 'UPSTREAM_FAILED',
          message: `Sumbernya nolak (${upstream.status}). Coba ambil ulang videonya.`,
        }),
        { status: 502, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } },
      );
    }

    const headers = new Headers();
    const contentType = upstream.headers.get('content-type');
    headers.set('Content-Type', contentType || (kind === 'thumb' ? 'image/jpeg' : 'video/mp4'));

    const contentLength = upstream.headers.get('content-length');
    if (contentLength) headers.set('Content-Length', contentLength);

    if (kind === 'thumb') {
      headers.set('Cache-Control', 'public, max-age=3600');
    } else {
      const rawName = searchParams.get('name');
      const ext = (contentType || '').includes('image/') ? 'jpg' : 'mp4';
      const filename = sanitizeFilename(rawName, ext);
      headers.set('Cache-Control', 'no-store');
      headers.set(
        'Content-Disposition',
        `attachment; filename="${filename.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeRFC5987(filename)}`,
      );
    }

    return new Response(upstream.body, { status: 200, headers });
  } catch (err) {
    if (err instanceof UnsafeUrlError) {
      console.warn('[eri] proxy ditolak:', err.message);
      return forbidden('URL tujuan ditolak.');
    }
    console.error('[eri] proxy gagal:', err);
    return new Response(
      JSON.stringify({ success: false, code: 'UPSTREAM_FAILED', message: 'Gagal meneruskan file.' }),
      { status: 502, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } },
    );
  }
}
