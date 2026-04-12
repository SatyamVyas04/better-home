import type * as React from "react";
import {
  PREVIEW_CARD_HEIGHT,
  PREVIEW_CARD_VIEWPORT_GUTTER,
  PREVIEW_CARD_WIDTH,
  PREVIEW_DESCRIPTION_MIN_CHARACTERS,
  PREVIEW_POINTER_OFFSET_X,
  PREVIEW_POINTER_OFFSET_Y,
  URL_SEGMENT_SEPARATOR_REGEX,
} from "@/constants/quick-links";
import type { BuildPreviewDescriptionTextOptions } from "@/types/quick-links";

export const clearTimeoutRef = (
  timeoutRef: React.MutableRefObject<number | null>
) => {
  if (timeoutRef.current === null) {
    return;
  }

  window.clearTimeout(timeoutRef.current);
  timeoutRef.current = null;
};

export const normalizePreviewText = (value: string): string => {
  return value.replace(/\s+/g, " ").trim();
};

export const clipPreviewText = (value: string, maxLength: number): string => {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}…`;
};

export const decodeUrlPathSegment = (segment: string): string => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
};

export const getUrlPathContext = (targetUrl: string): string => {
  try {
    const parsedUrl = new URL(targetUrl);
    const pathLabel = parsedUrl.pathname
      .split("/")
      .filter(Boolean)
      .slice(0, 3)
      .map((segment) => {
        return normalizePreviewText(
          decodeUrlPathSegment(segment).replace(
            URL_SEGMENT_SEPARATOR_REGEX,
            " "
          )
        );
      })
      .filter(Boolean)
      .join(" / ");
    const queryKeys = Array.from(parsedUrl.searchParams.keys());
    const queryLabel =
      queryKeys.length > 0
        ? `${queryKeys.length} query ${queryKeys.length === 1 ? "parameter" : "parameters"}`
        : "";

    return [pathLabel, queryLabel].filter(Boolean).join(" • ");
  } catch {
    return "";
  }
};

export const buildPreviewDescriptionText = ({
  customTitle,
  description,
  metadataTitle,
  siteName,
  url,
}: BuildPreviewDescriptionTextOptions): string => {
  const normalizedDescription = normalizePreviewText(description);
  const normalizedCustomTitle = normalizePreviewText(customTitle).toLowerCase();
  const normalizedMetadataTitle = normalizePreviewText(metadataTitle);
  const shouldIncludeMetadataTitle =
    normalizedMetadataTitle &&
    normalizedMetadataTitle.toLowerCase() !== normalizedCustomTitle;
  const pathContext = getUrlPathContext(url);
  const sourceContext = siteName ? `source: ${siteName}` : "";
  const fallbackDetails = clipPreviewText(
    [
      shouldIncludeMetadataTitle ? normalizedMetadataTitle : "",
      pathContext,
      sourceContext,
    ]
      .filter(Boolean)
      .join(" • "),
    280
  );

  if (!normalizedDescription) {
    return fallbackDetails || "saved bookmark preview";
  }

  if (normalizedDescription.length >= PREVIEW_DESCRIPTION_MIN_CHARACTERS) {
    return normalizedDescription;
  }

  if (!fallbackDetails) {
    return normalizedDescription;
  }

  return clipPreviewText(`${normalizedDescription} • ${fallbackDetails}`, 320);
};

export const clampPreviewCardPosition = (
  x: number,
  y: number,
  previewWidth = PREVIEW_CARD_WIDTH,
  previewHeight = PREVIEW_CARD_HEIGHT
) => {
  const viewportWidth = window.innerWidth;

  let nextX = x + PREVIEW_POINTER_OFFSET_X;
  let nextY = y - previewHeight - PREVIEW_POINTER_OFFSET_Y;

  if (nextX + previewWidth > viewportWidth - PREVIEW_CARD_VIEWPORT_GUTTER) {
    nextX = x - previewWidth - PREVIEW_POINTER_OFFSET_X;
  }

  if (nextY < PREVIEW_CARD_VIEWPORT_GUTTER) {
    nextY = y + PREVIEW_POINTER_OFFSET_Y;
  }

  nextX = Math.max(PREVIEW_CARD_VIEWPORT_GUTTER, nextX);
  nextY = Math.max(PREVIEW_CARD_VIEWPORT_GUTTER, nextY);

  return { x: nextX, y: nextY };
};
