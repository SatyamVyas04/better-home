const PREVIEW_FETCH_TIMEOUT_MS = 5000;
const PREVIEW_SUCCESS_TTL_MS = 24 * 60 * 60 * 1000;
const PREVIEW_DEGRADED_RETRY_BASE_MS = 2 * 60 * 1000;
const PREVIEW_DEGRADED_RETRY_MAX_MS = 60 * 60 * 1000;
const PREVIEW_DEGRADED_RETENTION_MS = 2 * 24 * 60 * 60 * 1000;
const PREVIEW_CACHE_MAX_ITEMS = 150;
const WWW_PREFIX_REGEX = /^www\./i;
const YOUTUBE_HOST_REGEX =
  /(^|\.)youtube\.com$|(^|\.)youtube-nocookie\.com$|(^|\.)youtu\.be$/i;
const X_HOST_REGEX = /(^|\.)x\.com$|(^|\.)twitter\.com$/i;
const GITHUB_HOST_REGEX = /(^|\.)github\.com$/i;
const YOUTUBE_VIDEO_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;
const URL_FRAGMENT_SPLIT_REGEX = /[?&#/]/;
const X_STATUS_PATH_REGEX = /^\/([^/]+)\/status\/(\d+)/i;
const GITHUB_NUMBER_REGEX = /^\d+$/;
const GIT_SUFFIX_REGEX = /\.git$/i;
const ICON_SIZE_REGEX = /^(\d+)x(\d+)$/i;
const WHITESPACE_REGEX = /\s+/;
const JSON_LD_TYPE_FRAGMENT = "ld+json";
const PREVIEW_DESCRIPTION_MAX_LENGTH = 360;
const PREVIEW_DESCRIPTION_MIN_PARAGRAPH_LENGTH = 48;
const JSON_LD_MAX_TRAVERSAL_DEPTH = 5;
const JSON_LD_MAX_CANDIDATES = 14;
const PREVIEW_IMAGE_MIN_DIMENSION = 64;
const DISALLOWED_PREVIEW_IMAGE_TOKEN_REGEX =
  /(?:^|[./_-])(favicon|apple-touch-icon|mask-icon|sprite|avatar|profile)(?:$|[./_-])/i;
const PREVIEW_IMAGE_DATA_URL_MAX_LENGTH = 90_000;
const PREVIEW_IMAGE_DATA_URL_PRIMARY_MAX_WIDTH = 560;
const PREVIEW_IMAGE_DATA_URL_SECONDARY_MAX_WIDTH = 420;
const PREVIEW_IMAGE_DATA_URL_PRIMARY_QUALITY = 0.76;
const PREVIEW_IMAGE_DATA_URL_SECONDARY_QUALITY = 0.62;
const PREVIEW_IMAGE_SOURCE_MAX_BYTES = 2.5 * 1024 * 1024;
const PREVIEW_IMAGE_DATA_URL_RUNTIME_MAX_ITEMS = 120;

const previewImageWarmRequestMap = new Map<string, Promise<boolean>>();
const warmedPreviewImageUrls = new Set<string>();
const previewImageDataUrlRequestMap = new Map<string, Promise<string>>();
const previewImageDataUrlMap = new Map<string, string>();

export type LinkPreviewPlatform = "youtube" | "x" | "github" | "generic";
export type LinkPreviewQuality = "success" | "degraded";

type LinkPreviewSource =
  | "generic-html"
  | "github-api"
  | "github-fallback"
  | "platform-fallback"
  | "x-fallback"
  | "x-oembed"
  | "youtube-oembed"
  | "youtube-thumbnail";

export interface LinkPreviewCacheEntry {
  title: string;
  description: string;
  imageUrl: string;
  imageDataUrl?: string;
  iconUrl: string;
  siteName: string;
  platform: LinkPreviewPlatform;
  fetchedAt: number;
  quality: LinkPreviewQuality;
  source: LinkPreviewSource;
  nextRetryAt: number;
  failureCount: number;
}

const getNonEmptyString = (value: string | null | undefined): string =>
  value?.trim() || "";

const clipText = (value: string, maxLength = 240): string => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1)}…`;
};

const getHostLabel = (targetUrl: string): string => {
  try {
    return getNonEmptyString(
      new URL(targetUrl).hostname.replace(WWW_PREFIX_REGEX, "")
    );
  } catch {
    return "";
  }
};

const getPlatformFromHost = (hostname: string): LinkPreviewPlatform => {
  if (YOUTUBE_HOST_REGEX.test(hostname)) {
    return "youtube";
  }

  if (X_HOST_REGEX.test(hostname)) {
    return "x";
  }

  if (GITHUB_HOST_REGEX.test(hostname)) {
    return "github";
  }

  return "generic";
};

export const getPreviewPlatform = (targetUrl: string): LinkPreviewPlatform => {
  try {
    return getPlatformFromHost(new URL(targetUrl).hostname.toLowerCase());
  } catch {
    return "generic";
  }
};

const normalizeYouTubeVideoId = (candidate: string): string => {
  const value = getNonEmptyString(candidate).split(URL_FRAGMENT_SPLIT_REGEX)[0];
  return YOUTUBE_VIDEO_ID_REGEX.test(value) ? value : "";
};

const getYouTubeVideoId = (targetUrl: string): string => {
  try {
    const url = new URL(targetUrl);
    const hostname = url.hostname.toLowerCase();

    if (!YOUTUBE_HOST_REGEX.test(hostname)) {
      return "";
    }

    if (hostname.endsWith("youtu.be")) {
      return normalizeYouTubeVideoId(url.pathname.split("/")[1] || "");
    }

    const queryVideoId = normalizeYouTubeVideoId(
      url.searchParams.get("v") || ""
    );
    if (queryVideoId) {
      return queryVideoId;
    }

    const pathSegments = url.pathname.split("/").filter(Boolean);
    if (pathSegments.length < 2) {
      return "";
    }

    const route = pathSegments[0];
    if (route === "shorts" || route === "embed" || route === "live") {
      return normalizeYouTubeVideoId(pathSegments[1]);
    }

    return "";
  } catch {
    return "";
  }
};

const getYouTubeThumbnailUrlById = (videoId: string): string =>
  videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : "";

const getYouTubeThumbnailUrl = (targetUrl: string): string =>
  getYouTubeThumbnailUrlById(getYouTubeVideoId(targetUrl));

const getCanonicalYouTubeWatchUrl = (videoId: string): string =>
  `https://www.youtube.com/watch?v=${videoId}`;

interface XStatusDetails {
  statusId: string;
  username: string;
}

const getXStatusDetails = (targetUrl: string): XStatusDetails | null => {
  try {
    const url = new URL(targetUrl);
    const match = url.pathname.match(X_STATUS_PATH_REGEX);
    if (!match) {
      return null;
    }

    const username = getNonEmptyString(match[1]);
    const statusId = getNonEmptyString(match[2]);
    if (!(username && statusId)) {
      return null;
    }

    return {
      statusId,
      username,
    };
  } catch {
    return null;
  }
};

const getXProfileHandle = (targetUrl: string): string => {
  try {
    const url = new URL(targetUrl);
    const pathSegments = url.pathname.split("/").filter(Boolean);
    if (pathSegments.length === 0) {
      return "";
    }

    const firstSegment = getNonEmptyString(pathSegments[0]);
    return firstSegment.toLowerCase() === "i" ? "" : firstSegment;
  } catch {
    return "";
  }
};

type GitHubResourceKind = "issue" | "pull" | "repo" | "user";

interface GitHubResourceDetails {
  kind: GitHubResourceKind;
  number?: number;
  owner: string;
  repo?: string;
}

const parseGitHubResource = (
  targetUrl: string
): GitHubResourceDetails | null => {
  try {
    const url = new URL(targetUrl);
    const pathSegments = url.pathname
      .split("/")
      .filter(Boolean)
      .map((segment) => segment.trim());

    if (pathSegments.length === 0) {
      return null;
    }

    const owner = getNonEmptyString(pathSegments[0]);
    if (!owner) {
      return null;
    }

    if (pathSegments.length === 1) {
      return {
        kind: "user",
        owner,
      };
    }

    const repo = getNonEmptyString(pathSegments[1]).replace(
      GIT_SUFFIX_REGEX,
      ""
    );
    if (!repo) {
      return null;
    }

    if (
      pathSegments[2] === "issues" &&
      GITHUB_NUMBER_REGEX.test(pathSegments[3] || "")
    ) {
      return {
        kind: "issue",
        number: Number.parseInt(pathSegments[3], 10),
        owner,
        repo,
      };
    }

    if (
      pathSegments[2] === "pull" &&
      GITHUB_NUMBER_REGEX.test(pathSegments[3] || "")
    ) {
      return {
        kind: "pull",
        number: Number.parseInt(pathSegments[3], 10),
        owner,
        repo,
      };
    }

    return {
      kind: "repo",
      owner,
      repo,
    };
  } catch {
    return null;
  }
};

const getMetaContent = (document: Document, selectors: string[]): string => {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (!element) {
      continue;
    }

    const content = getNonEmptyString(element.getAttribute("content"));
    if (content) {
      return content;
    }
  }

  return "";
};

const getMetaContentValues = (
  document: Document,
  selectors: string[]
): string[] => {
  const values: string[] = [];

  for (const selector of selectors) {
    const metaElements = document.querySelectorAll(selector);

    for (const element of metaElements) {
      const content = getNonEmptyString(element.getAttribute("content"));
      if (!content) {
        continue;
      }

      values.push(content);
    }
  }

  return values;
};

const getLongestTextValue = (candidates: string[]): string => {
  let longestValue = "";

  for (const candidate of candidates) {
    const normalizedCandidate = getNonEmptyString(candidate).replace(
      /\s+/g,
      " "
    );
    if (normalizedCandidate.length > longestValue.length) {
      longestValue = normalizedCandidate;
    }
  }

  return longestValue;
};

const getNumericAttributeValue = (
  element: Element,
  attributeName: string
): number => {
  const rawAttribute = getNonEmptyString(element.getAttribute(attributeName));
  if (!rawAttribute) {
    return 0;
  }

  const parsedValue = Number.parseInt(rawAttribute, 10);
  if (Number.isNaN(parsedValue)) {
    return 0;
  }

  return Math.max(0, parsedValue);
};

const isSupportedPreviewImageUrl = (imageUrl: string): boolean => {
  if (!imageUrl) {
    return false;
  }

  const normalizedImageUrl = imageUrl.toLowerCase();
  if (
    normalizedImageUrl.startsWith("data:") ||
    normalizedImageUrl.startsWith("blob:")
  ) {
    return false;
  }

  return !DISALLOWED_PREVIEW_IMAGE_TOKEN_REGEX.test(normalizedImageUrl);
};

const resolvePreviewImageUrl = (
  candidate: string,
  targetUrl: string
): string => {
  const resolvedImageUrl = resolveUrl(candidate, targetUrl);
  return isSupportedPreviewImageUrl(resolvedImageUrl) ? resolvedImageUrl : "";
};

const hasReachedJsonLdCandidateLimit = (candidates: string[]): boolean => {
  return candidates.length >= JSON_LD_MAX_CANDIDATES;
};

const appendJsonLdTextCandidate = (
  value: unknown,
  candidates: string[]
): void => {
  if (typeof value !== "string" || hasReachedJsonLdCandidateLimit(candidates)) {
    return;
  }

  const normalizedCandidate = getNonEmptyString(value).replace(/\s+/g, " ");
  if (!normalizedCandidate) {
    return;
  }

  candidates.push(normalizedCandidate);
};

const collectNestedJsonLdCandidates = (
  values: unknown[],
  candidates: string[],
  depth: number
): void => {
  for (const value of values) {
    if (hasReachedJsonLdCandidateLimit(candidates)) {
      return;
    }

    collectJsonLdTextCandidates(value, candidates, depth + 1);
  }
};

const collectJsonLdTextCandidates = (
  payload: unknown,
  candidates: string[],
  depth = 0
): void => {
  if (
    depth > JSON_LD_MAX_TRAVERSAL_DEPTH ||
    hasReachedJsonLdCandidateLimit(candidates)
  ) {
    return;
  }

  if (Array.isArray(payload)) {
    collectNestedJsonLdCandidates(payload, candidates, depth);
    return;
  }

  if (!payload || typeof payload !== "object") {
    return;
  }

  const node = payload as Record<string, unknown>;
  const directTextCandidates = [
    node.description,
    node.headline,
    node.abstract,
    node.alternativeHeadline,
  ];

  for (const directTextCandidate of directTextCandidates) {
    appendJsonLdTextCandidate(directTextCandidate, candidates);
  }

  collectNestedJsonLdCandidates(Object.values(node), candidates, depth);
};

const getJsonLdDescriptionValues = (document: Document): string[] => {
  const candidates: string[] = [];
  const scriptElements = document.querySelectorAll("script[type]");

  for (const scriptElement of scriptElements) {
    const typeValue = getNonEmptyString(
      scriptElement.getAttribute("type")
    ).toLowerCase();
    if (!typeValue.includes(JSON_LD_TYPE_FRAGMENT)) {
      continue;
    }

    const scriptContent = getNonEmptyString(scriptElement.textContent);
    if (!scriptContent) {
      continue;
    }

    try {
      const payload = JSON.parse(scriptContent) as unknown;
      collectJsonLdTextCandidates(payload, candidates);
    } catch {
      // Ignore malformed JSON-LD blocks and keep parsing other scripts.
    }
  }

  return candidates;
};

const getTitleFromDocument = (document: Document): string => {
  const metadataTitle = getMetaContent(document, [
    'meta[property="og:title"]',
    'meta[name="twitter:title"]',
    'meta[property="twitter:title"]',
    'meta[itemprop="headline"]',
    'meta[name="title"]',
    'meta[name="dc.title"]',
  ]);

  if (metadataTitle) {
    return metadataTitle;
  }

  return (
    getNonEmptyString(document.querySelector("article h1")?.textContent) ||
    getNonEmptyString(document.querySelector("main h1")?.textContent) ||
    getNonEmptyString(document.querySelector("h1")?.textContent) ||
    getNonEmptyString(document.title)
  );
};

const getSiteNameFromDocument = (document: Document): string => {
  const rawSiteName = getMetaContent(document, [
    'meta[property="og:site_name"]',
    'meta[name="application-name"]',
    'meta[name="apple-mobile-web-app-title"]',
    'meta[name="twitter:site"]',
    'meta[property="twitter:site"]',
  ]);

  return rawSiteName.startsWith("@") ? rawSiteName.slice(1) : rawSiteName;
};

const getBodyDescriptionFromDocument = (document: Document): string => {
  const selectors = ["article p", "main p", "p"];
  let fallbackDescription = "";

  for (const selector of selectors) {
    const paragraphElements = document.querySelectorAll(selector);

    for (const paragraphElement of paragraphElements) {
      const normalizedText = getNonEmptyString(
        paragraphElement.textContent
      ).replace(/\s+/g, " ");
      if (!normalizedText) {
        continue;
      }

      if (!fallbackDescription) {
        fallbackDescription = normalizedText;
      }

      if (normalizedText.length >= PREVIEW_DESCRIPTION_MIN_PARAGRAPH_LENGTH) {
        return normalizedText;
      }
    }
  }

  return fallbackDescription;
};

const getDescriptionFromDocument = (document: Document): string => {
  const metadataDescription = getLongestTextValue(
    getMetaContentValues(document, [
      'meta[property="og:description"]',
      'meta[name="description"]',
      'meta[name="twitter:description"]',
      'meta[property="twitter:description"]',
      'meta[itemprop="description"]',
      'meta[name="dc.description"]',
      'meta[name="dcterms.description"]',
    ])
  );

  if (metadataDescription) {
    return clipText(metadataDescription, PREVIEW_DESCRIPTION_MAX_LENGTH);
  }

  const jsonLdDescription = getLongestTextValue(
    getJsonLdDescriptionValues(document)
  );
  if (jsonLdDescription) {
    return clipText(jsonLdDescription, PREVIEW_DESCRIPTION_MAX_LENGTH);
  }

  return clipText(
    getBodyDescriptionFromDocument(document),
    PREVIEW_DESCRIPTION_MAX_LENGTH
  );
};

const getFirstContentImageUrl = (
  document: Document,
  targetUrl: string
): string => {
  const imageElements = document.querySelectorAll(
    "article img[src], main img[src], img[src]"
  );

  for (const imageElement of imageElements) {
    const imageSource = getNonEmptyString(imageElement.getAttribute("src"));
    const resolvedImageUrl = resolvePreviewImageUrl(imageSource, targetUrl);
    if (!resolvedImageUrl) {
      continue;
    }

    const imageWidth = getNumericAttributeValue(imageElement, "width");
    const imageHeight = getNumericAttributeValue(imageElement, "height");
    if (
      imageWidth > 0 &&
      imageHeight > 0 &&
      imageWidth < PREVIEW_IMAGE_MIN_DIMENSION &&
      imageHeight < PREVIEW_IMAGE_MIN_DIMENSION
    ) {
      continue;
    }

    return resolvedImageUrl;
  }

  return "";
};

const resolveUrl = (candidate: string, originUrl: string): string => {
  if (!candidate) {
    return "";
  }

  try {
    return new URL(candidate, originUrl).toString();
  } catch {
    return "";
  }
};

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

const getBestLinkedIconUrl = (
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

const getManifestUrl = (document: Document, targetUrl: string): string => {
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

const fetchManifestIconUrl = async (
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

const getDefaultIconUrl = (targetUrl: string): string =>
  resolveUrl("/favicon.ico", targetUrl);

const getTweetTextFromEmbedHtml = (html: string): string => {
  if (!html) {
    return "";
  }

  const parser = new DOMParser();
  const document = parser.parseFromString(html, "text/html");
  const text = getNonEmptyString(document.querySelector("p")?.textContent);
  return clipText(text);
};

interface ParsedPreviewPayload {
  description: string;
  iconUrl: string;
  imageUrl: string;
  manifestUrl: string;
  platform: LinkPreviewPlatform;
  siteName: string;
  title: string;
}

const hasRichParsedPreviewMetadata = (
  parsedPreview: ParsedPreviewPayload,
  manifestIconUrl: string
): boolean => {
  return Boolean(
    parsedPreview.title ||
      parsedPreview.description ||
      parsedPreview.imageUrl ||
      parsedPreview.iconUrl ||
      manifestIconUrl
  );
};

interface IconCandidate {
  score: number;
  url: string;
}

interface ManifestIconEntry {
  purpose?: string;
  sizes?: string;
  src?: string;
  type?: string;
}

interface WebManifestPayload {
  icons?: ManifestIconEntry[];
}

const parseHtmlMetadata = (
  html: string,
  targetUrl: string
): ParsedPreviewPayload | null => {
  const parser = new DOMParser();
  const document = parser.parseFromString(html, "text/html");

  const title = getTitleFromDocument(document);

  const description = getDescriptionFromDocument(document);

  const platform = getPreviewPlatform(targetUrl);
  const siteName = getSiteNameFromDocument(document);

  let imageUrl = resolvePreviewImageUrl(
    getMetaContent(document, [
      'meta[property="og:image"]',
      'meta[property="og:image:url"]',
      'meta[property="og:image:secure_url"]',
      'meta[name="twitter:image"]',
      'meta[name="twitter:image:src"]',
      'meta[property="twitter:image"]',
    ]),
    targetUrl
  );

  if (!imageUrl) {
    const linkedImageSource = getNonEmptyString(
      document.querySelector('link[rel="image_src"]')?.getAttribute("href")
    );
    imageUrl = resolvePreviewImageUrl(linkedImageSource, targetUrl);
  }

  if (!imageUrl) {
    // Fallback to the first content image when OG metadata is missing.
    imageUrl = getFirstContentImageUrl(document, targetUrl);
  }

  if (platform === "youtube") {
    imageUrl = getYouTubeThumbnailUrl(targetUrl) || imageUrl;
  }

  const iconUrl = getBestLinkedIconUrl(document, targetUrl);
  const manifestUrl = getManifestUrl(document, targetUrl);

  const resolvedSiteName = siteName || getHostLabel(targetUrl);

  if (!(title || description || resolvedSiteName || imageUrl || iconUrl)) {
    return null;
  }

  return {
    title,
    description,
    iconUrl,
    imageUrl,
    manifestUrl,
    siteName: resolvedSiteName,
    platform,
  };
};

const isPreviewQuality = (value: unknown): value is LinkPreviewQuality =>
  value === "success" || value === "degraded";

const isPreviewSource = (value: unknown): value is LinkPreviewSource =>
  value === "generic-html" ||
  value === "github-api" ||
  value === "github-fallback" ||
  value === "platform-fallback" ||
  value === "x-fallback" ||
  value === "x-oembed" ||
  value === "youtube-oembed" ||
  value === "youtube-thumbnail";

const getDegradedRetryDelayMs = (failureCount: number): number => {
  const normalizedFailureCount = Math.max(1, Math.trunc(failureCount));
  const exponentialFactor = 2 ** (normalizedFailureCount - 1);
  return Math.min(
    PREVIEW_DEGRADED_RETRY_BASE_MS * exponentialFactor,
    PREVIEW_DEGRADED_RETRY_MAX_MS
  );
};

interface BuildCacheEntryOptions {
  description: string;
  imageDataUrl?: string;
  iconUrl: string;
  imageUrl: string;
  now: number;
  platform: LinkPreviewPlatform;
  previousEntry?: LinkPreviewCacheEntry | null;
  quality: LinkPreviewQuality;
  siteName: string;
  source: LinkPreviewSource;
  title: string;
}

const buildCacheEntry = ({
  description,
  imageDataUrl,
  iconUrl,
  imageUrl,
  now,
  platform,
  previousEntry,
  quality,
  siteName,
  source,
  title,
}: BuildCacheEntryOptions): LinkPreviewCacheEntry => {
  const normalizedImageUrl = getNonEmptyString(imageUrl);
  const normalizedImageDataUrl = getNonEmptyString(imageDataUrl);
  const previousFailureCount =
    previousEntry?.quality === "degraded" ? previousEntry.failureCount : 0;
  const nextFailureCount = quality === "success" ? 0 : previousFailureCount + 1;
  const nextRetryAt =
    quality === "success"
      ? now + PREVIEW_SUCCESS_TTL_MS
      : now + getDegradedRetryDelayMs(nextFailureCount);

  return {
    title: getNonEmptyString(title),
    description: getNonEmptyString(description),
    iconUrl: getNonEmptyString(iconUrl),
    imageUrl: normalizedImageUrl,
    imageDataUrl:
      normalizedImageDataUrl ||
      (previousEntry?.imageUrl === normalizedImageUrl
        ? getNonEmptyString(previousEntry.imageDataUrl)
        : ""),
    siteName: getNonEmptyString(siteName),
    platform,
    fetchedAt: now,
    quality,
    source,
    nextRetryAt,
    failureCount: nextFailureCount,
  };
};

const getPlatformFallbackTitle = (
  targetUrl: string,
  platform: LinkPreviewPlatform
): string => {
  if (platform === "x") {
    const statusDetails = getXStatusDetails(targetUrl);
    if (statusDetails) {
      return `@${statusDetails.username} on x`;
    }

    const handle = getXProfileHandle(targetUrl);
    return handle ? `@${handle} on x` : "x.com";
  }

  if (platform === "github") {
    const details = parseGitHubResource(targetUrl);
    if (!details) {
      return "github";
    }

    if (details.kind === "user") {
      return `@${details.owner} on github`;
    }

    if (details.kind === "repo" && details.repo) {
      return `${details.owner}/${details.repo}`;
    }

    if (details.kind === "issue" && details.repo && details.number) {
      return `${details.owner}/${details.repo} #${details.number}`;
    }

    if (details.kind === "pull" && details.repo && details.number) {
      return `${details.owner}/${details.repo} PR #${details.number}`;
    }

    return "github";
  }

  if (platform === "youtube") {
    return "youtube";
  }

  return "";
};

const getPlatformFallbackDescription = (
  targetUrl: string,
  platform: LinkPreviewPlatform
): string => {
  if (platform === "x") {
    const statusDetails = getXStatusDetails(targetUrl);
    if (statusDetails) {
      return `tweet by @${statusDetails.username}`;
    }
  }

  if (platform === "github") {
    const details = parseGitHubResource(targetUrl);
    if (details?.kind === "issue") {
      return "github issue preview";
    }

    if (details?.kind === "pull") {
      return "github pull request preview";
    }
  }

  return "";
};

const buildDegradedEntry = (
  targetUrl: string,
  platform: LinkPreviewPlatform,
  now: number,
  previousEntry?: LinkPreviewCacheEntry | null,
  source: LinkPreviewSource = "platform-fallback"
): LinkPreviewCacheEntry => {
  const fallbackSiteName = getHostLabel(targetUrl);
  const fallbackImageUrl =
    platform === "youtube" ? getYouTubeThumbnailUrl(targetUrl) : "";

  return buildCacheEntry({
    description: getPlatformFallbackDescription(targetUrl, platform),
    iconUrl: getDefaultIconUrl(targetUrl),
    imageUrl: fallbackImageUrl,
    now,
    platform,
    previousEntry,
    quality: "degraded",
    siteName: fallbackSiteName,
    source,
    title: getPlatformFallbackTitle(targetUrl, platform),
  });
};

const getPlatformFallbackSource = (
  platform: LinkPreviewPlatform
): LinkPreviewSource => {
  if (platform === "x") {
    return "x-fallback";
  }

  if (platform === "github") {
    return "github-fallback";
  }

  return "platform-fallback";
};

const isLikelyHtmlContentType = (contentType: string): boolean => {
  const normalizedType = contentType.toLowerCase();
  return (
    normalizedType.includes("text/html") ||
    normalizedType.includes("application/xhtml+xml")
  );
};

interface YouTubeOEmbedResponse {
  author_name?: string;
  thumbnail_url?: string;
  title?: string;
}

const fetchYouTubePreview = async (
  targetUrl: string,
  signal: AbortSignal,
  now: number,
  previousEntry?: LinkPreviewCacheEntry | null
): Promise<LinkPreviewCacheEntry | null> => {
  const videoId = getYouTubeVideoId(targetUrl);
  if (!videoId) {
    return null;
  }

  const oEmbedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(getCanonicalYouTubeWatchUrl(videoId))}&format=json`;

  try {
    const response = await fetch(oEmbedUrl, {
      credentials: "omit",
      signal,
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as YouTubeOEmbedResponse;
    const title = getNonEmptyString(payload.title);
    const description = getNonEmptyString(payload.author_name)
      ? `by ${getNonEmptyString(payload.author_name)}`
      : "";
    const imageUrl =
      resolveUrl(getNonEmptyString(payload.thumbnail_url), targetUrl) ||
      getYouTubeThumbnailUrlById(videoId);

    return buildCacheEntry({
      description,
      iconUrl: getDefaultIconUrl(targetUrl),
      imageUrl,
      now,
      platform: "youtube",
      previousEntry,
      quality: "success",
      siteName: "youtube",
      source: "youtube-oembed",
      title,
    });
  } catch {
    return null;
  }
};

interface XOEmbedResponse {
  author_name?: string;
  html?: string;
}

const fetchXPreview = async (
  targetUrl: string,
  signal: AbortSignal,
  now: number,
  previousEntry?: LinkPreviewCacheEntry | null
): Promise<LinkPreviewCacheEntry | null> => {
  const statusDetails = getXStatusDetails(targetUrl);
  if (!statusDetails) {
    return null;
  }

  const canonicalStatusUrl = `https://twitter.com/${statusDetails.username}/status/${statusDetails.statusId}`;
  const oEmbedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(canonicalStatusUrl)}&omit_script=true`;

  try {
    const response = await fetch(oEmbedUrl, {
      credentials: "omit",
      signal,
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as XOEmbedResponse;
    const authorName = getNonEmptyString(payload.author_name);
    const description = getTweetTextFromEmbedHtml(
      getNonEmptyString(payload.html)
    );

    return buildCacheEntry({
      description,
      iconUrl: getDefaultIconUrl(targetUrl),
      imageUrl: "",
      now,
      platform: "x",
      previousEntry,
      quality: description ? "success" : "degraded",
      siteName: "x.com",
      source: "x-oembed",
      title: authorName
        ? `@${authorName} on x`
        : `@${statusDetails.username} on x`,
    });
  } catch {
    return null;
  }
};

interface GitHubOwner {
  avatar_url?: string;
  login?: string;
}

interface GitHubRepoResponse {
  description?: string | null;
  full_name?: string;
  language?: string | null;
  owner?: GitHubOwner;
  stargazers_count?: number;
}

interface GitHubIssueLikeResponse {
  body?: string | null;
  number?: number;
  state?: string;
  title?: string;
  user?: GitHubOwner;
}

interface GitHubUserResponse {
  avatar_url?: string;
  bio?: string | null;
  login?: string;
  name?: string | null;
  public_repos?: number;
}

const fetchGitHubJson = async <T>(
  endpoint: string,
  signal: AbortSignal
): Promise<T | null> => {
  try {
    const response = await fetch(endpoint, {
      credentials: "omit",
      headers: {
        Accept: "application/vnd.github+json",
      },
      signal,
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
};

const fetchGitHubRepoPreview = async (
  details: GitHubResourceDetails,
  signal: AbortSignal,
  now: number,
  previousEntry?: LinkPreviewCacheEntry | null
): Promise<LinkPreviewCacheEntry | null> => {
  if (!(details.kind === "repo" && details.repo)) {
    return null;
  }

  const repoPayload = await fetchGitHubJson<GitHubRepoResponse>(
    `https://api.github.com/repos/${details.owner}/${details.repo}`,
    signal
  );

  if (!repoPayload) {
    return null;
  }

  const stars =
    typeof repoPayload.stargazers_count === "number"
      ? `${repoPayload.stargazers_count.toLocaleString()} stars`
      : "";
  const language = getNonEmptyString(repoPayload.language || "");
  const fallbackDescription = [stars, language].filter(Boolean).join(" • ");

  return buildCacheEntry({
    description:
      getNonEmptyString(repoPayload.description || "") || fallbackDescription,
    iconUrl: getDefaultIconUrl("https://github.com"),
    imageUrl: getNonEmptyString(repoPayload.owner?.avatar_url),
    now,
    platform: "github",
    previousEntry,
    quality: "success",
    siteName: "github",
    source: "github-api",
    title:
      getNonEmptyString(repoPayload.full_name) ||
      `${details.owner}/${details.repo}`,
  });
};

const fetchGitHubIssuePreview = async (
  details: GitHubResourceDetails,
  signal: AbortSignal,
  now: number,
  previousEntry?: LinkPreviewCacheEntry | null
): Promise<LinkPreviewCacheEntry | null> => {
  if (!(details.kind === "issue" && details.repo && details.number)) {
    return null;
  }

  const issuePayload = await fetchGitHubJson<GitHubIssueLikeResponse>(
    `https://api.github.com/repos/${details.owner}/${details.repo}/issues/${details.number}`,
    signal
  );

  if (!issuePayload) {
    return null;
  }

  const stateLabel = getNonEmptyString(issuePayload.state);
  const fallbackDescription = stateLabel
    ? `${stateLabel} issue`
    : "github issue";

  return buildCacheEntry({
    description:
      clipText(getNonEmptyString(issuePayload.body || "")) ||
      fallbackDescription,
    iconUrl: getDefaultIconUrl("https://github.com"),
    imageUrl: getNonEmptyString(issuePayload.user?.avatar_url),
    now,
    platform: "github",
    previousEntry,
    quality: "success",
    siteName: `${details.owner}/${details.repo}`,
    source: "github-api",
    title:
      getNonEmptyString(issuePayload.title) && issuePayload.number
        ? `#${issuePayload.number} ${getNonEmptyString(issuePayload.title)}`
        : `${details.owner}/${details.repo} issue #${details.number}`,
  });
};

const fetchGitHubPullPreview = async (
  details: GitHubResourceDetails,
  signal: AbortSignal,
  now: number,
  previousEntry?: LinkPreviewCacheEntry | null
): Promise<LinkPreviewCacheEntry | null> => {
  if (!(details.kind === "pull" && details.repo && details.number)) {
    return null;
  }

  const pullPayload = await fetchGitHubJson<GitHubIssueLikeResponse>(
    `https://api.github.com/repos/${details.owner}/${details.repo}/pulls/${details.number}`,
    signal
  );

  if (!pullPayload) {
    return null;
  }

  const stateLabel = getNonEmptyString(pullPayload.state);
  const fallbackDescription = stateLabel
    ? `${stateLabel} pull request`
    : "github pull request";

  return buildCacheEntry({
    description:
      clipText(getNonEmptyString(pullPayload.body || "")) ||
      fallbackDescription,
    iconUrl: getDefaultIconUrl("https://github.com"),
    imageUrl: getNonEmptyString(pullPayload.user?.avatar_url),
    now,
    platform: "github",
    previousEntry,
    quality: "success",
    siteName: `${details.owner}/${details.repo}`,
    source: "github-api",
    title:
      getNonEmptyString(pullPayload.title) && pullPayload.number
        ? `PR #${pullPayload.number} ${getNonEmptyString(pullPayload.title)}`
        : `${details.owner}/${details.repo} PR #${details.number}`,
  });
};

const fetchGitHubUserPreview = async (
  details: GitHubResourceDetails,
  signal: AbortSignal,
  now: number,
  previousEntry?: LinkPreviewCacheEntry | null
): Promise<LinkPreviewCacheEntry | null> => {
  if (details.kind !== "user") {
    return null;
  }

  const userPayload = await fetchGitHubJson<GitHubUserResponse>(
    `https://api.github.com/users/${details.owner}`,
    signal
  );

  if (!userPayload) {
    return null;
  }

  const repoCount =
    typeof userPayload.public_repos === "number"
      ? `${userPayload.public_repos.toLocaleString()} repos`
      : "";

  return buildCacheEntry({
    description:
      clipText(getNonEmptyString(userPayload.bio || "")) || repoCount,
    iconUrl: getDefaultIconUrl("https://github.com"),
    imageUrl: getNonEmptyString(userPayload.avatar_url),
    now,
    platform: "github",
    previousEntry,
    quality: "success",
    siteName: "github",
    source: "github-api",
    title:
      getNonEmptyString(userPayload.name || "") ||
      `@${getNonEmptyString(userPayload.login) || details.owner} on github`,
  });
};

const fetchGitHubPreview = (
  targetUrl: string,
  signal: AbortSignal,
  now: number,
  previousEntry?: LinkPreviewCacheEntry | null
): Promise<LinkPreviewCacheEntry | null> => {
  const details = parseGitHubResource(targetUrl);
  if (!details) {
    return Promise.resolve(null);
  }

  if (details.kind === "repo") {
    return fetchGitHubRepoPreview(details, signal, now, previousEntry);
  }

  if (details.kind === "issue") {
    return fetchGitHubIssuePreview(details, signal, now, previousEntry);
  }

  if (details.kind === "pull") {
    return fetchGitHubPullPreview(details, signal, now, previousEntry);
  }

  return fetchGitHubUserPreview(details, signal, now, previousEntry);
};

const isPreviewPlatform = (value: unknown): value is LinkPreviewPlatform =>
  value === "youtube" ||
  value === "x" ||
  value === "github" ||
  value === "generic";

const normalizeCacheEntry = (value: unknown): LinkPreviewCacheEntry | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<LinkPreviewCacheEntry>;
  if (
    typeof candidate.title !== "string" ||
    typeof candidate.description !== "string" ||
    typeof candidate.imageUrl !== "string" ||
    typeof candidate.siteName !== "string" ||
    typeof candidate.fetchedAt !== "number"
  ) {
    return null;
  }

  const iconUrl =
    typeof candidate.iconUrl === "string" ? candidate.iconUrl : "";
  const imageDataUrl =
    typeof candidate.imageDataUrl === "string" ? candidate.imageDataUrl : "";

  const inferredQuality: LinkPreviewQuality =
    candidate.title.trim() ||
    candidate.description.trim() ||
    candidate.imageUrl.trim() ||
    imageDataUrl.trim() ||
    iconUrl.trim()
      ? "success"
      : "degraded";
  const quality = isPreviewQuality(candidate.quality)
    ? candidate.quality
    : inferredQuality;
  let failureCount = 0;
  if (
    typeof candidate.failureCount === "number" &&
    candidate.failureCount >= 0
  ) {
    failureCount = candidate.failureCount;
  } else if (quality === "degraded") {
    failureCount = 1;
  }

  let nextRetryAt = candidate.fetchedAt + PREVIEW_SUCCESS_TTL_MS;
  if (typeof candidate.nextRetryAt === "number") {
    nextRetryAt = candidate.nextRetryAt;
  } else if (quality === "degraded") {
    nextRetryAt = candidate.fetchedAt + getDegradedRetryDelayMs(failureCount);
  }

  let source: LinkPreviewSource = "platform-fallback";
  if (isPreviewSource(candidate.source)) {
    source = candidate.source;
  } else if (quality === "success") {
    source = "generic-html";
  }

  return {
    title: candidate.title,
    description: candidate.description,
    iconUrl,
    imageUrl: candidate.imageUrl,
    imageDataUrl,
    siteName: candidate.siteName,
    platform: isPreviewPlatform(candidate.platform)
      ? candidate.platform
      : "generic",
    fetchedAt: candidate.fetchedAt,
    quality,
    source,
    nextRetryAt,
    failureCount,
  };
};

export const shouldRefetchPreview = (
  entry: LinkPreviewCacheEntry | null | undefined,
  now = Date.now()
): boolean => {
  const normalizedEntry = normalizeCacheEntry(entry);
  if (!normalizedEntry) {
    return true;
  }

  if (normalizedEntry.quality === "success") {
    return now - normalizedEntry.fetchedAt >= PREVIEW_SUCCESS_TTL_MS;
  }

  return now >= normalizedEntry.nextRetryAt;
};

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
  try {
    const response = await fetch(imageUrl, {
      credentials: "omit",
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

    const imageBlob = await response.blob();
    if (imageBlob.size === 0) {
      return null;
    }

    return imageBlob;
  } catch {
    return null;
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

export async function fetchLinkPreviewMetadata(
  targetUrl: string,
  previousEntry?: LinkPreviewCacheEntry | null
): Promise<LinkPreviewCacheEntry> {
  const normalizedPreviousEntry = normalizeCacheEntry(previousEntry);
  const now = Date.now();
  const platform = getPreviewPlatform(targetUrl);
  const youtubeVideoId =
    platform === "youtube" ? getYouTubeVideoId(targetUrl) : "";
  const degradedFallbackSource: LinkPreviewSource = youtubeVideoId
    ? "youtube-thumbnail"
    : getPlatformFallbackSource(platform);

  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    PREVIEW_FETCH_TIMEOUT_MS
  );

  try {
    if (platform === "youtube" && youtubeVideoId) {
      const youtubePreview = await fetchYouTubePreview(
        targetUrl,
        controller.signal,
        now,
        normalizedPreviousEntry
      );

      if (youtubePreview) {
        return youtubePreview;
      }
    }

    if (platform === "x") {
      const xPreview = await fetchXPreview(
        targetUrl,
        controller.signal,
        now,
        normalizedPreviousEntry
      );

      if (xPreview) {
        return xPreview;
      }

      return buildDegradedEntry(
        targetUrl,
        platform,
        now,
        normalizedPreviousEntry,
        "x-fallback"
      );
    }

    if (platform === "github") {
      const githubPreview = await fetchGitHubPreview(
        targetUrl,
        controller.signal,
        now,
        normalizedPreviousEntry
      );

      if (githubPreview) {
        return githubPreview;
      }
    }

    const response = await fetch(targetUrl, {
      credentials: "omit",
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return buildDegradedEntry(
        targetUrl,
        platform,
        now,
        normalizedPreviousEntry,
        degradedFallbackSource
      );
    }

    const contentType = getNonEmptyString(response.headers.get("content-type"));
    if (contentType && !isLikelyHtmlContentType(contentType)) {
      return buildDegradedEntry(
        targetUrl,
        platform,
        now,
        normalizedPreviousEntry,
        degradedFallbackSource
      );
    }

    const html = await response.text();
    const parsedPreview = parseHtmlMetadata(html, targetUrl);
    if (!parsedPreview) {
      return buildDegradedEntry(
        targetUrl,
        platform,
        now,
        normalizedPreviousEntry,
        degradedFallbackSource
      );
    }

    const manifestIconUrl = await fetchManifestIconUrl(
      parsedPreview.manifestUrl,
      controller.signal
    );
    const resolvedIconUrl =
      manifestIconUrl ||
      parsedPreview.iconUrl ||
      getDefaultIconUrl(targetUrl) ||
      "";

    const hasRichMetadata = hasRichParsedPreviewMetadata(
      parsedPreview,
      manifestIconUrl
    );

    return buildCacheEntry({
      description: parsedPreview.description,
      iconUrl: resolvedIconUrl,
      imageUrl: parsedPreview.imageUrl,
      now,
      platform: parsedPreview.platform,
      previousEntry: normalizedPreviousEntry,
      quality: hasRichMetadata ? "success" : "degraded",
      siteName: parsedPreview.siteName,
      source: "generic-html",
      title: parsedPreview.title,
    });
  } catch {
    return buildDegradedEntry(
      targetUrl,
      platform,
      now,
      normalizedPreviousEntry,
      degradedFallbackSource
    );
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function pruneLinkPreviewCache(
  cache: Record<string, LinkPreviewCacheEntry>
): Record<string, LinkPreviewCacheEntry> {
  const now = Date.now();

  const entries = Object.entries(cache).flatMap(([key, value]) => {
    const normalizedEntry = normalizeCacheEntry(value);
    if (!normalizedEntry) {
      return [];
    }

    const maxAgeMs =
      normalizedEntry.quality === "success"
        ? PREVIEW_SUCCESS_TTL_MS
        : PREVIEW_DEGRADED_RETENTION_MS;

    if (now - normalizedEntry.fetchedAt > maxAgeMs) {
      return [];
    }

    return [[key, normalizedEntry] as const];
  });

  if (
    entries.length === Object.keys(cache).length &&
    entries.length <= PREVIEW_CACHE_MAX_ITEMS
  ) {
    return cache;
  }

  entries.sort((a, b) => b[1].fetchedAt - a[1].fetchedAt);
  const trimmedEntries = entries.slice(0, PREVIEW_CACHE_MAX_ITEMS);

  return Object.fromEntries(trimmedEntries);
}
