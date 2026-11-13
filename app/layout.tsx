import type { Metadata } from 'next';
import { Shippori_Mincho_B1, Zen_Kaku_Gothic_New, DotGothic16 } from 'next/font/google';
import './eri.css';

const mincho = Shippori_Mincho_B1({
  weight: ['500', '800'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mincho',
});

const gothic = Zen_Kaku_Gothic_New({
  weight: ['500', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-gothic',
});

const dot = DotGothic16({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-dot',
});

export const metadata: Metadata = {
  title: 'Eri · downloader',
  description:
    'Tempel link TikTok, Instagram, Facebook, atau YouTube. Videonya pulang dengan kualitas terbaik yang tersedia.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${mincho.variable} ${gothic.variable} ${dot.variable}`}>
      <body>{children}</body>
    </html>
  );
}
