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
  description: string;
  failureCount: number;
  fetchedAt: number;
  iconUrl: string;
  imageDataUrl?: string;
  imageUrl: string;
  nextRetryAt: number;
  platform: LinkPreviewPlatform;
  quality: LinkPreviewQuality;
  siteName: string;
  source: LinkPreviewSource;
  title: string;
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
