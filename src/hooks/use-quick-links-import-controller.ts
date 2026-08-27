import type * as React from "react";
import { useCallback, useState } from "react";
import { runTrackedUserAction } from "@/lib/session-history";
import { extractTitle, isValidUrl, normalizeUrl } from "@/lib/url-utils";
import type {
  BookmarkImportItem,
  ChromeBookmarkNode,
  QuickLink,
} from "@/types/quick-links";

interface UseQuickLinksImportControllerOptions {
  ensureLinkPreview: (url: string) => void;
  getComparableUrl: (url: string) => string;
  getResolvedFavicon: (url: string) => string;
  setLinks: React.Dispatch<React.SetStateAction<QuickLink[]>>;
}

interface UseQuickLinksImportControllerResult {
  bookmarkOptions: BookmarkImportItem[];
  clearBookmarkSelection: () => void;
  importError: string | null;
  importSelectedBookmarks: () => void;
  isImportDialogOpen: boolean;
  isImportLoading: boolean;
  openImportDialog: () => void;
  selectAllBookmarks: () => void;
  selectedBookmarkIds: string[];
  setIsImportDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  toggleBookmarkSelection: (bookmarkId: string) => void;
}

declare const chrome: {
  bookmarks?: {
    getTree: (callback: (nodes: ChromeBookmarkNode[]) => void) => void;
  };
  runtime?: {
    lastError?: { message?: string };
  };
};

export function useQuickLinksImportController({
  ensureLinkPreview,
  getComparableUrl,
  getResolvedFavicon,
  setLinks,
}: UseQuickLinksImportControllerOptions): UseQuickLinksImportControllerResult {
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isImportLoading, setIsImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [bookmarkOptions, setBookmarkOptions] = useState<BookmarkImportItem[]>(
    []
  );
  const [selectedBookmarkIds, setSelectedBookmarkIds] = useState<string[]>([]);

  const flattenBookmarkTree = useCallback(
    (
      nodes: ChromeBookmarkNode[],
      path: string[] = []
    ): BookmarkImportItem[] => {
      const flattened: BookmarkImportItem[] = [];

      for (const node of nodes) {
        const nodeTitle = node.title?.trim() ?? "";

        if (node.url) {
          const normalizedUrl = normalizeUrl(node.url);
          if (!isValidUrl(normalizedUrl)) {
            continue;
          }

          const title = nodeTitle || extractTitle(normalizedUrl);
          const location = path.length > 0 ? path.join(" / ") : "other";

          flattened.push({
            favicon: getResolvedFavicon(normalizedUrl),
            id: node.id,
            location,
            title,
            url: normalizedUrl,
          });
          continue;
        }

        const children = node.children;
        if (!children || children.length === 0) {
          continue;
        }

        const nextPath = nodeTitle ? [...path, nodeTitle] : path;
        flattened.push(...flattenBookmarkTree(children, nextPath));
      }

      return flattened;
    },
    [getResolvedFavicon]
  );

  const fetchBookmarks = useCallback(async () => {
    const getTree =
      typeof chrome !== "undefined" ? chrome.bookmarks?.getTree : undefined;
    if (!getTree) {
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
          getTree((nodes) => {
            const lastError = chrome.runtime?.lastError;
            if (lastError) {
              reject(
                new Error(lastError.message ?? "unable to read bookmark tree")
              );
              return;
            }

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
  }, [flattenBookmarkTree]);

  const openImportDialog = useCallback(() => {
    setIsImportDialogOpen(true);
    fetchBookmarks().catch(() => null);
  }, [fetchBookmarks]);

  const toggleBookmarkSelection = useCallback((bookmarkId: string) => {
    setSelectedBookmarkIds((prev) =>
      prev.includes(bookmarkId)
        ? prev.filter((id) => id !== bookmarkId)
        : [...prev, bookmarkId]
    );
  }, []);

  const selectAllBookmarks = useCallback(() => {
    setSelectedBookmarkIds(bookmarkOptions.map((bookmark) => bookmark.id));
  }, [bookmarkOptions]);

  const clearBookmarkSelection = useCallback(() => {
    setSelectedBookmarkIds([]);
  }, []);

  const importSelectedBookmarks = useCallback(() => {
    if (selectedBookmarkIds.length === 0) {
      return;
    }

    const selectedIds = new Set(selectedBookmarkIds);
    const importedBookmarkUrls: string[] = [];

    runTrackedUserAction("import bookmarks to quick links", () => {
      setLinks((prev) => {
        const importedLinks: QuickLink[] = [];
        const seenUrls = new Set(
          prev.map((link) => getComparableUrl(link.url))
        );

        const now = Date.now();
        for (const [index, bookmark] of bookmarkOptions.entries()) {
          if (!selectedIds.has(bookmark.id)) {
            continue;
          }

          const comparableUrl = getComparableUrl(bookmark.url);
          if (seenUrls.has(comparableUrl)) {
            continue;
          }

          seenUrls.add(comparableUrl);
          importedBookmarkUrls.push(bookmark.url);
          importedLinks.push({
            createdAt: now - index,
            favicon: getResolvedFavicon(bookmark.url),
            id: crypto.randomUUID(),
            title: bookmark.title,
            url: bookmark.url,
          });
        }

        return [...importedLinks, ...prev];
      });
    });

    for (const importedBookmarkUrl of importedBookmarkUrls) {
      ensureLinkPreview(importedBookmarkUrl);
    }

    setIsImportDialogOpen(false);
    setSelectedBookmarkIds([]);
  }, [
    bookmarkOptions,
    ensureLinkPreview,
    getComparableUrl,
    getResolvedFavicon,
    selectedBookmarkIds,
    setLinks,
  ]);

  return {
    bookmarkOptions,
    clearBookmarkSelection,
    importError,
    importSelectedBookmarks,
    isImportDialogOpen,
    isImportLoading,
    openImportDialog,
    selectAllBookmarks,
    selectedBookmarkIds,
    setIsImportDialogOpen,
    toggleBookmarkSelection,
  };
}
