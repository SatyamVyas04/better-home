import type * as React from "react";
import type {
  LinkPreviewCacheEntry,
  LinkPreviewPlatform,
} from "@/lib/link-preview";
import type {
  OpenFloatingPreviewOptions,
  QuickLink,
  QuickLinksSortMode,
} from "@/types/quick-links";

export interface UseQuickLinksPreviewControllerOptions {
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
  failedPreviewImageUrls: Record<string, true>;
  getComparableUrl: (url: string) => string;
  getResolvedFavicon: (url: string) => string;
  hasActivePreviewImage: boolean;
  hasDuplicates: boolean;
  hasPreviewCacheEntries: boolean;
  isActivePreviewImageMarkedFailed: boolean;
  isActivePreviewLoading: boolean;
  loadingPreviewUrls: string[];
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
  previewCache: Record<string, LinkPreviewCacheEntry>;
  scheduleFloatingPreviewClose: () => void;
  setSortMode: (nextSortMode: QuickLinksSortMode) => void;
  sortMode: QuickLinksSortMode;
  stageResolvedTitlePreview: (
    url: string,
    preview: LinkPreviewCacheEntry
  ) => void;
}
