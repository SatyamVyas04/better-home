import type * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PREVIEW_CLOSE_DELAY_MS,
  PREVIEW_INTERACTION_WARMUP_BATCH_DELAY_MS,
  PREVIEW_INTERACTION_WARMUP_BATCH_SIZE,
  PREVIEW_INTERACTION_WARMUP_INITIAL_LINKS,
  PREVIEW_INTERACTION_WARMUP_SECOND_STAGE_DELAY_MS,
  PREVIEW_MOUNT_WARMUP_MAX_LINKS,
  PREVIEW_MOUNT_WARMUP_START_DELAY_MS,
  PREVIEW_OPEN_DELAY_MS,
  WWW_PREFIX_REGEX,
} from "@/components/quick-links/model/quick-links.constants";
import type {
  OpenFloatingPreviewOptions,
  QuickLink,
  QuickLinksSortMode,
} from "@/components/quick-links/model/quick-links.types";
import {
  buildPreviewDescriptionText,
  clampPreviewCardPosition,
  clearPreviewCloseTimeoutRef,
  clearPreviewOpenTimeoutRef,
} from "@/components/quick-links/utils/quick-links-preview-utils";
import { useLocalStorage } from "@/hooks/use-local-storage";
import {
  cacheLinkPreviewImageDataUrl,
  fetchLinkPreviewMetadata,
  getPreviewPlatform,
  type LinkPreviewCacheEntry,
  type LinkPreviewPlatform,
  pruneLinkPreviewCache,
  resetLinkPreviewImageRuntimeCache,
  shouldRefetchPreview,
  warmLinkPreviewImage,
} from "@/lib/link-preview";
import { extractTitle, getFaviconUrl, normalizeUrl } from "@/lib/url-utils";

interface UseQuickLinksPreviewControllerOptions {
  links: QuickLink[];
  setLinks: React.Dispatch<React.SetStateAction<QuickLink[]>>;
}

export interface UseQuickLinksPreviewControllerResult {
  activePreviewDisplayTitle: string;
  activePreviewImageUrl: string;
  activePreviewLink: QuickLink | null;
  activePreviewMetadataDescriptionText: string;
  activePreviewMetadataTitleText: string;
  activePreviewPlatform: LinkPreviewPlatform;
  activePreviewUserTitleText: string;
  clearQuickLinksPreviewCache: () => void;
  clearStagedTitlePreview: () => void;
  closeFloatingPreview: () => void;
  deleteDuplicateLinks: () => void;
  deleteLink: (id: string) => void;
  displayedLinks: QuickLink[];
  ensureLinkPreview: (url: string) => void;
  getComparableUrl: (url: string) => string;
  getResolvedFavicon: (url: string) => string;
  hasActivePreviewImage: boolean;
  hasDuplicates: boolean;
  hasPreviewCacheEntries: boolean;
  isActivePreviewImageMarkedFailed: boolean;
  isActivePreviewLoading: boolean;
  moveFloatingPreview: (x: number, y: number) => void;
  openFloatingPreview: (
    link: QuickLink,
    x: number,
    y: number,
    options?: OpenFloatingPreviewOptions
  ) => void;
  previewContentDirection: 1 | -1;
  previewPosition: {
    x: number;
    y: number;
  };
  scheduleFloatingPreviewClose: () => void;
  setSortMode: React.Dispatch<React.SetStateAction<QuickLinksSortMode>>;
  sortMode: QuickLinksSortMode;
  stageResolvedTitlePreview: (
    url: string,
    preview: LinkPreviewCacheEntry
  ) => void;
}

export function useQuickLinksPreviewController({
  links,
  setLinks,
}: UseQuickLinksPreviewControllerOptions): UseQuickLinksPreviewControllerResult {
  const [sortMode, setSortMode] = useLocalStorage<QuickLinksSortMode>(
    "better-home-quick-links-sort",
    "recent"
  );
  const [previewCache, setPreviewCache] = useLocalStorage<
    Record<string, LinkPreviewCacheEntry>
  >("better-home-quick-links-previews", {});
  const [loadingPreviewUrls, setLoadingPreviewUrls] = useState<string[]>([]);
  const [activePreviewLink, setActivePreviewLink] = useState<QuickLink | null>(
    null
  );
  const [previewContentDirection, setPreviewContentDirection] = useState<
    1 | -1
  >(1);
  const [failedPreviewImageUrls, setFailedPreviewImageUrls] = useState<
    Record<string, true>
  >({});
  const [previewPosition, setPreviewPosition] = useState({ x: 0, y: 0 });
  const previewRequestMapRef = useRef<Map<string, Promise<void>>>(new Map());
  const previewImagePrimeRequestMapRef = useRef<Map<string, Promise<void>>>(
    new Map()
  );
  const previewOpenTimeoutRef = useRef<number | null>(null);
  const previewCloseTimeoutRef = useRef<number | null>(null);
  const hasStartedMountWarmupRef = useRef(false);
  const hasStartedInteractionWarmupRef = useRef(false);
  const stagedResolvedPreviewRef = useRef<{
    comparableUrl: string;
    preview: LinkPreviewCacheEntry;
  } | null>(null);

  const getComparableUrl = useCallback((url: string): string => {
    const normalizedUrl = normalizeUrl(url);
    return (normalizedUrl || url).toLowerCase();
  }, []);

  const getDomainLabel = useCallback((url: string): string => {
    try {
      return new URL(url).hostname.replace(WWW_PREFIX_REGEX, "");
    } catch {
      return extractTitle(url);
    }
  }, []);

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

  const displayedLinks = useMemo(() => {
    const sortedLinks = [...links];

    if (sortMode === "alphabetical-asc") {
      sortedLinks.sort((a, b) =>
        a.title.localeCompare(b.title, undefined, { sensitivity: "base" })
      );
    } else if (sortMode === "alphabetical-desc") {
      sortedLinks.sort((a, b) =>
        b.title.localeCompare(a.title, undefined, { sensitivity: "base" })
      );
    } else {
      sortedLinks.reverse();
    }

    return sortedLinks;
  }, [links, sortMode]);

  const displayedLinkIndexById = useMemo(() => {
    const nextIndexById = new Map<string, number>();

    for (const [index, link] of displayedLinks.entries()) {
      nextIndexById.set(link.id, index);
    }

    return nextIndexById;
  }, [displayedLinks]);

  const hasDuplicates = useMemo(() => {
    const seenUrls = new Set<string>();

    for (const link of links) {
      const normalizedLinkUrl = getComparableUrl(link.url);

      if (seenUrls.has(normalizedLinkUrl)) {
        return true;
      }

      seenUrls.add(normalizedLinkUrl);
    }

    return false;
  }, [links, getComparableUrl]);

  const hasPreviewCacheEntries = Object.keys(previewCache).length > 0;

  const clearPreviewCloseTimeout = useCallback(() => {
    clearPreviewCloseTimeoutRef(previewCloseTimeoutRef);
  }, []);

  const clearPreviewOpenTimeout = useCallback(() => {
    clearPreviewOpenTimeoutRef(previewOpenTimeoutRef);
  }, []);

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
      clearPreviewOpenTimeout();
      clearPreviewCloseTimeout();
      previewImagePrimeRequestMapRef.current.clear();
    };
  }, [clearPreviewCloseTimeout, clearPreviewOpenTimeout]);

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

  const startInteractionPreviewWarmup = useCallback(() => {
    if (hasStartedInteractionWarmupRef.current) {
      return;
    }

    hasStartedInteractionWarmupRef.current = true;

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return;
    }

    const seenComparableUrls = new Set<string>();
    const warmupUrls: string[] = [];

    for (const link of links) {
      const comparableUrl = getComparableUrl(link.url);
      if (seenComparableUrls.has(comparableUrl)) {
        continue;
      }

      seenComparableUrls.add(comparableUrl);
      warmupUrls.push(link.url);
    }

    if (warmupUrls.length === 0) {
      return;
    }

    const initialWarmupUrls = warmupUrls.slice(
      0,
      PREVIEW_INTERACTION_WARMUP_INITIAL_LINKS
    );
    const backgroundWarmupUrls = warmupUrls.slice(
      PREVIEW_INTERACTION_WARMUP_INITIAL_LINKS
    );

    const warmUrlsInBatches = async (urls: string[]) => {
      for (
        let index = 0;
        index < urls.length;
        index += PREVIEW_INTERACTION_WARMUP_BATCH_SIZE
      ) {
        const batchUrls = urls.slice(
          index,
          index + PREVIEW_INTERACTION_WARMUP_BATCH_SIZE
        );

        for (const batchUrl of batchUrls) {
          ensureLinkPreview(batchUrl);
        }

        await new Promise<void>((resolve) => {
          window.setTimeout(
            () => resolve(),
            PREVIEW_INTERACTION_WARMUP_BATCH_DELAY_MS
          );
        });
      }
    };

    const warmProgressively = async () => {
      await warmUrlsInBatches(initialWarmupUrls);

      if (backgroundWarmupUrls.length === 0) {
        return;
      }

      await new Promise<void>((resolve) => {
        window.setTimeout(
          () => resolve(),
          PREVIEW_INTERACTION_WARMUP_SECOND_STAGE_DELAY_MS
        );
      });

      await warmUrlsInBatches(backgroundWarmupUrls);
    };

    warmProgressively().catch(() => null);
  }, [ensureLinkPreview, getComparableUrl, links]);

  useEffect(() => {
    if (hasStartedMountWarmupRef.current) {
      return;
    }

    hasStartedMountWarmupRef.current = true;

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return;
    }

    const seenComparableUrls = new Set<string>();
    const warmupUrls: string[] = [];

    for (const link of links) {
      const comparableUrl = getComparableUrl(link.url);
      if (seenComparableUrls.has(comparableUrl)) {
        continue;
      }

      seenComparableUrls.add(comparableUrl);
      warmupUrls.push(link.url);

      if (warmupUrls.length >= PREVIEW_MOUNT_WARMUP_MAX_LINKS) {
        break;
      }
    }

    if (warmupUrls.length === 0) {
      return;
    }

    let isCancelled = false;
    const warmupTimeoutId = window.setTimeout(() => {
      const warmPreviews = async () => {
        for (
          let index = 0;
          index < warmupUrls.length;
          index += PREVIEW_INTERACTION_WARMUP_BATCH_SIZE
        ) {
          if (isCancelled) {
            return;
          }

          const batchUrls = warmupUrls.slice(
            index,
            index + PREVIEW_INTERACTION_WARMUP_BATCH_SIZE
          );

          for (const warmupUrl of batchUrls) {
            if (isCancelled) {
              return;
            }

            ensureLinkPreview(warmupUrl);
          }

          await new Promise<void>((resolve) => {
            window.setTimeout(
              () => resolve(),
              PREVIEW_INTERACTION_WARMUP_BATCH_DELAY_MS
            );
          });
        }
      };

      warmPreviews().catch(() => null);
    }, PREVIEW_MOUNT_WARMUP_START_DELAY_MS);

    return () => {
      isCancelled = true;
      window.clearTimeout(warmupTimeoutId);
    };
  }, [ensureLinkPreview, getComparableUrl, links]);

  const updatePreviewContentDirection = useCallback(
    (nextLinkId: string) => {
      const previousLinkId = activePreviewLink?.id;

      if (!previousLinkId || previousLinkId === nextLinkId) {
        return;
      }

      const previousLinkIndex = displayedLinkIndexById.get(previousLinkId);
      const nextLinkIndex = displayedLinkIndexById.get(nextLinkId);
      if (
        previousLinkIndex === undefined ||
        nextLinkIndex === undefined ||
        previousLinkIndex === nextLinkIndex
      ) {
        return;
      }

      const nextDirection: 1 | -1 = nextLinkIndex > previousLinkIndex ? 1 : -1;
      setPreviewContentDirection((currentDirection) => {
        if (currentDirection === nextDirection) {
          return currentDirection;
        }

        return nextDirection;
      });
    },
    [activePreviewLink, displayedLinkIndexById]
  );

  const openFloatingPreview = useCallback(
    (
      link: QuickLink,
      x: number,
      y: number,
      options?: OpenFloatingPreviewOptions
    ) => {
      setPreviewPosition(clampPreviewCardPosition(x, y));
      clearPreviewCloseTimeout();
      updatePreviewContentDirection(link.id);
      startInteractionPreviewWarmup();
      ensureLinkPreview(link.url);

      const shouldOpenImmediately =
        options?.immediate || Boolean(activePreviewLink);
      if (shouldOpenImmediately) {
        clearPreviewOpenTimeout();
        setActivePreviewLink((previousLink) => {
          if (previousLink?.id === link.id) {
            return previousLink;
          }

          return link;
        });
        return;
      }

      clearPreviewOpenTimeout();
      previewOpenTimeoutRef.current = window.setTimeout(() => {
        setActivePreviewLink(link);
        previewOpenTimeoutRef.current = null;
      }, PREVIEW_OPEN_DELAY_MS);
    },
    [
      activePreviewLink,
      clearPreviewCloseTimeout,
      clearPreviewOpenTimeout,
      ensureLinkPreview,
      startInteractionPreviewWarmup,
      updatePreviewContentDirection,
    ]
  );

  const moveFloatingPreview = useCallback((x: number, y: number) => {
    setPreviewPosition(clampPreviewCardPosition(x, y));
  }, []);

  const closeFloatingPreview = useCallback(() => {
    clearPreviewOpenTimeout();
    clearPreviewCloseTimeout();
    setActivePreviewLink(null);
  }, [clearPreviewCloseTimeout, clearPreviewOpenTimeout]);

  const scheduleFloatingPreviewClose = useCallback(() => {
    clearPreviewOpenTimeout();
    clearPreviewCloseTimeout();
    previewCloseTimeoutRef.current = window.setTimeout(() => {
      setActivePreviewLink(null);
      previewCloseTimeoutRef.current = null;
    }, PREVIEW_CLOSE_DELAY_MS);
  }, [clearPreviewCloseTimeout, clearPreviewOpenTimeout]);

  const clearQuickLinksPreviewCache = useCallback(() => {
    clearPreviewOpenTimeout();
    clearPreviewCloseTimeout();
    previewRequestMapRef.current.clear();
    previewImagePrimeRequestMapRef.current.clear();
    hasStartedMountWarmupRef.current = false;
    hasStartedInteractionWarmupRef.current = false;
    setLoadingPreviewUrls([]);
    setFailedPreviewImageUrls({});
    setActivePreviewLink(null);
    resetLinkPreviewImageRuntimeCache();
    setPreviewCache({});
  }, [clearPreviewCloseTimeout, clearPreviewOpenTimeout, setPreviewCache]);

  const deleteLink = useCallback(
    (id: string) => {
      clearPreviewCloseTimeout();
      setActivePreviewLink((prev) => (prev?.id === id ? null : prev));
      setLinks((prev) => prev.filter((link) => link.id !== id));
    },
    [clearPreviewCloseTimeout, setLinks]
  );

  const deleteDuplicateLinks = useCallback(() => {
    setLinks((prev) => {
      const seenUrls = new Set<string>();
      const dedupedLinks: QuickLink[] = [];

      for (let index = prev.length - 1; index >= 0; index -= 1) {
        const link = prev[index];
        const normalizedLinkUrl = getComparableUrl(link.url);

        if (seenUrls.has(normalizedLinkUrl)) {
          continue;
        }

        seenUrls.add(normalizedLinkUrl);
        dedupedLinks.unshift(link);
      }

      return dedupedLinks;
    });
  }, [getComparableUrl, setLinks]);

  useEffect(() => {
    if (!activePreviewLink) {
      return;
    }

    const isActivePreviewStillPresent = links.some(
      (link) => link.id === activePreviewLink.id
    );

    if (isActivePreviewStillPresent) {
      return;
    }

    clearPreviewCloseTimeout();
    setActivePreviewLink(null);
  }, [activePreviewLink, clearPreviewCloseTimeout, links]);

  const activePreviewComparableUrl = activePreviewLink
    ? getComparableUrl(activePreviewLink.url)
    : "";
  const activePreviewData = activePreviewComparableUrl
    ? previewCache[activePreviewComparableUrl]
    : null;
  const activePreviewPlatform: LinkPreviewPlatform =
    activePreviewData?.platform ||
    (activePreviewLink ? getPreviewPlatform(activePreviewLink.url) : "generic");
  const isActivePreviewLoading = activePreviewComparableUrl
    ? loadingPreviewUrls.includes(activePreviewComparableUrl)
    : false;
  const activePreviewUrl = activePreviewLink?.url || "";
  const activePreviewSiteName =
    activePreviewData?.siteName ||
    (activePreviewLink ? getDomainLabel(activePreviewUrl) : "");
  const activePreviewCustomTitle = activePreviewLink?.title || "";
  const activePreviewMetadataTitle = activePreviewData?.title || "";
  const activePreviewDisplayTitle =
    activePreviewCustomTitle ||
    activePreviewMetadataTitle ||
    activePreviewSiteName ||
    "saved link";
  const activePreviewDescription = activePreviewData?.description || "";
  const activePreviewImageUrl =
    activePreviewData?.imageDataUrl || activePreviewData?.imageUrl || "";
  const activePreviewUserTitleText =
    activePreviewCustomTitle || activePreviewDisplayTitle;
  const activePreviewMetadataTitleText =
    activePreviewMetadataTitle || activePreviewSiteName || "bookmark";
  const activePreviewMetadataDescriptionText = buildPreviewDescriptionText({
    customTitle: activePreviewCustomTitle,
    description: activePreviewDescription,
    metadataTitle: activePreviewMetadataTitle,
    siteName: activePreviewSiteName,
    url: activePreviewUrl,
  });
  const isActivePreviewImageMarkedFailed = Boolean(
    activePreviewImageUrl && failedPreviewImageUrls[activePreviewImageUrl]
  );
  const hasActivePreviewImage = Boolean(activePreviewImageUrl);

  useEffect(() => {
    if (!(activePreviewImageUrl && hasActivePreviewImage)) {
      return;
    }

    if (isActivePreviewImageMarkedFailed) {
      return;
    }

    let isCancelled = false;
    const previewImage = new Image();
    previewImage.decoding = "async";

    previewImage.onerror = () => {
      if (isCancelled) {
        return;
      }

      markPreviewImageAsFailed(activePreviewImageUrl);
    };

    previewImage.src = activePreviewImageUrl;

    return () => {
      isCancelled = true;
    };
  }, [
    activePreviewImageUrl,
    hasActivePreviewImage,
    isActivePreviewImageMarkedFailed,
    markPreviewImageAsFailed,
  ]);

  return {
    activePreviewDisplayTitle,
    activePreviewImageUrl,
    activePreviewLink,
    activePreviewMetadataDescriptionText,
    activePreviewMetadataTitleText,
    activePreviewPlatform,
    activePreviewUserTitleText,
    clearQuickLinksPreviewCache,
    clearStagedTitlePreview,
    closeFloatingPreview,
    deleteDuplicateLinks,
    deleteLink,
    displayedLinks,
    ensureLinkPreview,
    getComparableUrl,
    getResolvedFavicon,
    hasActivePreviewImage,
    hasDuplicates,
    hasPreviewCacheEntries,
    isActivePreviewImageMarkedFailed,
    isActivePreviewLoading,
    moveFloatingPreview,
    openFloatingPreview,
    previewContentDirection,
    previewPosition,
    scheduleFloatingPreviewClose,
    setSortMode,
    sortMode,
    stageResolvedTitlePreview,
  };
}
