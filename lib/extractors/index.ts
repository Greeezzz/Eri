import { ApiError } from '../errors';
import type { ExtractedMedia } from '../types';
import { extractTikTok } from './tiktok';
import { extractInstagram } from './instagram';
import { extractFacebook } from './facebook';
import { extractYouTube } from './youtube';
import type { Platform } from '../platform';

const EXTRACTORS: Record<Platform, (url: string) => Promise<ExtractedMedia>> = {
  tiktok: extractTikTok,
  instagram: extractInstagram,
  facebook: extractFacebook,
  youtube: extractYouTube,
};

export async function extractMedia(platform: Platform, url: string): Promise<ExtractedMedia> {
  const fn = EXTRACTORS[platform];
  if (!fn) throw new ApiError('UNSUPPORTED_PLATFORM', 'Platform-nya belum didukung.');
  return fn(url);
}

export { extractTikTok, extractInstagram, extractFacebook, extractYouTube };
