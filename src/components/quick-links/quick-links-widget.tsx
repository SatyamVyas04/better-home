import {
  IconArrowDown,
  IconArrowUp,
  IconBrandGithub,
  IconBrandX,
  IconBrandYoutube,
  IconCheck,
  IconExternalLink,
  IconHistory,
  IconLoader2,
  IconPlus,
  IconSparkles,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { AnimatePresence, motion } from "motion/react";
import type * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { OverlappingLabelInput } from "@/components/ui/overlapping-label-input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLocalStorage } from "@/hooks/use-local-storage";
import {
  fetchLinkPreviewMetadata,
  getPreviewPlatform,
  type LinkPreviewCacheEntry,
  type LinkPreviewPlatform,
  pruneLinkPreviewCache,
  shouldRefetchPreview,
} from "@/lib/link-preview";
import {
  extractTitle,
  getFaviconUrl,
  isValidUrl,
  normalizeUrl,
} from "@/lib/url-utils";

interface ChromeBookmarkNode {
  id: string;
  title?: string;
  url?: string;
  children?: ChromeBookmarkNode[];
}

declare const chrome: {
  bookmarks?: {
    getTree: (callback: (nodes: ChromeBookmarkNode[]) => void) => void;
  };
};

interface QuickLinksProps {
  expanded?: boolean;
  fullSize?: boolean;
}

interface QuickLink {
  id: string;
  title: string;
  url: string;
  favicon: string;
}

interface BookmarkImportItem {
  id: string;
  title: string;
  url: string;
  favicon: string;
  location: string;
}

const WWW_PREFIX_REGEX = /^www\./i;
const PREVIEW_CARD_WIDTH = 360;
const PREVIEW_CARD_HEIGHT = 280;
const PREVIEW_MEDIA_ASPECT_RATIO = 1.91;
const PREVIEW_MEDIA_HEIGHT = Math.round(
  PREVIEW_CARD_WIDTH / PREVIEW_MEDIA_ASPECT_RATIO
);
const PREVIEW_CARD_OFFSET = 4;
const PREVIEW_CARD_VIEWPORT_GUTTER = 4;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const;

type QuickLinksSortMode = "recent" | "alphabetical-asc" | "alphabetical-desc";
type QuickLinkAddFlowStage = "url" | "loading-title" | "ready-title";

interface PreviewFallbackMediaProps {
  platform: LinkPreviewPlatform;
  siteName: string;
  favicon: string;
  title: string;
}

const clearPreviewCloseTimeoutRef = (
  timeoutRef: React.MutableRefObject<number | null>
) => {
  if (timeoutRef.current === null) {
    return;
  }

  window.clearTimeout(timeoutRef.current);
  timeoutRef.current = null;
};

const clampPreviewCardPosition = (x: number, y: number) => {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let nextX = x + PREVIEW_CARD_OFFSET;
  let nextY = y - PREVIEW_CARD_HEIGHT - PREVIEW_CARD_OFFSET;

  if (
    nextX + PREVIEW_CARD_WIDTH >
    viewportWidth - PREVIEW_CARD_VIEWPORT_GUTTER
  ) {
    nextX = x - PREVIEW_CARD_WIDTH - PREVIEW_CARD_OFFSET;
  }

  if (nextY < PREVIEW_CARD_VIEWPORT_GUTTER) {
    nextY = y + PREVIEW_CARD_OFFSET;
  }

  if (
    nextY + PREVIEW_CARD_HEIGHT >
    viewportHeight - PREVIEW_CARD_VIEWPORT_GUTTER
  ) {
    nextY = viewportHeight - PREVIEW_CARD_HEIGHT - PREVIEW_CARD_VIEWPORT_GUTTER;
  }

  nextX = Math.max(PREVIEW_CARD_VIEWPORT_GUTTER, nextX);
  nextY = Math.max(PREVIEW_CARD_VIEWPORT_GUTTER, nextY);

  return { x: nextX, y: nextY };
};

function PreviewFallbackMedia({
  platform,
  siteName,
  favicon,
  title,
}: PreviewFallbackMediaProps) {
  let logo = <IconSparkles className="size-7 text-muted-foreground" />;

  if (favicon) {
    logo = (
      <img
        alt={title}
        className="size-8 rounded-md"
        height={32}
        loading="lazy"
        src={favicon}
        width={32}
      />
    );
  } else if (platform === "youtube") {
    logo = <IconBrandYoutube className="size-8 text-red-500" />;
  } else if (platform === "x") {
    logo = <IconBrandX className="size-7 text-foreground/90" />;
  } else if (platform === "github") {
    logo = <IconBrandGithub className="size-7 text-foreground/90" />;
  }

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-linear-to-br from-sky-500/20 via-emerald-500/10 to-amber-500/20 dark:from-sky-900/50 dark:via-emerald-900/35 dark:to-amber-900/45">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.4),transparent_55%)] dark:bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.09),transparent_55%)]" />
      <div className="relative z-10 flex size-14 items-center justify-center rounded-2xl border border-border/55 bg-card/80 shadow-sm backdrop-blur">
        {logo}
      </div>
      <p className="absolute bottom-2 z-10 max-w-[82%] truncate rounded-full bg-card/65 px-2 py-0.5 text-[10px] text-muted-foreground lowercase">
        {siteName || "website"}
      </p>
    </div>
  );
}

interface ImportBookmarksContentProps {
  bookmarkOptions: BookmarkImportItem[];
  importError: string | null;
  isImportLoading: boolean;
  onToggleBookmarkSelection: (bookmarkId: string) => void;
  selectedBookmarkIds: string[];
}

function ImportBookmarksContent({
  bookmarkOptions,
  importError,
  isImportLoading,
  onToggleBookmarkSelection,
  selectedBookmarkIds,
}: ImportBookmarksContentProps) {
  if (isImportLoading) {
    return (
      <div className="flex h-56 items-center justify-center gap-2 rounded-md border border-border/50 bg-muted/20 px-3">
        <IconLoader2 className="size-3.5 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground text-xs lowercase">
          loading bookmarks...
        </p>
      </div>
    );
  }

  if (importError) {
    return (
      <div className="flex h-56 items-center justify-center rounded-md border border-border/50 border-dashed bg-muted/20 px-3 text-center">
        <p className="text-muted-foreground text-xs lowercase">{importError}</p>
      </div>
    );
  }

  if (bookmarkOptions.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center rounded-md border border-border/50 border-dashed bg-muted/20 px-3 text-center">
        <p className="text-muted-foreground text-xs lowercase">
          no bookmarks available to import
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-56 rounded-md border border-border/50 bg-muted/20 p-1">
      <div className="space-y-1 pr-2">
        {bookmarkOptions.map((bookmark) => {
          const isSelected = selectedBookmarkIds.includes(bookmark.id);

          return (
            <button
              className="flex w-full min-w-0 items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent/30 focus-visible:bg-accent/30 focus-visible:ring-2 focus-visible:ring-ring/30"
              key={bookmark.id}
              onClick={() => onToggleBookmarkSelection(bookmark.id)}
              type="button"
            >
              <Checkbox
                checked={isSelected}
                className="pointer-events-none mt-0.5"
                tabIndex={-1}
              />
              <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                <p className="wrap-anywhere overflow-hidden text-xs lowercase leading-tight [-webkit-box-orient:vertical] [-webkit-line-clamp:2] [display:-webkit-box]">
                  {bookmark.title}
                </p>
                <p className="wrap-anywhere overflow-hidden text-[10px] text-muted-foreground lowercase leading-tight [-webkit-box-orient:vertical] [-webkit-line-clamp:2] [display:-webkit-box]">
                  {bookmark.location}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </ScrollArea>
  );
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: This widget coordinates link CRUD, bookmark import, and floating preview interactions in a single surface.
export function QuickLinks({
  expanded = false,
  fullSize = false,
}: QuickLinksProps) {
  const [links, setLinks] = useLocalStorage<QuickLink[]>(
    "better-home-quick-links",
    [
      {
        id: "default-github",
        title: "github",
        url: "https://github.com/SatyamVyas04",
        favicon: "https://www.google.com/s2/favicons?domain=github.com&sz=64",
      },
    ]
  );
  const [newUrl, setNewUrl] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [addFlowStage, setAddFlowStage] =
    useState<QuickLinkAddFlowStage>("url");
  const [sortMode, setSortMode] = useLocalStorage<QuickLinksSortMode>(
    "better-home-quick-links-sort",
    "recent"
  );
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isImportLoading, setIsImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [bookmarkOptions, setBookmarkOptions] = useState<BookmarkImportItem[]>(
    []
  );
  const [selectedBookmarkIds, setSelectedBookmarkIds] = useState<string[]>([]);
  const [previewCache, setPreviewCache] = useLocalStorage<
    Record<string, LinkPreviewCacheEntry>
  >("better-home-quick-links-previews", {});
  const [loadingPreviewUrls, setLoadingPreviewUrls] = useState<string[]>([]);
  const [activePreviewLink, setActivePreviewLink] = useState<QuickLink | null>(
    null
  );
  const [failedPreviewImageUrls, setFailedPreviewImageUrls] = useState<
    Record<string, true>
  >({});
  const [previewPosition, setPreviewPosition] = useState({ x: 0, y: 0 });
  const previewRequestMapRef = useRef<Map<string, Promise<void>>>(new Map());
  const previewCloseTimeoutRef = useRef<number | null>(null);
  const titleAutofillRequestIdRef = useRef(0);
  const resolvedTitlePreviewRef = useRef<{
    comparableUrl: string;
    preview: LinkPreviewCacheEntry;
  } | null>(null);
  const urlInputRef = useRef<HTMLInputElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

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
      const stagedPreview = resolvedTitlePreviewRef.current;
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

  useEffect(() => {
    setPreviewCache((prev) => pruneLinkPreviewCache(prev));
  }, [setPreviewCache]);

  const focusUrlInput = useCallback(() => {
    window.requestAnimationFrame(() => {
      urlInputRef.current?.focus({ preventScroll: true });
    });
  }, []);

  const focusTitleInput = useCallback(() => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const titleInput = titleInputRef.current;
        if (!titleInput) {
          return;
        }

        titleInput.focus({ preventScroll: true });
        const cursorPosition = titleInput.value.length;
        titleInput.setSelectionRange(cursorPosition, cursorPosition);
      });
    });
  }, []);

  const clearPreviewCloseTimeout = useCallback(() => {
    clearPreviewCloseTimeoutRef(previewCloseTimeoutRef);
  }, []);

  useEffect(() => {
    return () => {
      clearPreviewCloseTimeout();
    };
  }, [clearPreviewCloseTimeout]);

  const getClampedPreviewPosition = useCallback(
    (x: number, y: number) => clampPreviewCardPosition(x, y),
    []
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

  const resetAddFlow = useCallback(() => {
    setNewUrl("");
    setNewTitle("");
    setAddFlowStage("url");
    titleAutofillRequestIdRef.current += 1;
    resolvedTitlePreviewRef.current = null;
    focusUrlInput();
  }, [focusUrlInput]);

  const returnToUrlStage = useCallback(() => {
    titleAutofillRequestIdRef.current += 1;
    setAddFlowStage("url");
    setNewTitle("");
    resolvedTitlePreviewRef.current = null;
    focusUrlInput();
  }, [focusUrlInput]);

  const completeTitleResolution = useCallback(
    (requestId: number, resolvedTitle: string) => {
      if (titleAutofillRequestIdRef.current !== requestId) {
        return;
      }

      setNewTitle(resolvedTitle);
      setAddFlowStage("ready-title");
      focusTitleInput();
    },
    [focusTitleInput]
  );

  const startTitleResolution = useCallback(() => {
    if (addFlowStage !== "url") {
      return;
    }

    const normalizedUrl = normalizeUrl(newUrl);
    if (!(normalizedUrl && isValidUrl(normalizedUrl))) {
      return;
    }

    const fallbackTitle = extractTitle(normalizedUrl);
    const requestId = titleAutofillRequestIdRef.current + 1;
    titleAutofillRequestIdRef.current = requestId;

    setNewUrl(normalizedUrl);
    setNewTitle("");
    setAddFlowStage("loading-title");

    const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
    if (isOffline) {
      completeTitleResolution(requestId, fallbackTitle);
      return;
    }

    fetchLinkPreviewMetadata(normalizedUrl)
      .then((metadata) => {
        const comparableUrl = getComparableUrl(normalizedUrl);
        resolvedTitlePreviewRef.current = {
          comparableUrl,
          preview: metadata,
        };

        setPreviewCache((prev) => {
          return pruneLinkPreviewCache({
            ...prev,
            [comparableUrl]: metadata,
          });
        });

        return metadata.title?.trim() || fallbackTitle;
      })
      .catch(() => fallbackTitle)
      .then((resolvedTitle) => {
        completeTitleResolution(requestId, resolvedTitle);
      });
  }, [
    addFlowStage,
    completeTitleResolution,
    getComparableUrl,
    newUrl,
    setPreviewCache,
  ]);

  const addLink = () => {
    if (addFlowStage !== "ready-title") {
      return;
    }

    const normalizedUrl = normalizeUrl(newUrl);
    if (!normalizedUrl) {
      return;
    }

    if (!isValidUrl(normalizedUrl)) {
      return;
    }

    const resolvedTitle = newTitle.trim() || extractTitle(normalizedUrl);

    const link: QuickLink = {
      id: crypto.randomUUID(),
      title: resolvedTitle,
      url: normalizedUrl,
      favicon: getResolvedFavicon(normalizedUrl),
    };

    setLinks((prev) => [...prev, link]);
    resetAddFlow();
  };

  const handleUrlInputChange = (nextUrl: string) => {
    setNewUrl(nextUrl);
    setNewTitle("");
    resolvedTitlePreviewRef.current = null;

    if (!nextUrl.trim()) {
      titleAutofillRequestIdRef.current += 1;
      setAddFlowStage("url");
    }
  };

  const handleTitleInputChange = (nextTitle: string) => {
    setNewTitle(nextTitle);
  };

  const deleteLink = (id: string) => {
    clearPreviewCloseTimeout();
    setActivePreviewLink((prev) => (prev?.id === id ? null : prev));
    setLinks((prev) => prev.filter((link) => link.id !== id));
  };

  const deleteDuplicateLinks = () => {
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
  };

  const flattenBookmarkTree = (
    nodes: ChromeBookmarkNode[],
    path: string[] = []
  ): BookmarkImportItem[] => {
    const flattened: BookmarkImportItem[] = [];

    for (const node of nodes) {
      if (node.url) {
        const normalizedUrl = normalizeUrl(node.url);
        if (!isValidUrl(normalizedUrl)) {
          continue;
        }

        const title = node.title?.trim() || extractTitle(normalizedUrl);
        const location = path.length > 0 ? path.join(" / ") : "other";

        flattened.push({
          id: node.id,
          title,
          url: normalizedUrl,
          favicon: getResolvedFavicon(normalizedUrl),
          location,
        });
        continue;
      }

      if (!node.children?.length) {
        continue;
      }

      const nextPath = node.title?.trim() ? [...path, node.title] : path;
      flattened.push(...flattenBookmarkTree(node.children, nextPath));
    }

    return flattened;
  };

  const fetchBookmarks = async () => {
    if (typeof chrome === "undefined" || !chrome.bookmarks?.getTree) {
      setImportError("bookmarks are not available in this context");
      setBookmarkOptions([]);
      setSelectedBookmarkIds([]);
      return;
    }

    setIsImportLoading(true);
    setImportError(null);

    try {
      const bookmarkTree = await new Promise<ChromeBookmarkNode[]>(
        (resolve, reject) => {
          chrome.bookmarks?.getTree((nodes) => {
            if (!nodes) {
              reject(new Error("unable to read bookmark tree"));
              return;
            }

            resolve(nodes);
          });
        }
      );

      const options = flattenBookmarkTree(bookmarkTree);
      setBookmarkOptions(options);
      setSelectedBookmarkIds([]);
    } catch {
      setImportError("failed to load bookmarks");
      setBookmarkOptions([]);
      setSelectedBookmarkIds([]);
    } finally {
      setIsImportLoading(false);
    }
  };

  const openImportDialog = () => {
    setIsImportDialogOpen(true);
    fetchBookmarks().catch(() => null);
  };

  const ensureLinkPreview = useCallback(
    (url: string) => {
      const comparableUrl = getComparableUrl(url);
      const cachedPreview = previewCache[comparableUrl];
      const previewPlatform =
        cachedPreview?.platform || getPreviewPlatform(url);
      const shouldRefetchMissingYoutubeThumbnail =
        previewPlatform === "youtube" && !cachedPreview?.imageUrl;
      const shouldRefetchMissingIcon = !cachedPreview?.iconUrl;
      const shouldRefetchCachedPreview = shouldRefetchPreview(cachedPreview);

      if (
        cachedPreview &&
        !shouldRefetchCachedPreview &&
        !shouldRefetchMissingYoutubeThumbnail &&
        !shouldRefetchMissingIcon
      ) {
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

        setPreviewCache((prev) => {
          return pruneLinkPreviewCache({
            ...prev,
            [comparableUrl]: fetchedPreview,
          });
        });

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
    [getComparableUrl, previewCache, setLinks, setPreviewCache]
  );

  const openFloatingPreview = useCallback(
    (link: QuickLink, x: number, y: number) => {
      clearPreviewCloseTimeout();
      setActivePreviewLink(link);
      setPreviewPosition(getClampedPreviewPosition(x, y));
      ensureLinkPreview(link.url);
    },
    [clearPreviewCloseTimeout, ensureLinkPreview, getClampedPreviewPosition]
  );

  const moveFloatingPreview = useCallback(
    (x: number, y: number) => {
      setPreviewPosition(getClampedPreviewPosition(x, y));
    },
    [getClampedPreviewPosition]
  );

  const closeFloatingPreview = useCallback(() => {
    clearPreviewCloseTimeout();
    setActivePreviewLink(null);
  }, [clearPreviewCloseTimeout]);

  const scheduleFloatingPreviewClose = useCallback(() => {
    clearPreviewCloseTimeout();
    previewCloseTimeoutRef.current = window.setTimeout(() => {
      setActivePreviewLink(null);
      previewCloseTimeoutRef.current = null;
    }, 90);
  }, [clearPreviewCloseTimeout]);

  useEffect(() => {
    if (addFlowStage !== "ready-title") {
      return;
    }

    focusTitleInput();
  }, [addFlowStage, focusTitleInput]);

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

  const toggleBookmarkSelection = (bookmarkId: string) => {
    setSelectedBookmarkIds((prev) =>
      prev.includes(bookmarkId)
        ? prev.filter((id) => id !== bookmarkId)
        : [...prev, bookmarkId]
    );
  };

  const selectAllBookmarks = () => {
    setSelectedBookmarkIds(bookmarkOptions.map((bookmark) => bookmark.id));
  };

  const clearBookmarkSelection = () => {
    setSelectedBookmarkIds([]);
  };

  const importSelectedBookmarks = () => {
    if (selectedBookmarkIds.length === 0) {
      return;
    }

    const selectedIds = new Set(selectedBookmarkIds);

    setLinks((prev) => {
      const nextLinks = [...prev];
      const seenUrls = new Set(prev.map((link) => getComparableUrl(link.url)));

      for (const bookmark of bookmarkOptions) {
        if (!selectedIds.has(bookmark.id)) {
          continue;
        }

        const comparableUrl = getComparableUrl(bookmark.url);
        if (seenUrls.has(comparableUrl)) {
          continue;
        }

        seenUrls.add(comparableUrl);
        nextLinks.push({
          id: crypto.randomUUID(),
          title: bookmark.title,
          url: bookmark.url,
          favicon: getResolvedFavicon(bookmark.url),
        });
      }

      return nextLinks;
    });

    setIsImportDialogOpen(false);
    setSelectedBookmarkIds([]);
  };

  const handleUrlInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();

      startTitleResolution();
    }
  };

  const handleTitleInputKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Escape") {
      e.preventDefault();
      returnToUrlStage();
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();

      if (addFlowStage !== "ready-title") {
        return;
      }

      addLink();
    }
  };

  const handlePrimaryAction = () => {
    if (addFlowStage === "url") {
      startTitleResolution();
      return;
    }

    if (addFlowStage === "ready-title") {
      addLink();
    }
  };

  const renderLinks = () => {
    if (expanded) {
      return (
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex min-h-full flex-col space-y-0.5 pr-0">
            <AnimatePresence mode="popLayout">
              {displayedLinks.map((link) => (
                <motion.a
                  animate={{ filter: "blur(0px)", opacity: 1, x: 0, scale: 1 }}
                  className="group flex items-center gap-2 rounded-md border border-border/50 px-1.5 py-1 transition-colors hover:bg-accent/30 focus-visible:bg-accent/30 focus-visible:ring-2 focus-visible:ring-ring/30"
                  exit={{
                    filter: "blur(4px)",
                    opacity: 0,
                    x: 10,
                    scale: 0.95,
                  }}
                  href={link.url}
                  initial={{
                    filter: "blur(4px)",
                    opacity: 0,
                    x: 10,
                    scale: 0.95,
                  }}
                  key={link.id}
                  layout
                  rel="noopener noreferrer"
                  target="_blank"
                  transition={{ duration: 0.22, ease: EASE_OUT }}
                >
                  {link.favicon ? (
                    <img
                      alt={link.title}
                      className="size-4 shrink-0"
                      height={16}
                      loading="lazy"
                      src={link.favicon}
                      width={16}
                    />
                  ) : (
                    <IconExternalLink className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="flex-1 truncate text-xs">{link.title}</span>
                  <Button
                    className="size-6 opacity-0 transition-opacity focus-visible:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      deleteLink(link.id);
                    }}
                    size="icon-sm"
                    variant="ghost"
                  >
                    <IconTrash className="size-3.5 text-destructive" />
                    <span className="sr-only">Delete {link.title}</span>
                  </Button>
                </motion.a>
              ))}
              {displayedLinks.length === 0 && (
                <motion.div
                  animate={{ opacity: 1 }}
                  className="flex flex-1 items-center justify-center py-8"
                  exit={{ opacity: 0 }}
                  initial={{ opacity: 0 }}
                  key="empty-message-list"
                  transition={{ duration: 0.3 }}
                >
                  <p className="text-muted-foreground text-xs lowercase">
                    no links saved
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </ScrollArea>
      );
    }

    return (
      <div className="min-h-0 flex-1">
        <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-11 md:grid-cols-15 lg:grid-cols-7">
          <AnimatePresence mode="popLayout">
            {displayedLinks.map((link) => (
              <motion.div
                animate={{ filter: "blur(0px)", opacity: 1, scale: 1 }}
                exit={{ filter: "blur(4px)", opacity: 0, scale: 0.9 }}
                initial={{ filter: "blur(4px)", opacity: 0, scale: 0.5 }}
                key={link.id}
                layout
                transition={{ duration: 0.22, ease: EASE_OUT }}
              >
                <div className="group relative w-fit">
                  <a
                    className="flex size-8 items-center justify-center rounded-md border border-border/50 transition-colors hover:bg-accent/30 focus-visible:bg-accent/30 focus-visible:ring-2 focus-visible:ring-ring/30"
                    href={link.url}
                    onBlur={scheduleFloatingPreviewClose}
                    onClick={(event) => {
                      event.currentTarget.blur();
                      closeFloatingPreview();
                    }}
                    onFocus={(event) => {
                      const rect = event.currentTarget.getBoundingClientRect();
                      openFloatingPreview(
                        link,
                        rect.right,
                        rect.top + rect.height / 2
                      );
                    }}
                    onMouseEnter={(event) =>
                      openFloatingPreview(link, event.clientX, event.clientY)
                    }
                    onMouseLeave={scheduleFloatingPreviewClose}
                    onMouseMove={(event) =>
                      moveFloatingPreview(event.clientX, event.clientY)
                    }
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {link.favicon ? (
                      <img
                        alt={link.title}
                        className="size-4"
                        height={16}
                        loading="lazy"
                        src={link.favicon}
                        width={16}
                      />
                    ) : (
                      <IconExternalLink className="size-4 text-muted-foreground" />
                    )}
                  </a>
                  <button
                    className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-destructive text-white opacity-0 transition-opacity hover:bg-destructive/90 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/80 group-focus-within:opacity-100 group-hover:opacity-100"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      deleteLink(link.id);
                    }}
                    onMouseEnter={(event) =>
                      openFloatingPreview(link, event.clientX, event.clientY)
                    }
                    onMouseLeave={scheduleFloatingPreviewClose}
                    onMouseMove={(event) =>
                      moveFloatingPreview(event.clientX, event.clientY)
                    }
                    type="button"
                  >
                    <IconX className="size-2" />
                    <span className="sr-only">Delete {link.title}</span>
                  </button>
                </div>
              </motion.div>
            ))}
            {displayedLinks.length === 0 && (
              <motion.div
                animate={{ opacity: 1 }}
                className="col-span-full flex h-8 items-center justify-center"
                exit={{ opacity: 0 }}
                initial={{ opacity: 0 }}
                key="empty-message-grid"
                transition={{ duration: 0.3 }}
              >
                <p className="text-muted-foreground text-xs lowercase">
                  no links saved
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  };

  const getCardClasses = () => {
    if (fullSize) {
      return "flex min-h-0 w-full flex-1 flex-col gap-0 border-border/50 py-2";
    }
    if (expanded) {
      return "flex min-h-0 w-full flex-1 flex-col gap-0 border-border/50 py-2 lg:w-71";
    }
    return "flex h-fit max-h-40 w-full flex-col gap-0 border-border/50 py-2 lg:max-h-none lg:w-71";
  };

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
  const activePreviewCustomTitle = activePreviewLink?.title || "";
  const activePreviewMetadataTitle = activePreviewData?.title || "";
  const activePreviewDisplayTitle =
    activePreviewCustomTitle || activePreviewMetadataTitle;
  const activePreviewDescription = activePreviewData?.description || "";
  const activePreviewImageUrl = activePreviewData?.imageUrl || "";
  const activePreviewSiteName =
    activePreviewData?.siteName ||
    (activePreviewLink ? getDomainLabel(activePreviewLink.url) : "");
  const activePreviewMetadataTitleText =
    activePreviewMetadataTitle || activePreviewSiteName;
  const activePreviewMetadataDescriptionText =
    activePreviewDescription ||
    (activePreviewSiteName
      ? `${activePreviewSiteName} link preview`
      : "link preview");
  const normalizedNewUrl = normalizeUrl(newUrl);
  const canStartTitleResolution = Boolean(
    normalizedNewUrl && isValidUrl(normalizedNewUrl)
  );
  const isUrlEntryStage = addFlowStage === "url";
  const isTitleEntryStage = !isUrlEntryStage;
  const isTitleLoadingStage = addFlowStage === "loading-title";
  const canAdvanceFromUrlStage = isUrlEntryStage && canStartTitleResolution;

  const primaryButtonLabel = isTitleLoadingStage ? "Loading title" : "Add link";

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

    previewImage.onerror = () => {
      if (isCancelled) {
        return;
      }

      setFailedPreviewImageUrls((prev) => {
        if (prev[activePreviewImageUrl]) {
          return prev;
        }

        return {
          ...prev,
          [activePreviewImageUrl]: true,
        };
      });
    };

    previewImage.src = activePreviewImageUrl;

    return () => {
      isCancelled = true;
    };
  }, [
    activePreviewImageUrl,
    hasActivePreviewImage,
    isActivePreviewImageMarkedFailed,
  ]);

  return (
    <>
      <Dialog onOpenChange={setIsImportDialogOpen} open={isImportDialogOpen}>
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <Card className={getCardClasses()}>
              <CardHeader className="px-3 pb-1">
                <CardTitle className="font-medium text-xs lowercase">
                  quick links
                </CardTitle>
              </CardHeader>
              <CardContent
                className={`flex flex-col gap-1.5 px-3 ${expanded || fullSize ? "min-h-0 flex-1" : ""}`}
              >
                <div className="pb-0.5">
                  <div className="relative h-10 overflow-y-visible rounded-md">
                    <motion.div
                      animate={{
                        opacity: isUrlEntryStage ? 1 : 0,
                        x: isUrlEntryStage ? "0%" : "-105%",
                      }}
                      aria-hidden={!isUrlEntryStage}
                      className={`absolute inset-x-0 top-0 flex items-start gap-1 ${isUrlEntryStage ? "pointer-events-auto" : "pointer-events-none"}`}
                      initial={false}
                      transition={{ duration: 0.18, ease: EASE_OUT }}
                    >
                      <OverlappingLabelInput
                        className="h-8 flex-1 text-xs"
                        containerClassName="flex-1"
                        disabled={!isUrlEntryStage}
                        label="press enter to fetch title"
                        labelClassName="bottom-0 left-2 text-[9px]"
                        onChange={(e) => handleUrlInputChange(e.target.value)}
                        onKeyDown={handleUrlInputKeyDown}
                        placeholder="add a link..."
                        ref={urlInputRef}
                        tabIndex={isUrlEntryStage ? 0 : -1}
                        value={newUrl}
                      />
                      <Button
                        className="h-8 w-8"
                        disabled={!canAdvanceFromUrlStage}
                        onClick={handlePrimaryAction}
                        size="icon"
                        tabIndex={isUrlEntryStage ? 0 : -1}
                        type="button"
                      >
                        <IconPlus className="size-4" />
                        <span className="sr-only">Fetch title</span>
                      </Button>
                    </motion.div>

                    <motion.div
                      animate={{
                        opacity: isUrlEntryStage ? 0 : 1,
                        x: isUrlEntryStage ? "105%" : "0%",
                      }}
                      aria-hidden={!isTitleEntryStage}
                      className={`absolute inset-0 top-0 flex items-start gap-1 ${isUrlEntryStage ? "pointer-events-none" : "pointer-events-auto"}`}
                      initial={false}
                      transition={{ duration: 0.2, ease: EASE_IN_OUT }}
                    >
                      <OverlappingLabelInput
                        className="h-8 flex-1 text-xs"
                        containerClassName="flex-1"
                        disabled={!isTitleEntryStage || isTitleLoadingStage}
                        label={
                          isTitleLoadingStage
                            ? "loading title"
                            : "press esc to edit url"
                        }
                        labelClassName="bottom-0 left-2 text-[9px]"
                        onChange={(e) => handleTitleInputChange(e.target.value)}
                        onKeyDown={handleTitleInputKeyDown}
                        placeholder="edit title..."
                        ref={titleInputRef}
                        tabIndex={
                          isTitleEntryStage && !isTitleLoadingStage ? 0 : -1
                        }
                        value={newTitle}
                      />
                      <Button
                        className="h-8 w-8"
                        disabled={!isTitleEntryStage || isTitleLoadingStage}
                        onClick={handlePrimaryAction}
                        size="icon"
                        tabIndex={
                          isTitleEntryStage && !isTitleLoadingStage ? 0 : -1
                        }
                        type="button"
                      >
                        {isTitleLoadingStage ? (
                          <IconLoader2 className="size-4 animate-spin" />
                        ) : (
                          <IconCheck className="size-4" />
                        )}
                        <span className="sr-only">{primaryButtonLabel}</span>
                      </Button>
                    </motion.div>
                  </div>
                </div>

                {renderLinks()}
              </CardContent>
            </Card>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-56 bg-card/50 backdrop-blur-lg">
            <ContextMenuRadioGroup
              onValueChange={(value) =>
                setSortMode(value as QuickLinksSortMode)
              }
              value={sortMode}
            >
              <ContextMenuItem className="text-xs lowercase" disabled>
                sorting
              </ContextMenuItem>
              <ContextMenuRadioItem
                className="text-xs lowercase"
                value="alphabetical-asc"
              >
                <IconArrowDown className="size-3.5" />
                alphabetical (a-z)
              </ContextMenuRadioItem>
              <ContextMenuRadioItem
                className="text-xs lowercase"
                value="alphabetical-desc"
              >
                <IconArrowUp className="size-3.5" />
                alphabetical (z-a)
              </ContextMenuRadioItem>
              <ContextMenuRadioItem
                className="text-xs lowercase"
                value="recent"
              >
                <IconHistory className="size-3.5" />
                default (recency)
              </ContextMenuRadioItem>
            </ContextMenuRadioGroup>
            <ContextMenuSeparator />
            <ContextMenuItem className="text-xs lowercase" disabled>
              actions
            </ContextMenuItem>
            <ContextMenuItem
              className="text-xs lowercase"
              onSelect={openImportDialog}
            >
              import bookmarks
            </ContextMenuItem>
            <ContextMenuItem
              className="text-xs lowercase"
              disabled={!hasDuplicates}
              onSelect={deleteDuplicateLinks}
            >
              delete duplicates
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>

        <DialogContent>
          <DialogHeader>
            <DialogTitle>import bookmarks</DialogTitle>
            <DialogDescription>
              choose bookmarks to add into quick links
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between gap-2">
            <p className="text-muted-foreground text-xs lowercase">
              {bookmarkOptions.length} available
            </p>
            <div className="flex gap-1">
              <Button
                disabled={bookmarkOptions.length === 0 || isImportLoading}
                onClick={selectAllBookmarks}
                size="sm"
                type="button"
                variant="ghost"
              >
                select all
              </Button>
              <Button
                disabled={selectedBookmarkIds.length === 0 || isImportLoading}
                onClick={clearBookmarkSelection}
                size="sm"
                type="button"
                variant="ghost"
              >
                clear
              </Button>
            </div>
          </div>

          <ImportBookmarksContent
            bookmarkOptions={bookmarkOptions}
            importError={importError}
            isImportLoading={isImportLoading}
            onToggleBookmarkSelection={toggleBookmarkSelection}
            selectedBookmarkIds={selectedBookmarkIds}
          />

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                cancel
              </Button>
            </DialogClose>
            <Button
              disabled={selectedBookmarkIds.length === 0 || isImportLoading}
              onClick={importSelectedBookmarks}
              type="button"
            >
              import selected
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AnimatePresence>
        {!expanded && activePreviewLink ? (
          <motion.div
            animate={{
              opacity: 1,
              scale: 1,
              x: previewPosition.x,
              y: previewPosition.y,
            }}
            className="pointer-events-none fixed top-0 left-0 z-70"
            exit={{ opacity: 0, scale: 0.96 }}
            initial={{
              opacity: 0,
              scale: 0.96,
              x: previewPosition.x,
              y: previewPosition.y,
            }}
            style={{
              maxHeight: PREVIEW_CARD_HEIGHT,
              width: PREVIEW_CARD_WIDTH,
            }}
            transition={{
              damping: 34,
              mass: 0.6,
              stiffness: 380,
              type: "spring",
            }}
          >
            <Card className="min-h-0 gap-0 overflow-hidden rounded-md border border-border/50 bg-card/95 py-0 text-foreground shadow-xl backdrop-blur-lg">
              <CardHeader
                className="relative w-full shrink-0 overflow-hidden rounded-none border-border/30 border-b p-0"
                style={{ height: PREVIEW_MEDIA_HEIGHT }}
              >
                {hasActivePreviewImage && !isActivePreviewImageMarkedFailed ? (
                  <img
                    alt={activePreviewDisplayTitle}
                    className="absolute inset-0 block h-full w-full object-cover"
                    height={PREVIEW_MEDIA_HEIGHT}
                    loading="lazy"
                    src={activePreviewImageUrl}
                    width={PREVIEW_CARD_WIDTH}
                  />
                ) : (
                  <div className="absolute inset-0">
                    <PreviewFallbackMedia
                      favicon={activePreviewLink.favicon}
                      platform={activePreviewPlatform}
                      siteName={activePreviewSiteName}
                      title={activePreviewDisplayTitle}
                    />
                  </div>
                )}

                {isActivePreviewLoading ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <IconLoader2 className="size-4 animate-spin text-white" />
                  </div>
                ) : null}
              </CardHeader>

              <CardContent className="min-w-0 space-y-1.5 px-2.5 pt-2 pb-0">
                <CardTitle className="overflow-hidden text-xs leading-snug tracking-tight [-webkit-box-orient:vertical] [-webkit-line-clamp:1] [display:-webkit-box]">
                  {activePreviewDisplayTitle}
                </CardTitle>
                <p className="overflow-hidden text-[11px] text-muted-foreground leading-snug [-webkit-box-orient:vertical] [-webkit-line-clamp:1] [display:-webkit-box]">
                  {activePreviewMetadataTitleText}
                </p>
              </CardContent>

              <CardFooter className="min-w-0 items-start px-2.5 pt-1.5 pb-2.5">
                <div className="min-w-0 space-y-1">
                  <p className="overflow-hidden text-[10px] text-muted-foreground/90 leading-snug [-webkit-box-orient:vertical] [-webkit-line-clamp:3] [display:-webkit-box]">
                    {activePreviewMetadataDescriptionText}
                  </p>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground/80 lowercase">
                    <IconExternalLink className="size-2.5 shrink-0" />
                    <span className="truncate">
                      {activePreviewSiteName || "website"}
                    </span>
                  </div>
                </div>
              </CardFooter>
            </Card>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
