import {
  DISALLOWED_PREVIEW_IMAGE_TOKEN_REGEX,
  JSON_LD_MAX_CANDIDATES,
  JSON_LD_MAX_TRAVERSAL_DEPTH,
  JSON_LD_TYPE_FRAGMENT,
  PREVIEW_DESCRIPTION_MAX_LENGTH,
  PREVIEW_DESCRIPTION_MIN_PARAGRAPH_LENGTH,
  PREVIEW_IMAGE_MIN_DIMENSION,
} from "./constants";
import { getBestLinkedIconUrl, getManifestUrl } from "./icon-metadata";
import {
  getHostLabel,
  getPreviewPlatform,
  getYouTubeThumbnailUrl,
} from "./platform";
import type { LinkPreviewPlatform } from "./types";
import { clipText, getNonEmptyString, resolveUrl } from "./utils";

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

export interface ParsedPreviewPayload {
  description: string;
  iconUrl: string;
  imageUrl: string;
  manifestUrl: string;
  platform: LinkPreviewPlatform;
  siteName: string;
  title: string;
}

export const hasRichParsedPreviewMetadata = (
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

export const parseHtmlMetadata = (
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
