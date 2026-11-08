'use client';

import { useEffect, useState } from 'react';
import './eri.css';

function stampNow() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export default function Home() {
  
  const [url, setUrl] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState(false);
  const [clock, setClock] = useState('');

  useEffect(() => {
    setClock(stampNow());
    const t = setInterval(() => setClock(stampNow()), 1000);
    return () => clearInterval(t);
  }, []);

  // ⬇⬇⬇ GANTI isi dua fungsi ini pakai logic lama kamu ⬇⬇⬇
  // UI cuma butuh: data.thumbnail, data.title, data.quality, data.downloadUrl
  async function handleGet(e) {
    e?.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError('');
    setData(null);
    try {
      const res = await fetch(`/api/download?url=${encodeURIComponent(url)}`);
      const json = await res.json();
      if (json.success && json.data) {
        const item = {
          thumbnail: json.data.thumbnail,
          title: json.data.title,
          quality: 'HD · tanpa watermark',
          downloadUrl: json.data.downloadUrl,
        };
        setData(item);
        
      } else {
        throw new Error(json.message || 'Gagal mengambil video');
      }
    } catch (err) {
      setError(err.message || 'Ada yang salah, coba lagi.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDirectDownload() {
    if (!data?.downloadUrl) return;
    setDownloading(true);
    try {
      const res = await fetch(data.downloadUrl);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'eri-downloader.mp4';
      a.click();
      URL.revokeObjectURL(a.href);
      // adegan ending: layar putih
      setFlash(true);
      setTimeout(() => setFlash(false), 2300);
    } catch {
      setError('Download langsung gagal.');
    } finally {
      setDownloading(false);
    }
  }
  // ⬆⬆⬆ sampai sini ⬆⬆⬆

  return (
    <main className="eri">
      {/* filter garis tinta goyang */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
        <filter id="rough" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="4" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="5" />
        </filter>
        <filter id="roughLight" x="-3%" y="-3%" width="106%" height="106%">
          <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="9" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="4" />
        </filter>
      </svg>

      <div className={`flash ${flash ? 'on' : ''}`} aria-hidden>
        <span>さよなら絵梨</span>
      </div>

      <header className="top rise">
        <span className="brand">Eri <i>downloader</i></span>
        <time>{clock}</time>
      </header>

      <div className="main">
        <section className="left">
          <p className="jp rise" style={{ '--d': '.5s' }} aria-hidden>さよなら絵梨</p>

          <h1 className="word rise" style={{ '--d': '.1s' }} aria-label="Eri Downloader">
            <span className="big">Eri</span>
            <small>downloader</small>
          </h1>
          <svg className="scribble" viewBox="0 0 400 40" preserveAspectRatio="none" aria-hidden>
            <path d="M6 24 C 60 6, 110 36, 170 18 S 280 8, 394 22" />
          </svg>

          <p className="lede rise" style={{ '--d': '.3s' }}>
            Video TikTok, Instagram, Facebook, dan YouTube, pulang <b>HD tanpa watermark</b>.
            Tempel link, tunggu sebentar, selesai.
          </p>

          <form className="script rise" style={{ '--d': '.45s' }} onSubmit={handleGet}>
            <label className="line">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="tempel link di sini…"
                aria-label="Link video"
              />
            </label>
            <button className="stamp" type="submit" disabled={loading}>
              {loading ? '…' : 'ambil'}
            </button>
          </form>

          {error && <p className="err">{error}</p>}
        </section>

        <section className="reel rise" style={{ '--d': '.35s' }}>
          {data ? (
            <div className="frame" key={data.thumbnail}>
              <div className="ink">
                <div className="shot">
                  <span className="ts">▶ {clock.split(' ')[0]}</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={data.thumbnail} alt={data.title || 'Thumbnail video'} />
                </div>
              </div>

              <div className="narr ink">
                <p>{data.title}</p>
                <small>{data.quality}</small>
              </div>

              <button className="dl ink" type="button" onClick={handleDirectDownload} disabled={downloading}>
                <span>{downloading ? 'mengunduh…' : 'Download langsung'}</span>
                <span>↓</span>
              </button>
            </div>
          ) : (
            <div className="frame">
              <div className="ink">
                <div className="shot empty">
                  <span className="ts">▶ {clock.split(' ')[0]}</span>
                  <b>{loading ? '…' : 'kosong.'}</b>
                  <span>{loading ? 'lagi merekam videonya' : 'tempel link dulu, nanti videonya muncul di sini.'}</span>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      <footer className="foot">
        <span>dibuat oleh <em>Rover &amp; Chelo</em></span>
        <span>terinspirasi さよなら絵梨 — Tatsuki Fujimoto</span>
      </footer>
    </main>
  );
}
