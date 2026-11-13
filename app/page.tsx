'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { Toaster, toast } from 'sonner';
import { ArrowDown, ClipboardPaste, ExternalLink, Loader2 } from 'lucide-react';

const PLATFORMS = ['TikTok', 'Instagram', 'Facebook', 'YouTube'] as const;

type Quality = 'HD' | 'SD' | 'UNKNOWN';

type Result = {
  platform: string;
  title: string;
  thumbnail: string | null;
  downloadUrl: string;
  quality: Quality;
  mediaType: 'video' | 'image';
  filename: string;
};

const QUALITY_LABEL: Record<Quality, string> = {
  HD: 'HD',
  SD: 'SD',
  UNKNOWN: 'kualitas asli',
};

const PLATFORM_LABEL: Record<string, string> = {
  tiktok: 'tiktok',
  instagram: 'instagram',
  facebook: 'facebook',
  youtube: 'youtube',
};

function stampNow(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(
    d.getMinutes(),
  )}:${p(d.getSeconds())}`;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Efek kursor cuma berguna di perangkat berpointer halus (bukan layar sentuh). */
function useFinePointer(): boolean {
  const [fine, setFine] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    const update = () => setFine(mq.matches && !prefersReducedMotion());
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return fine;
}

function Magnetic({ children, active }: { children: React.ReactNode; active: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useSpring(0, { stiffness: 220, damping: 14 });
  const y = useSpring(0, { stiffness: 220, damping: 14 });

  if (!active) return <div className="magnet">{children}</div>;

  return (
    <motion.div
      ref={ref}
      className="magnet"
      style={{ x, y }}
      onMouseMove={(e) => {
        if (!ref.current) return;
        const r = ref.current.getBoundingClientRect();
        x.set((e.clientX - r.left - r.width / 2) * 0.28);
        y.set((e.clientY - r.top - r.height / 2) * 0.28);
      }}
      onMouseLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}

function Tilt({
  children,
  active,
  ...rest
}: {
  children: React.ReactNode;
  active: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [5, -5]), { stiffness: 150, damping: 16 });
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-6, 6]), { stiffness: 150, damping: 16 });

  return (
    <motion.section
      ref={ref}
      style={active ? { rotateX, rotateY, transformPerspective: 1200 } : undefined}
      onMouseMove={
        active
          ? (e) => {
              if (!ref.current) return;
              const r = ref.current.getBoundingClientRect();
              mx.set((e.clientX - r.left) / r.width - 0.5);
              my.set((e.clientY - r.top) / r.height - 0.5);
            }
          : undefined
      }
      onMouseLeave={
        active
          ? () => {
              mx.set(0);
              my.set(0);
            }
          : undefined
      }
      {...rest}
    >
      {children}
    </motion.section>
  );
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [data, setData] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [flash, setFlash] = useState(false);
  const [clock, setClock] = useState('');
  const [pIdx, setPIdx] = useState(0);
  const [status, setStatus] = useState('');

  const fine = useFinePointer();
  const resultRef = useRef<HTMLDivElement>(null);
  const scrollToResultRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setClock(stampNow());
    const t = setInterval(() => setClock(stampNow()), 1000);
    const c = setInterval(() => setPIdx((i) => (i + 1) % PLATFORMS.length), 2400);
    return () => {
      clearInterval(t);
      clearInterval(c);
    };
  }, []);

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text.trim());
        setStatus('Link ketempel dari clipboard.');
      }
    } catch {
      toast('Izinkan akses clipboard dulu ya.');
    }
  }

  async function handleGet(e?: React.FormEvent) {
    e?.preventDefault();
    const clean = url.trim();
    if (!clean) {
      toast.error('Link-nya masih kosong.');
      setStatus('Link masih kosong.');
      return;
    }

    setLoading(true);
    setData(null);
    setStatus('Lagi ngambil videonya…');

    try {
      const res = await fetch(`/api/download?url=${encodeURIComponent(clean)}`);
      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.success) {
        const message = json?.message || 'Ada yang salah, coba lagi.';
        toast.error(message);
        setStatus(message);
        return;
      }

      const next: Result = json.data;
      setData(next);
      toast.success('Videonya ketemu.');
      setStatus(
        `Ketemu: ${next.title} · ${QUALITY_LABEL[next.quality] ?? 'kualitas tidak diketahui'}.`,
      );

      // Auto-scroll ke kartu hasil. Dihitung manual lalu diulang setelah thumbnail
      // selesai load, karena tinggi kartu berubah saat gambar masuk.
      scrollToResultRef.current = () => {
        const el = resultRef.current;
        if (!el) return;
        const top = el.getBoundingClientRect().top + window.scrollY - 12;
        window.scrollTo({
          top: Math.max(0, top),
          behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        });
      };
      requestAnimationFrame(() => scrollToResultRef.current?.());
      window.setTimeout(() => scrollToResultRef.current?.(), 400);
    } catch {
      toast.error('Ga bisa nyambung ke server. Coba lagi.');
      setStatus('Ga bisa nyambung ke server.');
    } finally {
      setLoading(false);
    }
  }

  function handleSave() {
    if (!data) return;
    setFlash(true);
    setTimeout(() => setFlash(false), 2300);
    setStatus(`Menyimpan ${data.filename}`);
  }

  const isImage = data?.mediaType === 'image';
  const qualityLabel = data ? QUALITY_LABEL[data.quality] ?? 'kualitas asli' : '';

  return (
    <>
      {/* Toaster di luar <main>: section-nya ikut jadi anak grid kalau ditaruh di dalam. */}
      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            background: 'var(--rose)',
            color: 'var(--navy)',
            border: '2px solid var(--navy)',
            borderRadius: 0,
            fontFamily: 'var(--gothic)',
            fontWeight: 700,
            fontSize: 15,
          },
        }}
      />

      <main className="eri">

      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden focusable="false">
        <filter id="rough" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="4" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="4" />
        </filter>
        <filter id="roughLight" x="-3%" y="-3%" width="106%" height="106%">
          <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="9" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="3" />
        </filter>
        <filter id="duotone" colorInterpolationFilters="sRGB">
          <feColorMatrix
            type="matrix"
            values="0.2126 0.7152 0.0722 0 0
                    0.2126 0.7152 0.0722 0 0
                    0.2126 0.7152 0.0722 0 0
                    0      0      0      1 0"
          />
          <feComponentTransfer>
            <feFuncR type="table" tableValues="0.1255 0.8471" />
            <feFuncG type="table" tableValues="0.1765 0.4588" />
            <feFuncB type="table" tableValues="0.2863 0.5686" />
          </feComponentTransfer>
        </filter>
      </svg>

      <div className={`flash ${flash ? 'on' : ''}`} aria-hidden>
        <span>さよなら絵梨</span>
      </div>

      <header className="top rise">
        <span className="brand">
          Eri <i>downloader</i>
        </span>
        <span className="top-meta" aria-hidden>
          № 001 · edisi duotone
        </span>
        <time>{clock}</time>
      </header>

      <div className="main">
        <section className="left">
          <p className="jp rise" style={{ '--d': '.5s' } as React.CSSProperties} aria-hidden>
            さよなら絵梨
          </p>

          <h1 className="word" aria-label="Eri downloader">
            <span className="letters" aria-hidden>
              {'Eri'.split('').map((c, i) => (
                <motion.span
                  key={i}
                  className="big"
                  initial={{ y: '40%', opacity: 0, rotate: -6 }}
                  animate={{ y: 0, opacity: 1, rotate: 0 }}
                  transition={{ delay: 0.08 + i * 0.1, type: 'spring', stiffness: 140, damping: 14 }}
                  whileHover={fine ? { y: -12, rotate: i % 2 ? 4 : -4 } : undefined}
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

          <div className="rule rise" style={{ '--d': '.28s' } as React.CSSProperties} aria-hidden />

          <p className="lede rise" style={{ '--d': '.3s' } as React.CSSProperties}>
            Video{' '}
            <span className="cycle">
              <span className="sr-only">{PLATFORMS.join(', ')}</span>
              <AnimatePresence mode="wait" initial={false}>
                <motion.b
                  key={pIdx}
                  aria-hidden
                  initial={{ y: 18, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -18, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {PLATFORMS[pIdx]}
                </motion.b>
              </AnimatePresence>
            </span>{' '}
            pulang dengan <mark>kualitas terbaik yang tersedia</mark>. Tempel link, tunggu
            sebentar, selesai.
          </p>

          <form
            className="script rise"
            style={{ '--d': '.4s' } as React.CSSProperties}
            onSubmit={handleGet}
          >
            <label className="line">
              <span className="sr-only">Link video</span>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="tempel link di sini…"
                inputMode="url"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                enterKeyHint="go"
              />
              <button
                type="button"
                className="paste"
                onClick={pasteFromClipboard}
                aria-label="Tempel link dari clipboard"
              >
                <ClipboardPaste size={22} aria-hidden />
              </button>
            </label>

            <Magnetic active={fine}>
              <button className="stamp" type="submit" disabled={loading} aria-label="Ambil video">
                {loading ? <Loader2 size={30} className="spinning" aria-hidden /> : 'ambil'}
              </button>
            </Magnetic>
          </form>

          <p className="status" role="status" aria-live="polite">
            {status}
          </p>

          <div className="footnote" aria-hidden>
            <span>tiktok</span>
            <span>instagram</span>
            <span>facebook</span>
            <span>youtube</span>
          </div>
        </section>

        <div className="result-col" ref={resultRef}>
          <Tilt className="reel rise" active={fine} style={{ '--d': '.35s' } as React.CSSProperties}>
            <AnimatePresence mode="wait" initial={false}>
              {data ? (
                <motion.div
                  className="frame"
                  key={data.downloadUrl}
                  initial={{ opacity: 0, y: 26, rotate: -2 }}
                  animate={{ opacity: 1, y: 0, rotate: 0 }}
                  exit={{ opacity: 0, y: -18, rotate: 1.5 }}
                  transition={{ type: 'spring', stiffness: 170, damping: 18 }}
                >
                  <div className="chips">
                    <span className="chip solid">{qualityLabel}</span>
                    <span className="chip">[ {PLATFORM_LABEL[data.platform] ?? data.platform} ]</span>
                  </div>

                  <div className="ink shotwrap">
                    <div className="shot">
                      <span className="ts">▶ {clock.split(' ')[0]}</span>
                      {data.thumbnail ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={data.thumbnail}
                          alt=""
                          onLoad={() => {
                            // Tinggi kartu berubah setelah gambar masuk: rapikan posisi sekali lagi.
                            window.setTimeout(() => scrollToResultRef.current?.(), 60);
                          }}
                        />
                      ) : (
                        <span className="noimg" aria-hidden>
                          絵
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="narr ink">
                    <p>{data.title}</p>
                    <small>
                      {isImage ? 'foto · ' : 'video · '}
                      {data.quality === 'UNKNOWN' ? 'resolusi belum diketahui' : data.quality}
                    </small>
                  </div>

                  <a
                    className="dl ink"
                    href={data.downloadUrl}
                    download={data.filename}
                    onClick={handleSave}
                  >
                    <span>{isImage ? 'Simpan foto' : 'Simpan video'}</span>
                    <ArrowDown size={26} strokeWidth={2.6} aria-hidden />
                  </a>

                  <a
                    className="fallback"
                    href={data.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink size={14} aria-hidden /> kalau gagal, buka di tab baru
                  </a>
                </motion.div>
              ) : (
                <motion.div
                  className="frame"
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="chips">
                    <span className="chip">[ standby ]</span>
                  </div>

                  <div className="ink shotwrap">
                    <div className="shot empty">
                      <span className="ts">▶ {clock.split(' ')[0]}</span>
                      {loading ? (
                        <Loader2 size={54} className="spinning empty-spin" aria-hidden />
                      ) : (
                        <span className="kanji" aria-hidden>
                          空
                        </span>
                      )}
                      <span className="empty-line">
                        {loading ? 'lagi ngambil videonya' : 'tempel link di kolom sebelah'}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
          </AnimatePresence>
          </Tilt>

          <p className="colophon" aria-hidden>
            tempel · ambil · simpan
          </p>
        </div>
      </div>
      </main>
    </>
  );
}
