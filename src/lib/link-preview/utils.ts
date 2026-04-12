export const getNonEmptyString = (value: string | null | undefined): string =>
  value?.trim() || "";

export const clipText = (value: string, maxLength = 240): string => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1)}…`;
};

export const resolveUrl = (candidate: string, originUrl: string): string => {
  if (!candidate) {
    return "";
  }

  try {
    return new URL(candidate, originUrl).toString();
  } catch {
    return "";
  }
};
