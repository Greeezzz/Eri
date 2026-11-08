'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { Toaster, toast } from 'sonner';
import { ArrowDown, ClipboardPaste, Loader2 } from 'lucide-react';
import './eri.css';

const PLATFORMS = ['TikTok', 'Instagram', 'Facebook', 'YouTube'];

function stampNow() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/* tombol yang ketarik kursor */
function Magnetic({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useSpring(0, { stiffness: 220, damping: 14 });
  const y = useSpring(0, { stiffness: 220, damping: 14 });
  return (
    <motion.div
      ref={ref}
      className="magnet"
      style={{ x, y }}
      onMouseMove={(e) => {
        if (!ref.current) return;
        const r = ref.current.getBoundingClientRect();
        x.set((e.clientX - r.left - r.width / 2) * 0.35);
        y.set((e.clientY - r.top - r.height / 2) * 0.35);
      }}
      onMouseLeave={() => { x.set(0); y.set(0); }}
    >
      {children}
    </motion.div>
  );
}

/* panel hasil yang miring ngikutin kursor */
function Tilt({ children, ...rest }: { children: React.ReactNode; className?: string; style?: any }) {
  const ref = useRef<HTMLElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [7, -7]), { stiffness: 150, damping: 16 });
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-9, 9]), { stiffness: 150, damping: 16 });
  return (
    <motion.section
      ref={ref}
      style={{ rotateX, rotateY, transformPerspective: 1000 }}
      onMouseMove={(e) => {
        if (!ref.current) return;
        const r = ref.current.getBoundingClientRect();
        mx.set((e.clientX - r.left) / r.width - 0.5);
        my.set((e.clientY - r.top) / r.height - 0.5);
      }}
      onMouseLeave={() => { mx.set(0); my.set(0); }}
      {...rest}
    >
      {children}
    </motion.section>
  );
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [flash, setFlash] = useState(false);
  const [clock, setClock] = useState('');
  const [pIdx, setPIdx] = useState(0);

  useEffect(() => {
    setClock(stampNow());
    const t = setInterval(() => setClock(stampNow()), 1000);
    const c = setInterval(() => setPIdx((i) => (i + 1) % PLATFORMS.length), 2200);
    return () => { clearInterval(t); clearInterval(c); };
  }, []);

  async function pasteFromClipboard() {
    try {
      const t = await navigator.clipboard.readText();
      if (t) setUrl(t.trim());
    } catch {
      toast('Izinkan akses clipboard dulu ya.');
    }
  }

  async function handleGet(e?: React.FormEvent) {
    e?.preventDefault();
    if (!url.trim()) { toast.error('Link-nya masih kosong.'); return; }
    setLoading(true);
    setData(null);
    try {
      const res = await fetch(`/api/download?url=${encodeURIComponent(url)}`);
      if (!res.ok) throw new Error('Gagal ambil video');
      const json = await res.json();
      setData({
        thumbnail: json.data.thumbnail,
        title: json.data.title,
        quality: 'HD · tanpa watermark',
        downloadUrl: json.data.downloadUrl,
      });
      toast.success('Videonya ketemu.');
    } catch (err: any) {
      toast.error(err.message || 'Ada yang salah, coba lagi.');
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
      toast.error('Download langsung gagal.');
    } finally {
      setDownloading(false);
    }
  }
  // ⬆⬆⬆ sampai sini ⬆⬆⬆

  return (
    <main className="eri">
      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            background: '#E99B83',
            color: '#202D49',
            border: '2px solid #202D49',
            borderRadius: 0,
            fontFamily: "'Shippori Mincho B1', serif",
            fontWeight: 500,
            fontSize: 16,
          },
        }}
      />

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
          <p className="jp rise" style={{ '--d': '.5s' } as React.CSSProperties} aria-hidden>さよなら絵梨</p>

          <h1 className="word" aria-label="Eri Downloader">
            <span className="letters" aria-hidden>
              {'Eri'.split('').map((c, i) => (
                <motion.span
                  key={i}
                  className="big"
                  initial={{ y: '45%', opacity: 0, rotate: -7 }}
                  animate={{ y: 0, opacity: 1, rotate: 0 }}
                  transition={{ delay: 0.1 + i * 0.13, type: 'spring', stiffness: 130, damping: 13 }}
                  whileHover={{ y: -18, rotate: i % 2 ? 5 : -5 }}
                  style={{ display: 'inline-block' }}
                >
                  {c}
                </motion.span>
              ))}
            </span>
            <small>downloader</small>
          </h1>
          <svg className="scribble" viewBox="0 0 400 40" preserveAspectRatio="none" aria-hidden>
            <path d="M6 24 C 60 6, 110 36, 170 18 S 280 8, 394 22" />
          </svg>

          <p className="lede rise" style={{ '--d': '.35s' } as React.CSSProperties}>
            Video{' '}
            <span className="cycle">
              <AnimatePresence mode="wait">
                <motion.b
                  key={pIdx}
                  initial={{ y: 22, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -22, opacity: 0 }}
                  transition={{ duration: 0.22 }}
                >
                  {PLATFORMS[pIdx]}
                </motion.b>
              </AnimatePresence>
            </span>
            {' '}pulang <mark>HD tanpa watermark</mark>. Tempel link, tunggu sebentar, selesai.
          </p>

          <form className="script rise" style={{ '--d': '.5s' } as React.CSSProperties} onSubmit={handleGet}>
            <label className="line">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="tempel link di sini…"
                aria-label="Link video"
              />
              <button type="button" className="paste" onClick={pasteFromClipboard} aria-label="Tempel dari clipboard">
                <ClipboardPaste size={22} />
              </button>
            </label>
            <Magnetic>
              <button className="stamp" type="submit" disabled={loading}>
                {loading ? <Loader2 size={32} className="spinning" /> : 'ambil'}
              </button>
            </Magnetic>
          </form>
        </section>

        <Tilt className="reel rise" style={{ '--d': '.4s' } as React.CSSProperties}>
          <AnimatePresence mode="wait">
            {data ? (
              <motion.div
                className="frame"
                key={data.thumbnail}
                initial={{ opacity: 0, y: 34, rotate: -3 }}
                animate={{ opacity: 1, y: 0, rotate: 0 }}
                exit={{ opacity: 0, y: -24, rotate: 2 }}
                transition={{ type: 'spring', stiffness: 160, damping: 16 }}
              >
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
                  <ArrowDown size={28} strokeWidth={2.6} />
                </button>
              </motion.div>
            ) : (
              <motion.div
                className="frame"
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="ink">
                  <div className="shot empty">
                    <span className="ts">▶ {clock.split(' ')[0]}</span>
                    <b>{loading ? '…' : 'kosong.'}</b>
                    <span>{loading ? 'lagi merekam videonya' : 'tempel link dulu, nanti videonya muncul di sini.'}</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Tilt>
      </div>
    </main>
  );
}
