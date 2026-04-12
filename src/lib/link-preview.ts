import {
  buildCacheEntry,
  buildDegradedEntry,
  getPlatformFallbackSource,
  isLikelyHtmlContentType,
  normalizeCacheEntry,
  shouldRefetchPreview as shouldRefetchPreviewInternal,
} from "@/lib/link-preview/builders";
import {
  PREVIEW_CACHE_MAX_ITEMS,
  PREVIEW_DEGRADED_RETENTION_MS,
  PREVIEW_FETCH_TIMEOUT_MS,
  PREVIEW_SUCCESS_TTL_MS,
} from "@/lib/link-preview/constants";
import {
  hasRichParsedPreviewMetadata,
  parseHtmlMetadata,
} from "@/lib/link-preview/html-metadata";
import {
  fetchManifestIconUrl,
  getDefaultIconUrl,
} from "@/lib/link-preview/icon-metadata";
import {
  cacheLinkPreviewImageDataUrl as cacheLinkPreviewImageDataUrlInternal,
  resetLinkPreviewImageRuntimeCache as resetLinkPreviewImageRuntimeCacheInternal,
  warmLinkPreviewImage as warmLinkPreviewImageInternal,
} from "@/lib/link-preview/image-cache";
import {
  getPreviewPlatform as getPreviewPlatformInternal,
  getYouTubeVideoId,
} from "@/lib/link-preview/platform";
import {
  fetchGitHubPreview,
  fetchXPreview,
  fetchYouTubePreview,
} from "@/lib/link-preview/platform-fetchers";
import type { LinkPreviewCacheEntry } from "@/lib/link-preview/types";
import { getNonEmptyString } from "@/lib/link-preview/utils";

export type {
  LinkPreviewCacheEntry,
  LinkPreviewPlatform,
  LinkPreviewQuality,
  LinkPreviewSource,
} from "@/lib/link-preview/types";

export const shouldRefetchPreview = (
  entry: LinkPreviewCacheEntry | null | undefined,
  now = Date.now()
): boolean => {
  return shouldRefetchPreviewInternal(entry, now);
};

export const cacheLinkPreviewImageDataUrl = (
  imageUrl: string
): Promise<string> => {
  return cacheLinkPreviewImageDataUrlInternal(imageUrl);
};

export const warmLinkPreviewImage = (imageUrl: string): Promise<boolean> => {
  return warmLinkPreviewImageInternal(imageUrl);
};

export const resetLinkPreviewImageRuntimeCache = (): void => {
  resetLinkPreviewImageRuntimeCacheInternal();
};

export const getPreviewPlatform = (targetUrl: string) => {
  return getPreviewPlatformInternal(targetUrl);
};

export async function fetchLinkPreviewMetadata(
  targetUrl: string,
  previousEntry?: LinkPreviewCacheEntry | null
): Promise<LinkPreviewCacheEntry> {
  const normalizedPreviousEntry = normalizeCacheEntry(previousEntry);
  const now = Date.now();
  const platform = getPreviewPlatformInternal(targetUrl);
  const youtubeVideoId =
    platform === "youtube" ? getYouTubeVideoId(targetUrl) : "";
  const degradedFallbackSource = youtubeVideoId
    ? "youtube-thumbnail"
    : getPlatformFallbackSource(platform);

  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    PREVIEW_FETCH_TIMEOUT_MS
  );

  try {
    if (platform === "youtube" && youtubeVideoId) {
      const youtubePreview = await fetchYouTubePreview(
        targetUrl,
        controller.signal,
        now,
        normalizedPreviousEntry
      );

      if (youtubePreview) {
        return youtubePreview;
      }
    }

    if (platform === "x") {
      const xPreview = await fetchXPreview(
        targetUrl,
        controller.signal,
        now,
        normalizedPreviousEntry
      );

      if (xPreview) {
        return xPreview;
      }

      return buildDegradedEntry(
        targetUrl,
        platform,
        now,
        normalizedPreviousEntry,
        "x-fallback"
      );
    }

    if (platform === "github") {
      const githubPreview = await fetchGitHubPreview(
        targetUrl,
        controller.signal,
        now,
        normalizedPreviousEntry
      );

      if (githubPreview) {
        return githubPreview;
      }
    }

    const response = await fetch(targetUrl, {
      credentials: "omit",
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return buildDegradedEntry(
        targetUrl,
        platform,
        now,
        normalizedPreviousEntry,
        degradedFallbackSource
      );
    }

    const contentType = getNonEmptyString(response.headers.get("content-type"));
    if (contentType && !isLikelyHtmlContentType(contentType)) {
      return buildDegradedEntry(
        targetUrl,
        platform,
        now,
        normalizedPreviousEntry,
        degradedFallbackSource
      );
    }

    const html = await response.text();
    const parsedPreview = parseHtmlMetadata(html, targetUrl);
    if (!parsedPreview) {
      return buildDegradedEntry(
        targetUrl,
        platform,
        now,
        normalizedPreviousEntry,
        degradedFallbackSource
      );
    }

    const manifestIconUrl = await fetchManifestIconUrl(
      parsedPreview.manifestUrl,
      controller.signal
    );
    const resolvedIconUrl =
      manifestIconUrl ||
      parsedPreview.iconUrl ||
      getDefaultIconUrl(targetUrl) ||
      "";

    const hasRichMetadata = hasRichParsedPreviewMetadata(
      parsedPreview,
      manifestIconUrl
    );

    return buildCacheEntry({
      description: parsedPreview.description,
      iconUrl: resolvedIconUrl,
      imageUrl: parsedPreview.imageUrl,
      now,
      platform: parsedPreview.platform,
      previousEntry: normalizedPreviousEntry,
      quality: hasRichMetadata ? "success" : "degraded",
      siteName: parsedPreview.siteName,
      source: "generic-html",
      title: parsedPreview.title,
    });
  } catch {
    return buildDegradedEntry(
      targetUrl,
      platform,
      now,
      normalizedPreviousEntry,
      degradedFallbackSource
    );
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function pruneLinkPreviewCache(
  cache: Record<string, LinkPreviewCacheEntry>
): Record<string, LinkPreviewCacheEntry> {
  const now = Date.now();

  const entries = Object.entries(cache).flatMap(([key, value]) => {
    const normalizedEntry = normalizeCacheEntry(value);
    if (!normalizedEntry) {
      return [];
    }

    const maxAgeMs =
      normalizedEntry.quality === "success"
        ? PREVIEW_SUCCESS_TTL_MS
        : PREVIEW_DEGRADED_RETENTION_MS;

    if (now - normalizedEntry.fetchedAt > maxAgeMs) {
      return [];
    }

    return [[key, normalizedEntry] as const];
  });

  if (
    entries.length === Object.keys(cache).length &&
    entries.length <= PREVIEW_CACHE_MAX_ITEMS
  ) {
    return cache;
  }

  entries.sort((a, b) => b[1].fetchedAt - a[1].fetchedAt);
  const trimmedEntries = entries.slice(0, PREVIEW_CACHE_MAX_ITEMS);

  return Object.fromEntries(trimmedEntries);
}
