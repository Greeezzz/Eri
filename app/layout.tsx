export const metadata = {
  title: 'Eri - Downloader',
  description: 'Download TikTok, IG, FB, YouTube HD Tanpa Watermark',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-zinc-950 text-zinc-100 font-sans antialiased">{children}</body>
    </html>
  )
}
