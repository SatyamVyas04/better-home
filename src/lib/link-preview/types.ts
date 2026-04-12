export type LinkPreviewPlatform = "youtube" | "x" | "github" | "generic";
export type LinkPreviewQuality = "success" | "degraded";

export type LinkPreviewSource =
  | "generic-html"
  | "github-api"
  | "github-fallback"
  | "platform-fallback"
  | "x-fallback"
  | "x-oembed"
  | "youtube-oembed"
  | "youtube-thumbnail";

export interface LinkPreviewCacheEntry {
  title: string;
  description: string;
  imageUrl: string;
  imageDataUrl?: string;
  iconUrl: string;
  siteName: string;
  platform: LinkPreviewPlatform;
  fetchedAt: number;
  quality: LinkPreviewQuality;
  source: LinkPreviewSource;
  nextRetryAt: number;
  failureCount: number;
}

export const isPreviewQuality = (value: unknown): value is LinkPreviewQuality =>
  value === "success" || value === "degraded";

export const isPreviewSource = (value: unknown): value is LinkPreviewSource =>
  value === "generic-html" ||
  value === "github-api" ||
  value === "github-fallback" ||
  value === "platform-fallback" ||
  value === "x-fallback" ||
  value === "x-oembed" ||
  value === "youtube-oembed" ||
  value === "youtube-thumbnail";

export const isPreviewPlatform = (
  value: unknown
): value is LinkPreviewPlatform =>
  value === "youtube" ||
  value === "x" ||
  value === "github" ||
  value === "generic";
