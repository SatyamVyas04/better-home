import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  clearQuickLinksPreviewImageDataUrls,
  pruneQuickLinksPreviewImageDataUrls,
  type QuickLinksPreviewImageDataMap,
  readQuickLinksPreviewImageDataMap,
  writeQuickLinksPreviewImageDataUrl,
} from "@/lib/quick-links-preview-image-storage";
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

function stripPreviewImageData(
  entry: LinkPreviewCacheEntry
): LinkPreviewCacheEntry {
  if (!entry.imageDataUrl) {
    return entry;
  }

  return {
    ...entry,
    imageDataUrl: "",
  };
}

function mergePreviewCacheWithLocalImageData(
  cache: Record<string, LinkPreviewCacheEntry>,
  previewImageDataMap: QuickLinksPreviewImageDataMap
): Record<string, LinkPreviewCacheEntry> {
  const mergedCache: Record<string, LinkPreviewCacheEntry> = {};

  for (const [comparableUrl, entry] of Object.entries(cache)) {
    const localImageData = previewImageDataMap[comparableUrl];
    const canUseLocalImageData =
      Boolean(localImageData) &&
      (localImageData.imageUrl === entry.imageUrl || !localImageData.imageUrl);

    if (canUseLocalImageData) {
      mergedCache[comparableUrl] = {
        ...entry,
        imageDataUrl: localImageData.imageDataUrl,
      };
      continue;
    }

    mergedCache[comparableUrl] = entry;
  }

  return mergedCache;
}

export function useQuickLinksPreviewCache({
  links,
  setLinks,
  getComparableUrl,
}: UseQuickLinksPreviewCacheOptions): UseQuickLinksPreviewCacheResult {
  const [persistedPreviewCache, setPersistedPreviewCache] = useLocalStorage<
    Record<string, LinkPreviewCacheEntry>
  >("better-home-quick-links-previews", {});
  const [previewImageDataMap, setPreviewImageDataMap] =
    useState<QuickLinksPreviewImageDataMap>(() =>
      readQuickLinksPreviewImageDataMap()
    );
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

  const previewCache = useMemo(() => {
    return mergePreviewCacheWithLocalImageData(
      persistedPreviewCache,
      previewImageDataMap
    );
  }, [persistedPreviewCache, previewImageDataMap]);

  const savePreviewImageData = useCallback(
    (comparableUrl: string, imageUrl: string, imageDataUrl: string) => {
      const normalizedImageDataUrl = imageDataUrl.trim();
      if (!(comparableUrl && imageUrl && normalizedImageDataUrl)) {
        return;
      }

      writeQuickLinksPreviewImageDataUrl(
        comparableUrl,
        imageUrl,
        normalizedImageDataUrl
      );

      setPreviewImageDataMap((prev) => {
        const currentEntry = prev[comparableUrl];

        if (
          currentEntry?.imageUrl === imageUrl &&
          currentEntry.imageDataUrl === normalizedImageDataUrl
        ) {
          return prev;
        }

        return {
          ...prev,
          [comparableUrl]: {
            imageUrl,
            imageDataUrl: normalizedImageDataUrl,
          },
        };
      });
    },
    []
  );

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

          savePreviewImageData(comparableUrl, imageUrl, imageDataUrl);

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
    [savePreviewImageData]
  );

  const cachePreviewEntry = useCallback(
    (comparableUrl: string, preview: LinkPreviewCacheEntry) => {
      if (preview.imageUrl && !preview.imageDataUrl) {
        primePreviewImageAsset(comparableUrl, preview.imageUrl);
      }

      if (preview.imageUrl && preview.imageDataUrl) {
        savePreviewImageData(
          comparableUrl,
          preview.imageUrl,
          preview.imageDataUrl
        );
      }

      const sanitizedPreview = stripPreviewImageData(preview);

      setPersistedPreviewCache((prev) => {
        return pruneLinkPreviewCache({
          ...prev,
          [comparableUrl]: sanitizedPreview,
        });
      });
    },
    [primePreviewImageAsset, savePreviewImageData, setPersistedPreviewCache]
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
    setPersistedPreviewCache((prev) => pruneLinkPreviewCache(prev));
  }, [setPersistedPreviewCache]);

  useEffect(() => {
    const extractedImageDataEntries: QuickLinksPreviewImageDataMap = {};
    let hasLegacyImageData = false;

    for (const [comparableUrl, entry] of Object.entries(
      persistedPreviewCache
    )) {
      const imageDataUrl = entry.imageDataUrl?.trim();

      if (!(entry.imageUrl && imageDataUrl)) {
        continue;
      }

      hasLegacyImageData = true;
      extractedImageDataEntries[comparableUrl] = {
        imageUrl: entry.imageUrl,
        imageDataUrl,
      };
    }

    if (!hasLegacyImageData) {
      return;
    }

    for (const [comparableUrl, imageDataEntry] of Object.entries(
      extractedImageDataEntries
    )) {
      writeQuickLinksPreviewImageDataUrl(
        comparableUrl,
        imageDataEntry.imageUrl,
        imageDataEntry.imageDataUrl
      );
    }

    setPreviewImageDataMap((prev) => {
      let hasChanges = false;
      const nextMap = { ...prev };

      for (const [comparableUrl, imageDataEntry] of Object.entries(
        extractedImageDataEntries
      )) {
        const existingEntry = nextMap[comparableUrl];

        if (
          existingEntry?.imageUrl === imageDataEntry.imageUrl &&
          existingEntry.imageDataUrl === imageDataEntry.imageDataUrl
        ) {
          continue;
        }

        hasChanges = true;
        nextMap[comparableUrl] = imageDataEntry;
      }

      return hasChanges ? nextMap : prev;
    });

    setPersistedPreviewCache((prev) => {
      let hasChanges = false;
      const nextCache: Record<string, LinkPreviewCacheEntry> = {};

      for (const [comparableUrl, entry] of Object.entries(prev)) {
        const sanitizedEntry = stripPreviewImageData(entry);

        if (sanitizedEntry !== entry) {
          hasChanges = true;
        }

        nextCache[comparableUrl] = sanitizedEntry;
      }

      return hasChanges ? nextCache : prev;
    });
  }, [persistedPreviewCache, setPersistedPreviewCache]);

  useEffect(() => {
    return () => {
      previewImagePrimeRequestMapRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const activeComparableUrls = new Set(
      links.map((link) => getComparableUrl(link.url))
    );

    setPersistedPreviewCache((prev) => {
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

    const hasRemovedImageDataEntries = Object.keys(previewImageDataMap).some(
      (comparableUrl) => !activeComparableUrls.has(comparableUrl)
    );

    if (!hasRemovedImageDataEntries) {
      return;
    }

    pruneQuickLinksPreviewImageDataUrls(activeComparableUrls);
    setPreviewImageDataMap((prev) => {
      const nextMap: QuickLinksPreviewImageDataMap = {};

      for (const [comparableUrl, imageDataEntry] of Object.entries(prev)) {
        if (!activeComparableUrls.has(comparableUrl)) {
          continue;
        }

        nextMap[comparableUrl] = imageDataEntry;
      }

      return nextMap;
    });
  }, [getComparableUrl, links, previewImageDataMap, setPersistedPreviewCache]);

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
    clearQuickLinksPreviewImageDataUrls();
    setPreviewImageDataMap({});
    setPersistedPreviewCache({});
  }, [setPersistedPreviewCache]);

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
