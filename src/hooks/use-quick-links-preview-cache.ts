import { useCallback, useEffect, useRef, useState } from "react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import {
  cacheLinkPreviewImageDataUrl,
  fetchLinkPreviewMetadata,
  getPreviewPlatform,
  type LinkPreviewCacheEntry,
  pruneLinkPreviewCache,
  resetLinkPreviewImageRuntimeCache,
  shouldRefetchPreview,
  warmLinkPreviewImage,
} from "@/lib/link-preview";
import { getFaviconUrl } from "@/lib/url-utils";
import type { QuickLink } from "@/types/quick-links";

interface UseQuickLinksPreviewCacheOptions {
  links: QuickLink[];
  setLinks: React.Dispatch<React.SetStateAction<QuickLink[]>>;
  getComparableUrl: (url: string) => string;
}

interface UseQuickLinksPreviewCacheResult {
  clearStagedTitlePreview: () => void;
  ensureLinkPreview: (url: string) => void;
  failedPreviewImageUrls: Record<string, true>;
  getResolvedFavicon: (url: string) => string;
  hasPreviewCacheEntries: boolean;
  loadingPreviewUrls: string[];
  markPreviewImageAsFailed: (imageUrl: string) => void;
  previewCache: Record<string, LinkPreviewCacheEntry>;
  resetPreviewCacheState: () => void;
  stageResolvedTitlePreview: (
    url: string,
    preview: LinkPreviewCacheEntry
  ) => void;
}

export function useQuickLinksPreviewCache({
  links,
  setLinks,
  getComparableUrl,
}: UseQuickLinksPreviewCacheOptions): UseQuickLinksPreviewCacheResult {
  const [previewCache, setPreviewCache] = useLocalStorage<
    Record<string, LinkPreviewCacheEntry>
  >("better-home-quick-links-previews", {});
  const [loadingPreviewUrls, setLoadingPreviewUrls] = useState<string[]>([]);
  const [failedPreviewImageUrls, setFailedPreviewImageUrls] = useState<
    Record<string, true>
  >({});
  const previewRequestMapRef = useRef<Map<string, Promise<void>>>(new Map());
  const previewImagePrimeRequestMapRef = useRef<Map<string, Promise<void>>>(
    new Map()
  );
  const stagedResolvedPreviewRef = useRef<{
    comparableUrl: string;
    preview: LinkPreviewCacheEntry;
  } | null>(null);

  const getResolvedFavicon = useCallback(
    (url: string): string => {
      const comparableUrl = getComparableUrl(url);
      const stagedPreview = stagedResolvedPreviewRef.current;
      if (
        stagedPreview?.comparableUrl === comparableUrl &&
        stagedPreview.preview.iconUrl
      ) {
        return stagedPreview.preview.iconUrl;
      }

      return previewCache[comparableUrl]?.iconUrl || getFaviconUrl(url);
    },
    [getComparableUrl, previewCache]
  );

  const markPreviewImageAsFailed = useCallback((imageUrl: string) => {
    if (!imageUrl) {
      return;
    }

    setFailedPreviewImageUrls((prev) => {
      if (prev[imageUrl]) {
        return prev;
      }

      return {
        ...prev,
        [imageUrl]: true,
      };
    });
  }, []);

  const primePreviewImageAsset = useCallback(
    (comparableUrl: string, imageUrl: string) => {
      if (!(comparableUrl && imageUrl)) {
        return;
      }

      const requestKey = `${comparableUrl}::${imageUrl}`;
      if (previewImagePrimeRequestMapRef.current.has(requestKey)) {
        return;
      }

      const request: Promise<void> = cacheLinkPreviewImageDataUrl(imageUrl)
        .then((imageDataUrl) => {
          if (!imageDataUrl) {
            return warmLinkPreviewImage(imageUrl).then(() => undefined);
          }

          setPreviewCache((prev) => {
            const currentEntry = prev[comparableUrl];
            if (!currentEntry) {
              return prev;
            }

            if (
              currentEntry.imageUrl !== imageUrl ||
              currentEntry.imageDataUrl === imageDataUrl
            ) {
              return prev;
            }

            return pruneLinkPreviewCache({
              ...prev,
              [comparableUrl]: {
                ...currentEntry,
                imageDataUrl,
              },
            });
          });

          return undefined;
        })
        .catch(() => {
          return warmLinkPreviewImage(imageUrl)
            .then(() => undefined)
            .catch(() => undefined);
        })
        .finally(() => {
          previewImagePrimeRequestMapRef.current.delete(requestKey);
        });

      previewImagePrimeRequestMapRef.current.set(requestKey, request);
    },
    [setPreviewCache]
  );

  const cachePreviewEntry = useCallback(
    (comparableUrl: string, preview: LinkPreviewCacheEntry) => {
      if (preview.imageUrl && !preview.imageDataUrl) {
        primePreviewImageAsset(comparableUrl, preview.imageUrl);
      }

      setPreviewCache((prev) => {
        return pruneLinkPreviewCache({
          ...prev,
          [comparableUrl]: preview,
        });
      });
    },
    [primePreviewImageAsset, setPreviewCache]
  );

  const stageResolvedTitlePreview = useCallback(
    (url: string, preview: LinkPreviewCacheEntry) => {
      const comparableUrl = getComparableUrl(url);
      stagedResolvedPreviewRef.current = {
        comparableUrl,
        preview,
      };
      cachePreviewEntry(comparableUrl, preview);
    },
    [cachePreviewEntry, getComparableUrl]
  );

  const clearStagedTitlePreview = useCallback(() => {
    stagedResolvedPreviewRef.current = null;
  }, []);

  useEffect(() => {
    setPreviewCache((prev) => pruneLinkPreviewCache(prev));
  }, [setPreviewCache]);

  useEffect(() => {
    return () => {
      previewImagePrimeRequestMapRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const activeComparableUrls = new Set(
      links.map((link) => getComparableUrl(link.url))
    );

    setPreviewCache((prev) => {
      let hasRemovedEntries = false;
      const nextCache: Record<string, LinkPreviewCacheEntry> = {};

      for (const [comparableUrl, entry] of Object.entries(prev)) {
        if (!activeComparableUrls.has(comparableUrl)) {
          hasRemovedEntries = true;
          continue;
        }

        nextCache[comparableUrl] = entry;
      }

      return hasRemovedEntries ? nextCache : prev;
    });
  }, [getComparableUrl, links, setPreviewCache]);

  const ensureLinkPreview = useCallback(
    (url: string) => {
      const comparableUrl = getComparableUrl(url);
      const cachedPreview = previewCache[comparableUrl];
      const previewPlatform =
        cachedPreview?.platform || getPreviewPlatform(url);
      const shouldRefetchMissingYoutubeThumbnail =
        previewPlatform === "youtube" &&
        !(cachedPreview?.imageUrl || cachedPreview?.imageDataUrl);
      const shouldRefetchMissingIcon = !cachedPreview?.iconUrl;
      const shouldRefetchCachedPreview = shouldRefetchPreview(cachedPreview);

      if (
        cachedPreview &&
        !shouldRefetchCachedPreview &&
        !shouldRefetchMissingYoutubeThumbnail &&
        !shouldRefetchMissingIcon
      ) {
        if (cachedPreview.imageUrl && !cachedPreview.imageDataUrl) {
          primePreviewImageAsset(comparableUrl, cachedPreview.imageUrl);
        }

        return;
      }

      if (previewRequestMapRef.current.has(comparableUrl)) {
        return;
      }

      setLoadingPreviewUrls((prev) =>
        prev.includes(comparableUrl) ? prev : [...prev, comparableUrl]
      );

      const request = (async () => {
        const fetchedPreview = await fetchLinkPreviewMetadata(
          url,
          cachedPreview
        );

        cachePreviewEntry(comparableUrl, fetchedPreview);

        if (fetchedPreview.iconUrl) {
          setLinks((prev) => {
            let hasUpdates = false;

            const nextLinks = prev.map((link) => {
              if (getComparableUrl(link.url) !== comparableUrl) {
                return link;
              }

              if (link.favicon === fetchedPreview.iconUrl) {
                return link;
              }

              hasUpdates = true;
              return {
                ...link,
                favicon: fetchedPreview.iconUrl,
              };
            });

            return hasUpdates ? nextLinks : prev;
          });
        }
      })();

      previewRequestMapRef.current.set(comparableUrl, request);

      request.finally(() => {
        previewRequestMapRef.current.delete(comparableUrl);
        setLoadingPreviewUrls((prev) =>
          prev.filter((entry) => entry !== comparableUrl)
        );
      });
    },
    [
      cachePreviewEntry,
      getComparableUrl,
      previewCache,
      primePreviewImageAsset,
      setLinks,
    ]
  );

  const hasPreviewCacheEntries = Object.keys(previewCache).length > 0;

  const resetPreviewCacheState = useCallback(() => {
    previewRequestMapRef.current.clear();
    previewImagePrimeRequestMapRef.current.clear();
    stagedResolvedPreviewRef.current = null;
    setLoadingPreviewUrls([]);
    setFailedPreviewImageUrls({});
    resetLinkPreviewImageRuntimeCache();
    setPreviewCache({});
  }, [setPreviewCache]);

  return {
    clearStagedTitlePreview,
    ensureLinkPreview,
    failedPreviewImageUrls,
    getResolvedFavicon,
    hasPreviewCacheEntries,
    loadingPreviewUrls,
    markPreviewImageAsFailed,
    previewCache,
    resetPreviewCacheState,
    stageResolvedTitlePreview,
  };
}
