const HTTPS_REGEX = /^https?:\/\//i;
const WWW_REGEX = /^www\./;

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

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
