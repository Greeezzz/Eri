export type Quality = 'HD' | 'SD' | 'UNKNOWN';
export type MediaType = 'video' | 'image';
export type MediaSource = 'tikwm' | 'btch';

/** Hasil normalisasi dari setiap extractor, sebelum ditandatangani proxy. */
export type ExtractedMedia = {
  title: string;
  thumbnail?: string;
  /** URL CDN upstream (bukan URL proxy). */
  downloadUrl: string;
  quality: Quality;
  mediaType: MediaType;
  source: MediaSource;
};

/** Bentuk data yang dikirim ke client (5.2). */
export type DownloadPayload = {
  platform: string;
  title: string;
  thumbnail: string | null;
  downloadUrl: string;
  quality: Quality;
  mediaType: MediaType;
  source: MediaSource;
  filename: string;
};
