import {
  PREVIEW_DEGRADED_RETRY_BASE_MS,
  PREVIEW_DEGRADED_RETRY_MAX_MS,
  PREVIEW_SUCCESS_TTL_MS,
} from "./constants";
import { getDefaultIconUrl } from "./icon-metadata";
import {
  getHostLabel,
  getPreviewPlatform,
  getXProfileHandle,
  getXStatusDetails,
  getYouTubeThumbnailUrl,
  parseGitHubResource,
} from "./platform";
import {
  isPreviewPlatform,
  isPreviewQuality,
  isPreviewSource,
  type LinkPreviewCacheEntry,
  type LinkPreviewPlatform,
  type LinkPreviewQuality,
  type LinkPreviewSource,
} from "./types";
import { clipText, getNonEmptyString } from "./utils";

export interface BuildCacheEntryOptions {
  description: string;
  imageDataUrl?: string;
  iconUrl: string;
  imageUrl: string;
  now: number;
  platform: LinkPreviewPlatform;
  previousEntry?: LinkPreviewCacheEntry | null;
  quality: LinkPreviewQuality;
  siteName: string;
  source: LinkPreviewSource;
  title: string;
}

export const getDegradedRetryDelayMs = (failureCount: number): number => {
  const normalizedFailureCount = Math.max(1, Math.trunc(failureCount));
  const exponentialFactor = 2 ** (normalizedFailureCount - 1);
  return Math.min(
    PREVIEW_DEGRADED_RETRY_BASE_MS * exponentialFactor,
    PREVIEW_DEGRADED_RETRY_MAX_MS
  );
};

export const buildCacheEntry = ({
  description,
  imageDataUrl,
  iconUrl,
  imageUrl,
  now,
  platform,
  previousEntry,
  quality,
  siteName,
  source,
  title,
}: BuildCacheEntryOptions): LinkPreviewCacheEntry => {
  const normalizedImageUrl = getNonEmptyString(imageUrl);
  const normalizedImageDataUrl = getNonEmptyString(imageDataUrl);
  const previousFailureCount =
    previousEntry?.quality === "degraded" ? previousEntry.failureCount : 0;
  const nextFailureCount = quality === "success" ? 0 : previousFailureCount + 1;
  const nextRetryAt =
    quality === "success"
      ? now + PREVIEW_SUCCESS_TTL_MS
      : now + getDegradedRetryDelayMs(nextFailureCount);

  return {
    title: getNonEmptyString(title),
    description: getNonEmptyString(description),
    iconUrl: getNonEmptyString(iconUrl),
    imageUrl: normalizedImageUrl,
    imageDataUrl:
      normalizedImageDataUrl ||
      (previousEntry?.imageUrl === normalizedImageUrl
        ? getNonEmptyString(previousEntry.imageDataUrl)
        : ""),
    siteName: getNonEmptyString(siteName),
    platform,
    fetchedAt: now,
    quality,
    source,
    nextRetryAt,
    failureCount: nextFailureCount,
  };
};

const getPlatformFallbackTitle = (
  targetUrl: string,
  platform: LinkPreviewPlatform
): string => {
  if (platform === "x") {
    const statusDetails = getXStatusDetails(targetUrl);
    if (statusDetails) {
      return `@${statusDetails.username} on x`;
    }

    const handle = getXProfileHandle(targetUrl);
    return handle ? `@${handle} on x` : "x.com";
  }

  if (platform === "github") {
    const details = parseGitHubResource(targetUrl);
    if (!details) {
      return "github";
    }

    if (details.kind === "user") {
      return `@${details.owner} on github`;
    }

    if (details.kind === "repo" && details.repo) {
      return `${details.owner}/${details.repo}`;
    }

    if (details.kind === "issue" && details.repo && details.number) {
      return `${details.owner}/${details.repo} #${details.number}`;
    }

    if (details.kind === "pull" && details.repo && details.number) {
      return `${details.owner}/${details.repo} PR #${details.number}`;
    }

    return "github";
  }

  if (platform === "youtube") {
    return "youtube";
  }

  return getHostLabel(targetUrl);
};

const getPlatformFallbackDescription = (
  targetUrl: string,
  platform: LinkPreviewPlatform
): string => {
  if (platform === "x") {
    const statusDetails = getXStatusDetails(targetUrl);
    if (statusDetails) {
      return `tweet by @${statusDetails.username}`;
    }
  }

  if (platform === "github") {
    const details = parseGitHubResource(targetUrl);
    if (details?.kind === "issue") {
      return "github issue preview";
    }

    if (details?.kind === "pull") {
      return "github pull request preview";
    }
  }

  return "";
};

export const buildDegradedEntry = (
  targetUrl: string,
  platform: LinkPreviewPlatform,
  now: number,
  previousEntry?: LinkPreviewCacheEntry | null,
  source: LinkPreviewSource = "platform-fallback"
): LinkPreviewCacheEntry => {
  const fallbackSiteName = getHostLabel(targetUrl);
  const fallbackImageUrl =
    platform === "youtube" ? getYouTubeThumbnailUrl(targetUrl) : "";
  const fallbackDescription = getPlatformFallbackDescription(
    targetUrl,
    platform
  );
  const fallbackTitle = getPlatformFallbackTitle(targetUrl, platform);
  const defaultIconUrl = getDefaultIconUrl(targetUrl);

  return buildCacheEntry({
    description:
      fallbackDescription || getNonEmptyString(previousEntry?.description),
    iconUrl: defaultIconUrl || getNonEmptyString(previousEntry?.iconUrl),
    imageUrl: fallbackImageUrl || getNonEmptyString(previousEntry?.imageUrl),
    now,
    platform,
    previousEntry,
    quality: "degraded",
    siteName: fallbackSiteName || getNonEmptyString(previousEntry?.siteName),
    source,
    title: fallbackTitle || getNonEmptyString(previousEntry?.title),
  });
};

export const getPlatformFallbackSource = (
  platform: LinkPreviewPlatform
): LinkPreviewSource => {
  if (platform === "x") {
    return "x-fallback";
  }

  if (platform === "github") {
    return "github-fallback";
  }

  return "platform-fallback";
};

export const isLikelyHtmlContentType = (contentType: string): boolean => {
  const normalizedType = contentType.toLowerCase();
  return (
    normalizedType.includes("text/html") ||
    normalizedType.includes("application/xhtml+xml")
  );
};

export const getTweetTextFromEmbedHtml = (html: string): string => {
  if (!html) {
    return "";
  }

  const parser = new DOMParser();
  const document = parser.parseFromString(html, "text/html");
  const text = getNonEmptyString(document.querySelector("p")?.textContent);
  return clipText(text);
};

export const normalizeCacheEntry = (
  value: unknown
): LinkPreviewCacheEntry | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<LinkPreviewCacheEntry>;
  if (
    typeof candidate.title !== "string" ||
    typeof candidate.description !== "string" ||
    typeof candidate.imageUrl !== "string" ||
    typeof candidate.siteName !== "string" ||
    typeof candidate.fetchedAt !== "number"
  ) {
    return null;
  }

  const iconUrl =
    typeof candidate.iconUrl === "string" ? candidate.iconUrl : "";
  const imageDataUrl =
    typeof candidate.imageDataUrl === "string" ? candidate.imageDataUrl : "";

  const inferredQuality: LinkPreviewQuality =
    candidate.title.trim() ||
    candidate.description.trim() ||
    candidate.imageUrl.trim() ||
    imageDataUrl.trim() ||
    iconUrl.trim()
      ? "success"
      : "degraded";
  const quality = isPreviewQuality(candidate.quality)
    ? candidate.quality
    : inferredQuality;
  let failureCount = 0;
  if (
    typeof candidate.failureCount === "number" &&
    candidate.failureCount >= 0
  ) {
    failureCount = candidate.failureCount;
  } else if (quality === "degraded") {
    failureCount = 1;
  }

  let nextRetryAt = candidate.fetchedAt + PREVIEW_SUCCESS_TTL_MS;
  if (typeof candidate.nextRetryAt === "number") {
    nextRetryAt = candidate.nextRetryAt;
  } else if (quality === "degraded") {
    nextRetryAt = candidate.fetchedAt + getDegradedRetryDelayMs(failureCount);
  }

  let source: LinkPreviewSource = "platform-fallback";
  if (isPreviewSource(candidate.source)) {
    source = candidate.source;
  } else if (quality === "success") {
    source = "generic-html";
  }

  return {
    title: candidate.title,
    description: candidate.description,
    iconUrl,
    imageUrl: candidate.imageUrl,
    imageDataUrl,
    siteName: candidate.siteName,
    platform: isPreviewPlatform(candidate.platform)
      ? candidate.platform
      : "generic",
    fetchedAt: candidate.fetchedAt,
    quality,
    source,
    nextRetryAt,
    failureCount,
  };
};

export const shouldRefetchPreview = (
  entry: LinkPreviewCacheEntry | null | undefined,
  now = Date.now()
): boolean => {
  const normalizedEntry = normalizeCacheEntry(entry);
  if (!normalizedEntry) {
    return true;
  }

  if (normalizedEntry.quality === "success") {
    return now - normalizedEntry.fetchedAt >= PREVIEW_SUCCESS_TTL_MS;
  }

  return now >= normalizedEntry.nextRetryAt;
};

export const getDegradedFallbackSourceForUrl = (
  targetUrl: string
): LinkPreviewSource => {
  const platform = getPreviewPlatform(targetUrl);
  return getPlatformFallbackSource(platform);
};
