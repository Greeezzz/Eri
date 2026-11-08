import { NextResponse } from 'next/server';
import axios from 'axios';

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

    if (url.includes('tiktok.com')) {
      const tikRes = await axios.get(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      if (tikRes.data && tikRes.data.code === 0) {
        downloadUrl = tikRes.data.data.hdplay || tikRes.data.data.play;
        thumbnail = tikRes.data.data.cover;
        title = tikRes.data.data.title;
      }
    } else {
      const cobaltRes = await axios.post('https://api.cobalt.tools/api/json', {
        url: url,
        vQuality: 'max'
      }, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0'
        }
      });

      if (cobaltRes.data && cobaltRes.data.url) {
        downloadUrl = cobaltRes.data.url;
        title = 'Downloaded Media';
      } else if (cobaltRes.data && cobaltRes.data.picker) {
        downloadUrl = cobaltRes.data.picker[0].url;
      }
    }

    if (downloadUrl) {
      return NextResponse.json({
        success: true,
        data: { title, thumbnail, downloadUrl }
      });
    }

    return NextResponse.json({ success: false, message: 'Gagal mengambil video, pastikan link valid.' }, { status: 500 });
  } catch (err: any) {
    console.error("Download Error:", err.message);
    return NextResponse.json({ success: false, message: 'Terjadi kesalahan pada server.' }, { status: 500 });
  }
}
