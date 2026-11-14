import enMessages from "@/locales/en.json";

export type MessageKey = keyof typeof enMessages | (string & {});

export type Substitutions =
  | Record<string, string | number>
  | Array<string | number>;

interface ChromeI18nAPI {
  getMessage(messageName: string, substitutions?: string | string[]): string;
}

declare const chrome: {
  i18n?: ChromeI18nAPI;
};

function applySubstitutions(
  template: string,
  substitutions?: Substitutions
): string {
  if (!substitutions) {
    return template;
  }

  if (Array.isArray(substitutions)) {
    return template.replace(/\$(\d+)/g, (match, indexStr) => {
      const index = Number.parseInt(indexStr, 10) - 1;
      return index >= 0 && index < substitutions.length
        ? String(substitutions[index])
        : match;
    });
  }

  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return Object.hasOwn(substitutions, key)
      ? String(substitutions[key])
      : match;
  });
}

export function t(
  key: MessageKey,
  substitutions?: Substitutions,
  fallback?: string
): string {
  if (typeof chrome !== "undefined" && chrome.i18n?.getMessage) {
    const rawArgs = Array.isArray(substitutions)
      ? substitutions.map(String)
      : typeof substitutions === "object" && substitutions !== null
        ? Object.values(substitutions).map(String)
        : undefined;

    const message = chrome.i18n.getMessage(String(key), rawArgs);
    if (message) {
      return message;
    }
  }

  const defaultItem = (
    enMessages as Record<string, { message?: string } | undefined>
  )[String(key)];

  if (defaultItem?.message) {
    return applySubstitutions(defaultItem.message, substitutions);
  }

  if (fallback !== undefined) {
    return applySubstitutions(fallback, substitutions);
  }

  return String(key);
}

export const i18n = {
  t,
};
