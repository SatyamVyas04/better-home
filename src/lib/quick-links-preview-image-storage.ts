const QUICK_LINKS_PREVIEW_IMAGE_DATA_STORAGE_KEY =
  "better-home-quick-links-preview-image-data";

export interface QuickLinksPreviewImageDataEntry {
  imageUrl: string;
  imageDataUrl: string;
}

export type QuickLinksPreviewImageDataMap = Record<
  string,
  QuickLinksPreviewImageDataEntry
>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readPreviewImageDataStorageMap(): QuickLinksPreviewImageDataMap {
  try {
    const rawValue = window.localStorage.getItem(
      QUICK_LINKS_PREVIEW_IMAGE_DATA_STORAGE_KEY
    );

    if (!rawValue) {
      return {};
    }

    const parsedValue = JSON.parse(rawValue) as unknown;
    if (!isRecord(parsedValue)) {
      return {};
    }

    const nextMap: QuickLinksPreviewImageDataMap = {};

    for (const [comparableUrl, candidate] of Object.entries(parsedValue)) {
      if (!isRecord(candidate)) {
        continue;
      }

      const imageUrl =
        typeof candidate.imageUrl === "string" ? candidate.imageUrl : "";
      const imageDataUrl =
        typeof candidate.imageDataUrl === "string"
          ? candidate.imageDataUrl.trim()
          : "";

      if (!imageDataUrl) {
        continue;
      }

      nextMap[comparableUrl] = {
        imageUrl,
        imageDataUrl,
      };
    }

    return nextMap;
  } catch {
    return {};
  }
}

function writePreviewImageDataStorageMap(
  value: QuickLinksPreviewImageDataMap
): void {
  try {
    if (Object.keys(value).length === 0) {
      window.localStorage.removeItem(
        QUICK_LINKS_PREVIEW_IMAGE_DATA_STORAGE_KEY
      );
      return;
    }

    window.localStorage.setItem(
      QUICK_LINKS_PREVIEW_IMAGE_DATA_STORAGE_KEY,
      JSON.stringify(value)
    );
  } catch {
    return;
  }
}

export function readQuickLinksPreviewImageDataMap(): QuickLinksPreviewImageDataMap {
  return readPreviewImageDataStorageMap();
}

export function readQuickLinksPreviewImageDataUrl(
  comparableUrl: string,
  imageUrl: string
): string {
  if (!(comparableUrl && imageUrl)) {
    return "";
  }

  const map = readPreviewImageDataStorageMap();
  const entry = map[comparableUrl];

  if (!entry) {
    return "";
  }

  if (entry.imageUrl && entry.imageUrl !== imageUrl) {
    return "";
  }

  return entry.imageDataUrl;
}

export function writeQuickLinksPreviewImageDataUrl(
  comparableUrl: string,
  imageUrl: string,
  imageDataUrl: string
): void {
  const normalizedImageDataUrl = imageDataUrl.trim();

  if (!(comparableUrl && imageUrl && normalizedImageDataUrl)) {
    return;
  }

  const map = readPreviewImageDataStorageMap();
  const currentEntry = map[comparableUrl];

  if (
    currentEntry?.imageUrl === imageUrl &&
    currentEntry.imageDataUrl === normalizedImageDataUrl
  ) {
    return;
  }

  writePreviewImageDataStorageMap({
    ...map,
    [comparableUrl]: {
      imageUrl,
      imageDataUrl: normalizedImageDataUrl,
    },
  });
}

export function deleteQuickLinksPreviewImageDataUrl(
  comparableUrl: string
): void {
  if (!comparableUrl) {
    return;
  }

  const map = readPreviewImageDataStorageMap();

  if (!(comparableUrl in map)) {
    return;
  }

  const { [comparableUrl]: _deletedEntry, ...nextMap } = map;
  writePreviewImageDataStorageMap(nextMap);
}

export function clearQuickLinksPreviewImageDataUrls(): void {
  try {
    window.localStorage.removeItem(QUICK_LINKS_PREVIEW_IMAGE_DATA_STORAGE_KEY);
  } catch {
    return;
  }
}

export function pruneQuickLinksPreviewImageDataUrls(
  activeComparableUrls: Set<string>
): void {
  if (activeComparableUrls.size === 0) {
    clearQuickLinksPreviewImageDataUrls();
    return;
  }

  const map = readPreviewImageDataStorageMap();
  let hasRemovedEntries = false;
  const nextMap: QuickLinksPreviewImageDataMap = {};

  for (const [comparableUrl, entry] of Object.entries(map)) {
    if (!activeComparableUrls.has(comparableUrl)) {
      hasRemovedEntries = true;
      continue;
    }

    nextMap[comparableUrl] = entry;
  }

  if (!hasRemovedEntries) {
    return;
  }

  writePreviewImageDataStorageMap(nextMap);
}
