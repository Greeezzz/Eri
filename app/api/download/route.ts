import { NextResponse } from 'next/server';
import axios from 'axios';
// @ts-ignore
import { igdl, fbdown, youtube, ttdl } from 'btch-downloader';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ success: false, message: 'URL tidak boleh kosong' }, { status: 400 });
  }

  try {
    let downloadUrl = '';
    let thumbnail = '';
    let title = 'Downloaded Video';

    // 1. TikTok: Coba TikWM dulu (HD tanpa WM), fallback ke btch ttdl
    if (url.includes('tiktok.com')) {
      try {
        const tikRes = await axios.get(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          timeout: 10000,
        });
        if (tikRes.data && tikRes.data.code === 0) {
          downloadUrl = tikRes.data.data.hdplay || tikRes.data.data.play;
          thumbnail = tikRes.data.data.cover || '';
          title = tikRes.data.data.title || 'TikTok Video';
        }
      } catch (err: any) {
        console.warn('TikWM error, falling back to ttdl:', err.message);
      }

      if (!downloadUrl) {
        const res: any = await ttdl(url);
        if (res && (res.video || res.play || res.hdplay)) {
          downloadUrl = res.hdplay || res.video || res.play;
          thumbnail = res.cover || res.thumbnail || '';
          title = res.title || 'TikTok Video';
        }
      }
    }
    // 2. Instagram: Reels / Posts
    else if (url.includes('instagram.com')) {
      const res: any = await igdl(url);
      if (res && res.result && res.result.length > 0) {
        const first = res.result[0];
        downloadUrl = first.url;
        thumbnail = first.thumbnail || '';
        title = 'Instagram Video';
      }
    }
    // 3. Facebook: Watch / Reels / Posts
    else if (url.includes('facebook.com') || url.includes('fb.watch')) {
      const res: any = await fbdown(url);
      if (res && (res.HD || res.Normal_video)) {
        downloadUrl = res.HD || res.Normal_video; // prioritaskan HD
        title = 'Facebook Video HD';
      }
    }
    // 4. YouTube: Video / Shorts
    else if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const res: any = await youtube(url);
      if (res && res.mp4) {
        downloadUrl = res.mp4;
        thumbnail = res.thumbnail || '';
        title = res.title || 'YouTube Video';
      }
    }

    if (downloadUrl) {
      return NextResponse.json({
        success: true,
        data: { title, thumbnail, downloadUrl }
      });
    }

    return NextResponse.json({ success: false, message: 'Gagal mengambil video, pastikan link valid dan publik.' }, { status: 500 });
  } catch (err: any) {
    console.error("Download Error:", err.message);
    return NextResponse.json({ success: false, message: err.message || 'Terjadi kesalahan pada server.' }, { status: 500 });
  }
}
