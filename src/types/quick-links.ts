import type * as React from "react";
import type {
  LinkPreviewCacheEntry,
  LinkPreviewPlatform,
} from "@/lib/link-preview";

export type QuickLinksDisplayMode = "list" | "icon-hover" | "compact-cards";
export type QuickLinksCompactColumns = 2 | 3 | 4;

export interface ChromeBookmarkNode {
  id: string;
  title?: string;
  url?: string;
  children?: ChromeBookmarkNode[];
}

export interface QuickLinksProps {
  compactCards?: boolean;
  compactColumns?: QuickLinksCompactColumns;
  displayMode?: QuickLinksDisplayMode;
  expanded?: boolean;
  fullSize?: boolean;
}

export interface QuickLink {
  id: string;
  title: string;
  url: string;
  favicon: string;
}

export interface BookmarkImportItem {
  id: string;
  title: string;
  url: string;
  favicon: string;
  location: string;
}

export type QuickLinksSortMode =
  | "recent"
  | "alphabetical-asc"
  | "alphabetical-desc";

export type QuickLinkAddFlowStage = "url" | "loading-title" | "ready-title";

export interface BuildPreviewDescriptionTextOptions {
  customTitle: string;
  description: string;
  metadataTitle: string;
  siteName: string;
  url: string;
}

export interface PreviewFallbackMediaProps {
  platform: LinkPreviewPlatform;
  favicon: string;
  title: string;
}

export interface ImportBookmarksContentProps {
  bookmarkOptions: BookmarkImportItem[];
  importError: string | null;
  isImportLoading: boolean;
  onToggleBookmarkSelection: (bookmarkId: string) => void;
  selectedBookmarkIds: string[];
}

export interface OpenFloatingPreviewOptions {
  immediate?: boolean;
}

export interface QuickLinksListProps {
  compactColumns?: QuickLinksCompactColumns;
  displayMode: QuickLinksDisplayMode;
  displayedLinks: QuickLink[];
  ensureLinkPreview: (url: string) => void;
  failedPreviewImageUrls: Record<string, true>;
  getComparableUrl: (url: string) => string;
  loadingPreviewUrls: string[];
  onCloseFloatingPreview: () => void;
  onDeleteLink: (id: string) => void;
  onMoveFloatingPreview: (x: number, y: number) => void;
  onOpenFloatingPreview: (
    link: QuickLink,
    x: number,
    y: number,
    options?: OpenFloatingPreviewOptions
  ) => void;
  onScheduleFloatingPreviewClose: () => void;
  previewCache: Record<string, LinkPreviewCacheEntry>;
}

export interface QuickLinksPreviewCardProps {
  activePreviewDisplayTitle: string;
  activePreviewImageUrl: string;
  activePreviewLink: QuickLink | null;
  activePreviewMetadataDescriptionText: string;
  activePreviewMetadataTitleText: string;
  activePreviewPlatform: LinkPreviewPlatform;
  activePreviewUserTitleText: string;
  floatingPreviewEnabled: boolean;
  hasActivePreviewImage: boolean;
  isActivePreviewImageMarkedFailed: boolean;
  isActivePreviewLoading: boolean;
  previewContentDirection: 1 | -1;
  previewPosition: {
    x: number;
    y: number;
  };
}

export type QuickLinksInputKeyDownEvent = React.KeyboardEvent<HTMLInputElement>;
