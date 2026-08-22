import type * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LinkPreviewCacheEntry } from "@/lib/link-preview";
import { fetchLinkPreviewMetadata } from "@/lib/link-preview";
import { runTrackedUserAction } from "@/lib/session-history";
import { extractTitle, isValidUrl, normalizeUrl } from "@/lib/url-utils";
import type { QuickLink, QuickLinkAddFlowStage } from "@/types/quick-links";

interface UseQuickLinksAddFlowOptions {
  clearStagedTitlePreview: () => void;
  ensureLinkPreview: (url: string) => void;
  getResolvedFavicon: (url: string) => string;
  setLinks: React.Dispatch<React.SetStateAction<QuickLink[]>>;
  stageResolvedTitlePreview: (
    url: string,
    preview: LinkPreviewCacheEntry
  ) => void;
}

export interface UseQuickLinksAddFlowResult {
  addFlowStage: QuickLinkAddFlowStage;
  canAdvanceFromUrlStage: boolean;
  handlePrimaryAction: () => void;
  handleTitleInputChange: (nextTitle: string) => void;
  handleTitleInputKeyDown: (
    event: React.KeyboardEvent<HTMLInputElement>
  ) => void;
  handleUrlInputChange: (nextUrl: string) => void;
  handleUrlInputKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  isTitleEntryStage: boolean;
  isTitleLoadingStage: boolean;
  isUrlEntryStage: boolean;
  newTitle: string;
  newUrl: string;
  primaryButtonLabel: string;
  titleInputRef: React.MutableRefObject<HTMLInputElement | null>;
  urlInputRef: React.MutableRefObject<HTMLInputElement | null>;
}

export function useQuickLinksAddFlow({
  clearStagedTitlePreview,
  ensureLinkPreview,
  getResolvedFavicon,
  setLinks,
  stageResolvedTitlePreview,
}: UseQuickLinksAddFlowOptions): UseQuickLinksAddFlowResult {
  const [newUrl, setNewUrl] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [addFlowStage, setAddFlowStage] =
    useState<QuickLinkAddFlowStage>("url");
  const titleAutofillRequestIdRef = useRef(0);
  const urlInputRef = useRef<HTMLInputElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

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

  const resetAddFlow = useCallback(() => {
    setNewUrl("");
    setNewTitle("");
    setAddFlowStage("url");
    titleAutofillRequestIdRef.current += 1;
    clearStagedTitlePreview();
    focusUrlInput();
  }, [clearStagedTitlePreview, focusUrlInput]);

  const returnToUrlStage = useCallback(() => {
    titleAutofillRequestIdRef.current += 1;
    setAddFlowStage("url");
    setNewTitle("");
    clearStagedTitlePreview();
    focusUrlInput();
  }, [clearStagedTitlePreview, focusUrlInput]);

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

  const resolveUrl = useCallback(() => {
    const normalized = normalizeUrl(newUrl);
    return normalized && isValidUrl(normalized) ? normalized : null;
  }, [newUrl]);

  const startTitleResolution = useCallback(() => {
    if (addFlowStage !== "url") {
      return;
    }

    const normalizedUrl = resolveUrl();
    if (!normalizedUrl) {
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
        stageResolvedTitlePreview(normalizedUrl, metadata);
        return metadata.title?.trim() || fallbackTitle;
      })
      .catch(() => fallbackTitle)
      .then((resolvedTitle) => {
        completeTitleResolution(requestId, resolvedTitle);
      });
  }, [
    addFlowStage,
    completeTitleResolution,
    resolveUrl,
    stageResolvedTitlePreview,
  ]);

  const commitLink = useCallback(
    (url: string, title: string) => {
      const link: QuickLink = {
        id: crypto.randomUUID(),
        title,
        url,
        favicon: getResolvedFavicon(url),
      };

      runTrackedUserAction("add quick link", () => {
        setLinks((prev) => [...prev, link]);
      });
      ensureLinkPreview(url);
      resetAddFlow();
    },
    [ensureLinkPreview, getResolvedFavicon, resetAddFlow, setLinks]
  );

  const addLink = useCallback(() => {
    if (addFlowStage !== "ready-title") {
      return;
    }

    const normalizedUrl = resolveUrl();
    if (!normalizedUrl) {
      return;
    }

    commitLink(normalizedUrl, newTitle.trim() || extractTitle(normalizedUrl));
  }, [addFlowStage, commitLink, newTitle, resolveUrl]);

  const addLinkDirectly = useCallback(() => {
    if (addFlowStage !== "url") {
      return;
    }

    const normalizedUrl = resolveUrl();
    if (!normalizedUrl) {
      return;
    }

    commitLink(normalizedUrl, extractTitle(normalizedUrl));
  }, [addFlowStage, commitLink, resolveUrl]);

  const handleUrlInputChange = (nextUrl: string) => {
    setNewUrl(nextUrl);
    setNewTitle("");
    clearStagedTitlePreview();

    if (!nextUrl.trim()) {
      titleAutofillRequestIdRef.current += 1;
      setAddFlowStage("url");
    }
  };

  const handleTitleInputChange = (nextTitle: string) => {
    setNewTitle(nextTitle);
  };

  const handleUrlInputKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (event.shiftKey) {
        addLinkDirectly();
      } else {
        startTitleResolution();
      }
    }
  };

  const handleTitleInputKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === "Escape") {
      event.preventDefault();
      returnToUrlStage();
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();

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

  const isUrlEntryStage = addFlowStage === "url";
  const isTitleEntryStage = !isUrlEntryStage;
  const isTitleLoadingStage = addFlowStage === "loading-title";
  const canAdvanceFromUrlStage = isUrlEntryStage && Boolean(resolveUrl());
  const primaryButtonLabel = isTitleLoadingStage ? "Loading title" : "Add link";

  useEffect(() => {
    if (addFlowStage !== "ready-title") {
      return;
    }

    focusTitleInput();
  }, [addFlowStage, focusTitleInput]);

  return {
    addFlowStage,
    canAdvanceFromUrlStage,
    handlePrimaryAction,
    handleTitleInputChange,
    handleTitleInputKeyDown,
    handleUrlInputChange,
    handleUrlInputKeyDown,
    isTitleEntryStage,
    isTitleLoadingStage,
    isUrlEntryStage,
    newTitle,
    newUrl,
    primaryButtonLabel,
    titleInputRef,
    urlInputRef,
  };
}
