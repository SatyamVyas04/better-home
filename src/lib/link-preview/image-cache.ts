import {
  PREVIEW_FETCH_TIMEOUT_MS,
  PREVIEW_IMAGE_DATA_URL_MAX_LENGTH,
  PREVIEW_IMAGE_DATA_URL_PRIMARY_MAX_WIDTH,
  PREVIEW_IMAGE_DATA_URL_PRIMARY_QUALITY,
  PREVIEW_IMAGE_DATA_URL_RUNTIME_MAX_ITEMS,
  PREVIEW_IMAGE_DATA_URL_SECONDARY_MAX_WIDTH,
  PREVIEW_IMAGE_DATA_URL_SECONDARY_QUALITY,
  PREVIEW_IMAGE_SOURCE_MAX_BYTES,
} from "./constants";
import { getNonEmptyString } from "./utils";

const previewImageWarmRequestMap = new Map<string, Promise<boolean>>();
const warmedPreviewImageUrls = new Set<string>();
const previewImageDataUrlRequestMap = new Map<string, Promise<string>>();
const previewImageDataUrlMap = new Map<string, string>();

const setPreviewImageDataUrlCacheValue = (
  imageUrl: string,
  imageDataUrl: string
): void => {
  if (previewImageDataUrlMap.has(imageUrl)) {
    previewImageDataUrlMap.delete(imageUrl);
  }

  previewImageDataUrlMap.set(imageUrl, imageDataUrl);

  while (
    previewImageDataUrlMap.size > PREVIEW_IMAGE_DATA_URL_RUNTIME_MAX_ITEMS
  ) {
    const oldestImageUrl = previewImageDataUrlMap.keys().next().value;
    if (!oldestImageUrl) {
      return;
    }

    previewImageDataUrlMap.delete(oldestImageUrl);
  }
};

const readBlobAsDataUrl = (blob: Blob): Promise<string> => {
  return new Promise((resolve) => {
    const fileReader = new FileReader();

    fileReader.onload = () => {
      if (typeof fileReader.result === "string") {
        resolve(fileReader.result);
        return;
      }

      resolve("");
    };

    fileReader.onerror = () => {
      resolve("");
    };

    fileReader.readAsDataURL(blob);
  });
};

const loadImageElement = (sourceUrl: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const imageElement = new Image();
    imageElement.decoding = "async";
    imageElement.loading = "eager";
    imageElement.fetchPriority = "high";

    imageElement.onload = () => {
      resolve(imageElement);
    };

    imageElement.onerror = () => {
      reject(new Error("failed to decode image blob"));
    };

    imageElement.src = sourceUrl;
  });
};

const renderImageDataUrl = (
  imageElement: HTMLImageElement,
  format: "image/webp" | "image/jpeg",
  quality: number,
  maxWidth: number
): string => {
  const sourceWidth = imageElement.naturalWidth || imageElement.width;
  const sourceHeight = imageElement.naturalHeight || imageElement.height;
  if (!(sourceWidth > 0 && sourceHeight > 0)) {
    return "";
  }

  const scale = Math.min(1, maxWidth / sourceWidth);
  const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
  const targetHeight = Math.max(1, Math.round(sourceHeight * scale));

  const canvasElement = document.createElement("canvas");
  canvasElement.width = targetWidth;
  canvasElement.height = targetHeight;

  const context2D = canvasElement.getContext("2d");
  if (!context2D) {
    return "";
  }

  context2D.imageSmoothingEnabled = true;
  context2D.imageSmoothingQuality = "high";
  context2D.drawImage(imageElement, 0, 0, targetWidth, targetHeight);

  try {
    return canvasElement.toDataURL(format, quality);
  } catch {
    return "";
  }
};

const convertImageBlobToDataUrl = async (imageBlob: Blob): Promise<string> => {
  if (
    !(imageBlob.size > 0 && imageBlob.size <= PREVIEW_IMAGE_SOURCE_MAX_BYTES)
  ) {
    return "";
  }

  const objectUrl = URL.createObjectURL(imageBlob);

  try {
    const imageElement = await loadImageElement(objectUrl);
    const primaryDataUrl = renderImageDataUrl(
      imageElement,
      "image/webp",
      PREVIEW_IMAGE_DATA_URL_PRIMARY_QUALITY,
      PREVIEW_IMAGE_DATA_URL_PRIMARY_MAX_WIDTH
    );

    if (
      primaryDataUrl &&
      primaryDataUrl.length <= PREVIEW_IMAGE_DATA_URL_MAX_LENGTH
    ) {
      return primaryDataUrl;
    }

    const secondaryDataUrl = renderImageDataUrl(
      imageElement,
      "image/jpeg",
      PREVIEW_IMAGE_DATA_URL_SECONDARY_QUALITY,
      PREVIEW_IMAGE_DATA_URL_SECONDARY_MAX_WIDTH
    );

    if (
      secondaryDataUrl &&
      secondaryDataUrl.length <= PREVIEW_IMAGE_DATA_URL_MAX_LENGTH
    ) {
      return secondaryDataUrl;
    }
  } catch {
    // Fall back to original blob encoding if resize/decode fails.
  } finally {
    URL.revokeObjectURL(objectUrl);
  }

  const rawDataUrl = await readBlobAsDataUrl(imageBlob);
  if (!rawDataUrl) {
    return "";
  }

  return rawDataUrl.length <= PREVIEW_IMAGE_DATA_URL_MAX_LENGTH
    ? rawDataUrl
    : "";
};

const fetchImageBlobForDataUrl = async (
  imageUrl: string
): Promise<Blob | null> => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    PREVIEW_FETCH_TIMEOUT_MS
  );

  try {
    const response = await fetch(imageUrl, {
      credentials: "omit",
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const contentType = getNonEmptyString(
      response.headers.get("content-type")
    ).toLowerCase();
    if (!contentType?.startsWith("image/")) {
      return null;
    }

    const contentLength = response.headers.get("content-length");
    if (contentLength !== null) {
      const byteCount = Number.parseInt(contentLength, 10);
      if (
        Number.isFinite(byteCount) &&
        byteCount > PREVIEW_IMAGE_SOURCE_MAX_BYTES
      ) {
        return null;
      }
    }

    const imageBlob = await response.blob();
    if (imageBlob.size === 0) {
      return null;
    }

    return imageBlob;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeoutId);
  }
};

export const cacheLinkPreviewImageDataUrl = (
  imageUrl: string
): Promise<string> => {
  const normalizedImageUrl = getNonEmptyString(imageUrl);
  if (!normalizedImageUrl) {
    return Promise.resolve("");
  }

  if (normalizedImageUrl.startsWith("data:")) {
    return Promise.resolve(normalizedImageUrl);
  }

  const cachedImageDataUrl = previewImageDataUrlMap.get(normalizedImageUrl);
  if (cachedImageDataUrl) {
    return Promise.resolve(cachedImageDataUrl);
  }

  const activeDataUrlRequest =
    previewImageDataUrlRequestMap.get(normalizedImageUrl);
  if (activeDataUrlRequest) {
    return activeDataUrlRequest;
  }

  const dataUrlRequest = fetchImageBlobForDataUrl(normalizedImageUrl)
    .then((imageBlob) => {
      if (!imageBlob) {
        return "";
      }

      return convertImageBlobToDataUrl(imageBlob);
    })
    .then((imageDataUrl) => {
      if (imageDataUrl) {
        setPreviewImageDataUrlCacheValue(normalizedImageUrl, imageDataUrl);
      }

      return imageDataUrl;
    })
    .finally(() => {
      previewImageDataUrlRequestMap.delete(normalizedImageUrl);
    });

  previewImageDataUrlRequestMap.set(normalizedImageUrl, dataUrlRequest);
  return dataUrlRequest;
};

const loadImageForWarmCache = (imageUrl: string): Promise<boolean> => {
  if (typeof Image === "undefined") {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    const previewImage = new Image();
    previewImage.decoding = "async";
    previewImage.loading = "eager";
    previewImage.fetchPriority = "high";

    const finish = (isLoaded: boolean) => {
      previewImage.onload = null;
      previewImage.onerror = null;
      resolve(isLoaded);
    };

    previewImage.onload = () => {
      finish(true);
    };

    previewImage.onerror = () => {
      finish(false);
    };

    previewImage.src = imageUrl;
  });
};

export const warmLinkPreviewImage = (imageUrl: string): Promise<boolean> => {
  const normalizedImageUrl = getNonEmptyString(imageUrl);
  if (!normalizedImageUrl) {
    return Promise.resolve(false);
  }

  if (warmedPreviewImageUrls.has(normalizedImageUrl)) {
    return Promise.resolve(true);
  }

  const activeWarmRequest = previewImageWarmRequestMap.get(normalizedImageUrl);
  if (activeWarmRequest) {
    return activeWarmRequest;
  }

  const warmRequest = loadImageForWarmCache(normalizedImageUrl)
    .then((isLoaded) => {
      if (isLoaded) {
        warmedPreviewImageUrls.add(normalizedImageUrl);
      }

      return isLoaded;
    })
    .finally(() => {
      previewImageWarmRequestMap.delete(normalizedImageUrl);
    });

  previewImageWarmRequestMap.set(normalizedImageUrl, warmRequest);
  return warmRequest;
};

export const resetLinkPreviewImageRuntimeCache = (): void => {
  previewImageWarmRequestMap.clear();
  warmedPreviewImageUrls.clear();
  previewImageDataUrlRequestMap.clear();
  previewImageDataUrlMap.clear();
};
