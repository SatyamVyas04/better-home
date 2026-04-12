import { ICON_SIZE_REGEX, WHITESPACE_REGEX } from "./constants";
import { getNonEmptyString, resolveUrl } from "./utils";

interface IconCandidate {
  score: number;
  url: string;
}

const getIconTypeScore = (typeValue: string): number => {
  const normalizedType = typeValue.toLowerCase();

  if (normalizedType.includes("svg")) {
    return 360;
  }

  if (normalizedType.includes("png")) {
    return 260;
  }

  if (normalizedType.includes("webp")) {
    return 220;
  }

  if (normalizedType.includes("ico")) {
    return 180;
  }

  return 120;
};

const getIconSizeScore = (sizesValue: string): number => {
  const normalizedSizes = sizesValue.toLowerCase().trim();
  if (!normalizedSizes) {
    return 90;
  }

  if (normalizedSizes === "any") {
    return 260;
  }

  let largestSize = 0;

  for (const sizeToken of normalizedSizes.split(WHITESPACE_REGEX)) {
    const match = sizeToken.match(ICON_SIZE_REGEX);
    if (!match) {
      continue;
    }

    const width = Number.parseInt(match[1], 10);
    const height = Number.parseInt(match[2], 10);
    largestSize = Math.max(largestSize, width, height);
  }

  if (largestSize >= 512) {
    return 320;
  }

  if (largestSize >= 256) {
    return 280;
  }

  if (largestSize >= 128) {
    return 240;
  }

  if (largestSize >= 64) {
    return 200;
  }

  if (largestSize >= 32) {
    return 160;
  }

  if (largestSize >= 16) {
    return 130;
  }

  return 90;
};

const getIconRelScore = (relValue: string): number => {
  const relTokens = relValue.toLowerCase().split(WHITESPACE_REGEX);

  if (relTokens.includes("apple-touch-icon-precomposed")) {
    return 5600;
  }

  if (relTokens.includes("apple-touch-icon")) {
    return 5400;
  }

  if (relTokens.includes("fluid-icon")) {
    return 5200;
  }

  if (relTokens.includes("icon")) {
    if (relTokens.includes("mask-icon")) {
      return 4600;
    }

    if (relTokens.includes("shortcut")) {
      return 4400;
    }

    return 4800;
  }

  return 0;
};

const getBestScoredIconUrl = (candidates: IconCandidate[]): string => {
  let bestCandidate: IconCandidate | null = null;

  for (const candidate of candidates) {
    if (!bestCandidate || candidate.score > bestCandidate.score) {
      bestCandidate = candidate;
    }
  }

  return bestCandidate?.url || "";
};

export const getBestLinkedIconUrl = (
  document: Document,
  targetUrl: string
): string => {
  const candidates: IconCandidate[] = [];
  const linkElements = document.querySelectorAll("link[rel][href]");

  for (const linkElement of linkElements) {
    const relValue = getNonEmptyString(linkElement.getAttribute("rel"));
    if (!relValue) {
      continue;
    }

    const relScore = getIconRelScore(relValue);
    if (relScore === 0) {
      continue;
    }

    const hrefValue = getNonEmptyString(linkElement.getAttribute("href"));
    const resolvedHref = resolveUrl(hrefValue, targetUrl);
    if (!resolvedHref) {
      continue;
    }

    const sizesValue = getNonEmptyString(linkElement.getAttribute("sizes"));
    const typeValue = getNonEmptyString(linkElement.getAttribute("type"));
    const score =
      relScore + getIconSizeScore(sizesValue) + getIconTypeScore(typeValue);

    candidates.push({
      score,
      url: resolvedHref,
    });
  }

  return getBestScoredIconUrl(candidates);
};

export const getManifestUrl = (
  document: Document,
  targetUrl: string
): string => {
  const manifestHref = getNonEmptyString(
    document.querySelector('link[rel~="manifest"]')?.getAttribute("href")
  );

  return resolveUrl(manifestHref, targetUrl);
};

const getManifestPurposeScore = (purposeValue: string): number => {
  const purposes = purposeValue.toLowerCase().split(WHITESPACE_REGEX);

  if (purposes.includes("maskable")) {
    return 220;
  }

  if (purposes.includes("any")) {
    return 180;
  }

  return 140;
};

interface ManifestIconEntry {
  purpose?: string;
  sizes?: string;
  src?: string;
  type?: string;
}

interface WebManifestPayload {
  icons?: ManifestIconEntry[];
}

const getBestManifestIconUrl = (
  manifestPayload: WebManifestPayload,
  manifestUrl: string
): string => {
  const icons = manifestPayload.icons;
  if (!Array.isArray(icons)) {
    return "";
  }

  const candidates: IconCandidate[] = [];

  for (const icon of icons) {
    const srcValue = getNonEmptyString(icon.src);
    const resolvedSrc = resolveUrl(srcValue, manifestUrl);
    if (!resolvedSrc) {
      continue;
    }

    const score =
      5200 +
      getManifestPurposeScore(getNonEmptyString(icon.purpose)) +
      getIconSizeScore(getNonEmptyString(icon.sizes)) +
      getIconTypeScore(getNonEmptyString(icon.type));

    candidates.push({
      score,
      url: resolvedSrc,
    });
  }

  return getBestScoredIconUrl(candidates);
};

export const fetchManifestIconUrl = async (
  manifestUrl: string,
  signal: AbortSignal
): Promise<string> => {
  if (!manifestUrl) {
    return "";
  }

  try {
    const response = await fetch(manifestUrl, {
      credentials: "omit",
      signal,
    });

    if (!response.ok) {
      return "";
    }

    const manifestPayload = (await response.json()) as WebManifestPayload;
    return getBestManifestIconUrl(manifestPayload, manifestUrl);
  } catch {
    return "";
  }
};

export const getDefaultIconUrl = (targetUrl: string): string =>
  resolveUrl("/favicon.ico", targetUrl);
