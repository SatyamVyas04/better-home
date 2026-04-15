export const PREVIEW_FETCH_TIMEOUT_MS = 5000;
export const PREVIEW_SUCCESS_TTL_MS = 24 * 60 * 60 * 1000;
export const PREVIEW_DEGRADED_RETRY_BASE_MS = 2 * 60 * 1000;
export const PREVIEW_DEGRADED_RETRY_MAX_MS = 60 * 60 * 1000;
export const PREVIEW_DEGRADED_RETENTION_MS = 2 * 24 * 60 * 60 * 1000;
export const PREVIEW_CACHE_MAX_ITEMS = 150;

export const WWW_PREFIX_REGEX = /^www\./i;
export const YOUTUBE_HOST_REGEX =
  /(^|\.)youtube\.com$|(^|\.)youtube-nocookie\.com$|(^|\.)youtu\.be$/i;
export const X_HOST_REGEX = /(^|\.)x\.com$|(^|\.)twitter\.com$/i;
export const GITHUB_HOST_REGEX = /(^|\.)github\.com$/i;
export const YOUTUBE_VIDEO_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;
export const URL_FRAGMENT_SPLIT_REGEX = /[?&#/]/;
export const X_STATUS_PATH_REGEX = /^\/([^/]+)\/status\/(\d+)/i;
export const GITHUB_NUMBER_REGEX = /^\d+$/;
export const GIT_SUFFIX_REGEX = /\.git$/i;
export const X_PREVIEW_FALLBACK_IMAGE_URL =
  "https://abs.twimg.com/rweb/ssr/default/v2/og/image.png";

export const ICON_SIZE_REGEX = /^(\d+)x(\d+)$/i;
export const WHITESPACE_REGEX = /\s+/;
export const JSON_LD_TYPE_FRAGMENT = "ld+json";
export const PREVIEW_DESCRIPTION_MAX_LENGTH = 360;
export const PREVIEW_DESCRIPTION_MIN_PARAGRAPH_LENGTH = 48;
export const JSON_LD_MAX_TRAVERSAL_DEPTH = 5;
export const JSON_LD_MAX_CANDIDATES = 14;
export const PREVIEW_IMAGE_MIN_DIMENSION = 64;
export const DISALLOWED_PREVIEW_IMAGE_TOKEN_REGEX =
  /(?:^|[./_-])(favicon|apple-touch-icon|mask-icon|sprite|avatar|profile)(?:$|[./_-])/i;

export const PREVIEW_IMAGE_DATA_URL_MAX_LENGTH = 90_000;
export const PREVIEW_IMAGE_DATA_URL_PRIMARY_MAX_WIDTH = 560;
export const PREVIEW_IMAGE_DATA_URL_SECONDARY_MAX_WIDTH = 420;
export const PREVIEW_IMAGE_DATA_URL_PRIMARY_QUALITY = 0.76;
export const PREVIEW_IMAGE_DATA_URL_SECONDARY_QUALITY = 0.62;
export const PREVIEW_IMAGE_SOURCE_MAX_BYTES = 2.5 * 1024 * 1024;
export const PREVIEW_IMAGE_DATA_URL_RUNTIME_MAX_ITEMS = 120;
