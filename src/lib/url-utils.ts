const HTTPS_REGEX = /^https?:\/\//i;
const WWW_REGEX = /^www\./;
const INVALID_DOMAIN_REGEX =
  /^(localhost|0\.0\.0\.0|127\.0\.0\.1|\[::1\]|\[::\]|$)/i;
const IP_ADDRESS_REGEX =
  /^(?:\d{1,3}\.){3}\d{1,3}$|^::(?:[a-fA-F0-9]{0,4}:){0,7}[a-fA-F0-9]{0,4}$/;
const PROHIBITED_PROTOCOLS = new Set([
  "file:",
  "javascript:",
  "data:",
  "mailto:",
  "tel:",
  "ssh:",
]);

export function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) {
    return "";
  }

  if (!HTTPS_REGEX.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return trimmed;
}

export function isValidUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);

    if (PROHIBITED_PROTOCOLS.has(urlObj.protocol)) {
      return false;
    }

    if (INVALID_DOMAIN_REGEX.test(urlObj.hostname)) {
      return false;
    }

    if (IP_ADDRESS_REGEX.test(urlObj.hostname)) {
      return false;
    }

    return urlObj.hostname.includes(".") || urlObj.hostname.length > 0;
  } catch {
    return false;
  }
}

export function extractTitle(url: string): string {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace(WWW_REGEX, "");
    return hostname.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

export function getFaviconUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=64`;
  } catch {
    return "";
  }
}

export function getDisplayUrl(url: string, maxLength = 40): string {
  try {
    const urlObj = new URL(url);
    const display =
      urlObj.hostname.replace(WWW_REGEX, "") +
      (urlObj.pathname !== "/" ? urlObj.pathname : "");
    if (display.length <= maxLength) {
      return display;
    }
    return `${display.slice(0, maxLength - 1)}…`;
  } catch {
    return url.length > maxLength ? `${url.slice(0, maxLength - 1)}…` : url;
  }
}
