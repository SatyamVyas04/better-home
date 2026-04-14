import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PREVIEW_CLOSE_DELAY_MS,
  PREVIEW_OPEN_DELAY_MS,
  WWW_PREFIX_REGEX,
} from "@/constants/quick-links";
import { useLocalStorage } from "@/hooks/use-local-storage";
import {
  getPreviewPlatform,
  type LinkPreviewPlatform,
} from "@/lib/link-preview";
import {
  buildPreviewDescriptionText,
  clampPreviewCardPosition,
  clearTimeoutRef,
} from "@/lib/quick-links-preview-utils";
import { runTrackedUserAction } from "@/lib/session-history";
import { extractTitle, normalizeUrl } from "@/lib/url-utils";
import type { QuickLink, QuickLinksSortMode } from "@/types/quick-links";
import { useQuickLinksPreviewCache } from "./use-quick-links-preview-cache";
import type {
  UseQuickLinksPreviewControllerOptions,
  UseQuickLinksPreviewControllerResult,
} from "./use-quick-links-preview-controller.types";
import { useQuickLinksPreviewWarmup } from "./use-quick-links-preview-warmup";

export function useQuickLinksPreviewController({
  links,
  setLinks,
}: UseQuickLinksPreviewControllerOptions): UseQuickLinksPreviewControllerResult {
  const [sortMode, setSortMode] = useLocalStorage<QuickLinksSortMode>(
    "better-home-quick-links-sort",
    "recent"
  );
  const [activePreviewLink, setActivePreviewLink] = useState<QuickLink | null>(
    null
  );
  const [previewContentDirection, setPreviewContentDirection] = useState<
    1 | -1
  >(1);
  const [previewPosition, setPreviewPosition] = useState({ x: 0, y: 0 });

  const previewOpenTimeoutRef = useRef<number | null>(null);
  const previewCloseTimeoutRef = useRef<number | null>(null);

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

  const {
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
  } = useQuickLinksPreviewCache({
    links,
    setLinks,
    getComparableUrl,
  });

  const { resetPreviewWarmupState, startInteractionPreviewWarmup } =
    useQuickLinksPreviewWarmup({
      ensureLinkPreview,
      getComparableUrl,
      links,
    });

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

  const clearPreviewCloseTimeout = useCallback(() => {
    clearTimeoutRef(previewCloseTimeoutRef);
  }, []);

  const clearPreviewOpenTimeout = useCallback(() => {
    clearTimeoutRef(previewOpenTimeoutRef);
  }, []);

  useEffect(() => {
    return () => {
      clearPreviewOpenTimeout();
      clearPreviewCloseTimeout();
    };
  }, [clearPreviewCloseTimeout, clearPreviewOpenTimeout]);

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
      options?: { immediate?: boolean }
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
    resetPreviewWarmupState();
    setActivePreviewLink(null);
    resetPreviewCacheState();
  }, [
    clearPreviewCloseTimeout,
    clearPreviewOpenTimeout,
    resetPreviewCacheState,
    resetPreviewWarmupState,
  ]);

  const deleteLink = useCallback(
    (id: string) => {
      clearPreviewCloseTimeout();
      setActivePreviewLink((prev) => (prev?.id === id ? null : prev));
      runTrackedUserAction("delete quick link", () => {
        setLinks((prev) => prev.filter((link) => link.id !== id));
      });
    },
    [clearPreviewCloseTimeout, setLinks]
  );

  const deleteDuplicateLinks = useCallback(() => {
    runTrackedUserAction("remove duplicate quick links", () => {
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
    });
  }, [getComparableUrl, setLinks]);

  const changeSortMode = useCallback(
    (nextSortMode: QuickLinksSortMode) => {
      runTrackedUserAction("change quick links sort", () => {
        setSortMode(nextSortMode);
      });
    },
    [setSortMode]
  );

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
    setSortMode: changeSortMode,
    sortMode,
    stageResolvedTitlePreview,
  };
}
