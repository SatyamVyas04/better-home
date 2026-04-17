import { IconBlockquote } from "@tabler/icons-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  type CSSProperties,
  createContext,
  type ClipboardEvent as ReactClipboardEvent,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { QUOTE_POOLS } from "@/constants/quotes";
import type {
  DefaultQuoteRecord,
  QuoteEntry,
  QuoteSourceRecord,
  ResolvedQuoteEntry,
} from "@/types/quotes";

const SESSION_QUOTE_STORAGE_KEY = "better-home-footer-session-quote";
const LAST_QUOTE_STORAGE_KEY = "better-home-footer-last-quote";
const QUOTE_HISTORY_STORAGE_KEY = "better-home-footer-quote-history";
const QUOTE_NEAR_SIXTY_MAX_CHARACTERS = 70;
const QUOTE_MEDIUM_MAX_CHARACTERS = 120;
const QUOTE_NEAR_SIXTY_ROTATION_INTERVAL_MS = 6000;
const QUOTE_MEDIUM_ROTATION_INTERVAL_MS = 8000;
const QUOTE_LONG_ROTATION_INTERVAL_MS = 10_000;
const QUOTE_CLAMP_COPY_MIN_CHARACTERS = 60;
const TOKEN_SPLIT_REGEX = /(\s+)/;
const WORD_TOKEN_REGEX = /[A-Za-z0-9']+/g;
const WHITESPACE_TOKEN_REGEX = /^\s+$/;
const STRONG_EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];
const TODO_HIGHLIGHT_COLOR_VARS = [
  "--todo-group-pink",
  "--todo-group-cyan",
  "--todo-group-blue",
  "--todo-group-purple",
  "--todo-group-green",
  "--todo-group-orange",
] as const;

const POSITIVE_WORDS = new Set([
  "accept",
  "accomplish",
  "achievement",
  "achieve",
  "action",
  "adapt",
  "align",
  "appreciate",
  "aspire",
  "authentic",
  "balance",
  "become",
  "believe",
  "benefit",
  "better",
  "blessing",
  "bold",
  "brave",
  "bright",
  "build",
  "calm",
  "care",
  "celebrate",
  "centered",
  "change",
  "clarity",
  "compassion",
  "confident",
  "confidence",
  "conquer",
  "consistency",
  "courage",
  "create",
  "dedication",
  "delight",
  "devotion",
  "discipline",
  "discover",
  "dream",
  "drive",
  "effort",
  "elevate",
  "embrace",
  "empathy",
  "empower",
  "encourage",
  "endurance",
  "energy",
  "enjoy",
  "excel",
  "faith",
  "flourish",
  "flow",
  "focus",
  "forgive",
  "freedom",
  "friendship",
  "future",
  "gentle",
  "give",
  "glory",
  "good",
  "goodness",
  "grace",
  "gratitude",
  "grounded",
  "grow",
  "growth",
  "guidance",
  "happiness",
  "harmony",
  "heal",
  "heart",
  "help",
  "hope",
  "honor",
  "humble",
  "imagine",
  "important",
  "improve",
  "inspire",
  "integrity",
  "intent",
  "joy",
  "kind",
  "kindness",
  "learn",
  "light",
  "love",
  "live",
  "mastery",
  "meaning",
  "meditate",
  "meditation",
  "mindful",
  "motivate",
  "optimism",
  "opportunity",
  "patience",
  "peace",
  "perfect",
  "persist",
  "possibility",
  "power",
  "practice",
  "presence",
  "progress",
  "purpose",
  "reflect",
  "refresh",
  "renew",
  "resilient",
  "resolve",
  "respect",
  "rise",
  "service",
  "shine",
  "simplicity",
  "smile",
  "spark",
  "stability",
  "steady",
  "strength",
  "success",
  "support",
  "thrive",
  "transform",
  "triumph",
  "truth",
  "uplift",
  "victory",
  "vitality",
  "wellbeing",
  "wisdom",
  "wonder",
  "worthy",
  "work",
]);

interface QuotesContextValue {
  activeQuote: ResolvedQuoteEntry;
}

const QuotesContext = createContext<QuotesContextValue | null>(null);

function trimQuoteText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function normalizeHighlightToken(word: string): string {
  return word.toLowerCase().replace(/(^[^a-z0-9]+)|([^a-z0-9]+$)/g, "");
}

function normalizeHighlightKeywords(
  highlightKeywords: unknown
): string[] | undefined {
  if (!Array.isArray(highlightKeywords)) {
    return undefined;
  }

  const normalizedKeywordSet = new Set<string>();
  for (const highlightKeyword of highlightKeywords) {
    if (typeof highlightKeyword !== "string") {
      continue;
    }

    const normalizedKeyword = normalizeHighlightToken(highlightKeyword);
    if (!normalizedKeyword) {
      continue;
    }

    normalizedKeywordSet.add(normalizedKeyword);
  }

  return normalizedKeywordSet.size > 0
    ? Array.from(normalizedKeywordSet)
    : undefined;
}

function buildCuratedHighlightKeywordSet(
  highlightKeywords?: string[]
): Set<string> | null {
  if (!highlightKeywords?.length) {
    return null;
  }

  const normalizedKeywordSet = new Set<string>();
  for (const highlightKeyword of highlightKeywords) {
    const normalizedKeyword = normalizeHighlightToken(highlightKeyword);
    if (!normalizedKeyword) {
      continue;
    }

    normalizedKeywordSet.add(normalizedKeyword);
  }

  return normalizedKeywordSet.size > 0 ? normalizedKeywordSet : null;
}

function isDefaultQuoteRecord(
  quoteRecord: QuoteSourceRecord
): quoteRecord is DefaultQuoteRecord {
  return (
    typeof (quoteRecord as DefaultQuoteRecord).quote === "string" &&
    typeof (quoteRecord as DefaultQuoteRecord).author === "string"
  );
}

function normalizeQuoteRecord(
  quoteRecord: QuoteSourceRecord,
  quoteIndex: number
): ResolvedQuoteEntry | null {
  const text = isDefaultQuoteRecord(quoteRecord)
    ? quoteRecord.quote
    : (quoteRecord as QuoteEntry).text;
  const attribution = isDefaultQuoteRecord(quoteRecord)
    ? quoteRecord.author
    : (quoteRecord as QuoteEntry).attribution;
  const normalizedHighlightKeywords = normalizeHighlightKeywords(
    (quoteRecord as QuoteEntry).highlightKeywords
  );

  const normalizedText = trimQuoteText(text ?? "");
  const normalizedAttribution = (attribution ?? "").trim() || "unknown";
  if (!normalizedText) {
    return null;
  }

  return {
    attribution: normalizedAttribution,
    highlightKeywords: normalizedHighlightKeywords,
    key: `authors:${quoteIndex}:${normalizedText}`,
    source: "authors",
    text: normalizedText,
  };
}

function resolveQuotePool(): ResolvedQuoteEntry[] {
  const normalizedQuotePool: ResolvedQuoteEntry[] = [];

  for (const [quoteIndex, sourceRecord] of QUOTE_POOLS.authors.entries()) {
    const normalizedRecord = normalizeQuoteRecord(sourceRecord, quoteIndex);
    if (normalizedRecord) {
      normalizedQuotePool.push(normalizedRecord);
    }
  }

  return normalizedQuotePool;
}

function readRecentQuoteKeys(): string[] {
  const rawValue = window.localStorage.getItem(QUOTE_HISTORY_STORAGE_KEY);
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((historyItem): historyItem is string => {
      return typeof historyItem === "string" && historyItem.length > 0;
    });
  } catch {
    return [];
  }
}

function writeRecentQuoteKeys(recentQuoteKeys: string[]): void {
  window.localStorage.setItem(
    QUOTE_HISTORY_STORAGE_KEY,
    JSON.stringify(recentQuoteKeys)
  );
}

function appendRecentQuoteKey(quoteKey: string, historyLimit: number): void {
  const maxHistorySize = Math.max(1, historyLimit);
  const currentHistory = readRecentQuoteKeys();
  const updatedHistory = [
    quoteKey,
    ...currentHistory.filter((historyKey) => historyKey !== quoteKey),
  ].slice(0, maxHistorySize);

  writeRecentQuoteKeys(updatedHistory);
}

function pickQuote(
  quotePool: ResolvedQuoteEntry[],
  recentQuoteKeys: string[],
  previousQuoteKey?: string
): ResolvedQuoteEntry {
  const normalizedPool = quotePool;

  if (normalizedPool.length === 0) {
    return {
      key: "fallback:empty-pool",
      source: "authors",
      text: "add quotes to start the rotation.",
      attribution: "better-home",
    };
  }

  const recentQuoteKeySet = new Set(recentQuoteKeys);
  const recentQuoteIndexByKey = new Map<string, number>();

  for (const [historyIndex, historyKey] of recentQuoteKeys.entries()) {
    recentQuoteIndexByKey.set(historyKey, historyIndex);
  }

  let randomPool = normalizedPool.filter((quote) => {
    return !recentQuoteKeySet.has(quote.key);
  });

  if (previousQuoteKey) {
    randomPool = randomPool.filter((quote) => quote.key !== previousQuoteKey);
  }

  if (randomPool.length === 0 && previousQuoteKey) {
    const candidatePool = normalizedPool.filter(
      (quote) => quote.key !== previousQuoteKey
    );

    // When every quote has been seen recently, pick the least recently seen quote.
    let leastRecentlySeenQuote = candidatePool[0] ?? normalizedPool[0];
    let maxRecencyIndex = -1;

    for (const candidateQuote of candidatePool) {
      const recencyIndex = recentQuoteIndexByKey.get(candidateQuote.key) ?? -1;

      if (recencyIndex > maxRecencyIndex) {
        maxRecencyIndex = recencyIndex;
        leastRecentlySeenQuote = candidateQuote;
      }
    }

    return leastRecentlySeenQuote;
  }

  if (randomPool.length === 0) {
    randomPool = normalizedPool;
  }

  const randomIndex = Math.floor(Math.random() * randomPool.length);
  return randomPool[randomIndex] ?? normalizedPool[0];
}

function getQuoteRotationIntervalMs(quoteText: string): number {
  const quoteLength = trimQuoteText(quoteText).length;

  if (quoteLength <= QUOTE_NEAR_SIXTY_MAX_CHARACTERS) {
    return QUOTE_NEAR_SIXTY_ROTATION_INTERVAL_MS;
  }

  if (quoteLength <= QUOTE_MEDIUM_MAX_CHARACTERS) {
    return QUOTE_MEDIUM_ROTATION_INTERVAL_MS;
  }

  return QUOTE_LONG_ROTATION_INTERVAL_MS;
}

function parseStoredQuote(rawValue: string | null): ResolvedQuoteEntry | null {
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<ResolvedQuoteEntry>;
    if (
      typeof parsed.key !== "string" ||
      typeof parsed.text !== "string" ||
      typeof parsed.attribution !== "string"
    ) {
      return null;
    }

    const normalizedText = parsed.text.replace(/\s+/g, " ").trim();
    const normalizedAttribution = parsed.attribution.trim();
    const normalizedHighlightKeywords = normalizeHighlightKeywords(
      parsed.highlightKeywords
    );
    if (!(normalizedText && normalizedAttribution)) {
      return null;
    }

    return {
      attribution: normalizedAttribution,
      highlightKeywords: normalizedHighlightKeywords,
      key: parsed.key,
      source: "authors",
      text: normalizedText,
    };
  } catch {
    return null;
  }
}

function getPositiveHighlightColor(
  word: string,
  curatedHighlightKeywordSet?: Set<string> | null
): string | null {
  const normalizedWord = normalizeHighlightToken(word);
  if (!normalizedWord) {
    return null;
  }

  if (curatedHighlightKeywordSet) {
    if (!curatedHighlightKeywordSet.has(normalizedWord)) {
      return null;
    }
  } else if (getWordTone(normalizedWord) !== "positive") {
    return null;
  }

  let hashValue = 0;
  for (let index = 0; index < normalizedWord.length; index += 1) {
    hashValue =
      (hashValue * 31 + normalizedWord.charCodeAt(index)) % 2_147_483_647;
  }

  const colorVariable =
    TODO_HIGHLIGHT_COLOR_VARS[hashValue % TODO_HIGHLIGHT_COLOR_VARS.length] ??
    "--todo-group-green";

  return `var(${colorVariable})`;
}

interface PositiveNeonPalette {
  flickerShadow: string;
  flickerTextColor: string;
  introTextColor: string;
  softShadow: string;
  strongShadow: string;
  textColor: string;
}

interface NeonFlickerTimeline {
  durationSeconds: number;
  times: number[];
}

const NEON_ENTRY_PEAK_RATIO = 0.08;
const NEON_ENTRY_SETTLE_RATIO = 0.11;
const NEON_FLICKER_JITTER_MS = 120;
const NEON_FLICKER_PULSE_MS = 100;
const NEON_MIN_TIMELINE_MS = 2400;

function clampNumber(
  value: number,
  minValue: number,
  maxValue: number
): number {
  return Math.max(minValue, Math.min(maxValue, value));
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 2_147_483_647;
  }

  return hash;
}

function createNeonFlickerTimeline(
  quoteDurationMs: number,
  flickerSeed: string
): NeonFlickerTimeline {
  const safeDurationMs = Math.max(NEON_MIN_TIMELINE_MS, quoteDurationMs);
  const jitterRange = NEON_FLICKER_JITTER_MS * 2 + 1;
  const jitterMs =
    (hashString(flickerSeed) % jitterRange) - NEON_FLICKER_JITTER_MS;
  const flickerCenterMs = safeDurationMs / 2 + jitterMs;
  const halfPulseMs = NEON_FLICKER_PULSE_MS / 2;

  const entryPeakRatio = clampNumber(NEON_ENTRY_PEAK_RATIO, 0.04, 0.12);
  const entrySettleRatio = clampNumber(
    NEON_ENTRY_SETTLE_RATIO,
    entryPeakRatio + 0.01,
    0.2
  );
  const flickerStartRatio = clampNumber(
    (flickerCenterMs - halfPulseMs) / safeDurationMs,
    entrySettleRatio + 0.08,
    0.9
  );
  const flickerMidRatio = clampNumber(
    flickerCenterMs / safeDurationMs,
    flickerStartRatio + 0.004,
    0.95
  );
  const flickerEndRatio = clampNumber(
    (flickerCenterMs + halfPulseMs) / safeDurationMs,
    flickerMidRatio + 0.004,
    0.98
  );
  const preFlickerRatio = clampNumber(
    flickerStartRatio - 0.01,
    entrySettleRatio + 0.01,
    flickerStartRatio
  );

  return {
    durationSeconds: safeDurationMs / 1000,
    times: [
      0,
      entryPeakRatio,
      entrySettleRatio,
      preFlickerRatio,
      flickerMidRatio,
      flickerEndRatio,
      1,
    ],
  };
}

function isDarkThemeActive(): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  return document.documentElement.classList.contains("dark");
}

function getPositiveNeonPalette(highlightColor: string): PositiveNeonPalette {
  if (isDarkThemeActive()) {
    const textColor = `color-mix(in oklab, ${highlightColor} 74%, white)`;
    const introTextColor = `color-mix(in oklab, ${highlightColor} 58%, white)`;
    const flickerTextColor = `color-mix(in oklab, ${highlightColor} 86%, white)`;
    const coreGlow = `color-mix(in oklab, ${highlightColor} 82%, white)`;
    const innerGlow = `color-mix(in oklab, ${highlightColor} 68%, white)`;
    const outerGlow = `color-mix(in oklab, ${highlightColor} 54%, white)`;
    const flickerShadow = `0 0 0.02rem ${coreGlow}, 0 0 0.12rem ${coreGlow}, 0 0 0.26rem ${innerGlow}, 0 0 0.56rem ${outerGlow}`;

    return {
      flickerShadow,
      flickerTextColor,
      introTextColor,
      softShadow: `0 0 0.06rem ${coreGlow}, 0 0 0.18rem ${innerGlow}, 0 0 0.42rem ${outerGlow}`,
      strongShadow: `0 0 0.02rem ${coreGlow}, 0 0 0.1rem ${coreGlow}, 0 0 0.24rem ${innerGlow}, 0 0 0.5rem ${outerGlow}`,
      textColor,
    };
  }

  const textColor = `color-mix(in oklab, ${highlightColor} 70%, white)`;
  const introTextColor = `color-mix(in oklab, ${highlightColor} 48%, white)`;
  const flickerTextColor = `color-mix(in oklab, ${highlightColor} 82%, white)`;
  const edgeInk = `color-mix(in oklab, ${highlightColor} 70%, black)`;
  const coreGlow = `color-mix(in oklab, ${highlightColor} 84%, white)`;
  const innerGlow = `color-mix(in oklab, ${highlightColor} 66%, white)`;
  const outerGlow = `color-mix(in oklab, ${highlightColor} 44%, white)`;
  const haloGlow = `color-mix(in oklab, ${highlightColor} 28%, white)`;
  const flickerShadow = `0 0 0.02rem ${edgeInk}, 0 0 0.08rem ${coreGlow}, 0 0 0.22rem ${innerGlow}, 0 0 0.48rem ${outerGlow}`;

  return {
    flickerShadow,
    flickerTextColor,
    introTextColor,
    softShadow: `0 0 0.02rem ${edgeInk}, 0 0 0.12rem ${innerGlow}, 0 0 0.34rem ${outerGlow}`,
    strongShadow: `0 0 0.02rem ${edgeInk}, 0 0 0.08rem ${coreGlow}, 0 0 0.22rem ${innerGlow}, 0 0 0.48rem ${outerGlow}, 0 0 0.62rem ${haloGlow}`,
    textColor,
  };
}

function getPositiveHighlightTextColor(highlightColor: string): string {
  return getPositiveNeonPalette(highlightColor).textColor;
}

function getPositiveHighlightIntroColor(highlightColor: string): string {
  return getPositiveNeonPalette(highlightColor).introTextColor;
}

function getPositiveHighlightShadow(highlightColor: string): string {
  return getPositiveNeonPalette(highlightColor).strongShadow;
}

function getPositiveHighlightStyle(
  highlightColor: string | null
): CSSProperties | undefined {
  if (!highlightColor) {
    return undefined;
  }

  return {
    color: getPositiveHighlightTextColor(highlightColor),
    fontWeight: 600,
    textShadow: getPositiveHighlightShadow(highlightColor),
  };
}

function renderShimmerLetterCharacter({
  character,
  characterIndex,
  quoteDurationMs,
  quoteSeed,
  highlightColor,
  revealDelay,
}: {
  character: string;
  characterIndex: number;
  quoteDurationMs: number;
  quoteSeed: string;
  highlightColor: string | null;
  revealDelay: number;
}): ReactNode {
  const characterKey = `${character}-${characterIndex}`;
  if (WHITESPACE_TOKEN_REGEX.test(character)) {
    return <span key={characterKey}>{character}</span>;
  }

  const isPositiveCharacter = highlightColor !== null;

  if (isPositiveCharacter) {
    const neonPalette = getPositiveNeonPalette(highlightColor);
    const neonFlickerTimeline = createNeonFlickerTimeline(
      quoteDurationMs,
      `${quoteSeed}-${characterKey}`
    );

    return (
      <motion.span
        animate={{
          color: [
            "hsl(var(--foreground) / 0.48)",
            neonPalette.introTextColor,
            neonPalette.flickerTextColor,
            neonPalette.textColor,
            neonPalette.textColor,
            "hsl(var(--foreground) / 0.08)",
            neonPalette.textColor,
            neonPalette.textColor,
          ],
          filter: [
            "blur(8px) saturate(176%) brightness(108%)",
            "blur(2px) saturate(164%) brightness(112%)",
            "blur(0px) saturate(160%) brightness(114%)",
            "blur(0px) saturate(148%) brightness(104%)",
            "blur(0px) saturate(10%) brightness(4%)",
            "blur(0px) saturate(170%) brightness(114%)",
            "blur(0px) saturate(148%) brightness(104%)",
          ],
          opacity: [0, 0.86, 1, 1, 0, 1, 1],
          textShadow: [
            "0 0 0 transparent",
            neonPalette.softShadow,
            neonPalette.flickerShadow,
            neonPalette.strongShadow,
            "0 0 0 transparent",
            neonPalette.flickerShadow,
            neonPalette.strongShadow,
          ],
          y: [3.2, 0.8, 0, 0, 0, 0, 0],
        }}
        initial={{
          color: neonPalette.introTextColor,
          filter: "blur(9px) saturate(170%) brightness(106%)",
          opacity: 0,
          textShadow: "0 0 0 transparent",
          y: 3.2,
        }}
        key={characterKey}
        style={getPositiveHighlightStyle(highlightColor)}
        transition={{
          delay: revealDelay,
          duration: neonFlickerTimeline.durationSeconds,
          ease: STRONG_EASE_OUT,
          times: neonFlickerTimeline.times,
        }}
      >
        {character}
      </motion.span>
    );
  }

  return (
    <motion.span
      animate={{
        color: [
          "hsl(var(--foreground) / 0.42)",
          "hsl(var(--foreground) / 1)",
          "hsl(var(--foreground) / 0.92)",
        ],
        filter: ["blur(8px)", "blur(2px)", "blur(0px)"],
        opacity: [0, 0.86, 1],
        textShadow: [
          "0 0 0 hsl(var(--foreground) / 0)",
          "0 0 9px hsl(var(--foreground) / 0.35)",
          "0 0 0 hsl(var(--foreground) / 0)",
        ],
        y: [3.2, 0.8, 0],
      }}
      initial={{
        color: "hsl(var(--foreground) / 0.34)",
        filter: "blur(9px)",
        opacity: 0,
        textShadow: "0 0 0 hsl(var(--foreground) / 0)",
        y: 3.2,
      }}
      key={characterKey}
      transition={{
        delay: revealDelay,
        duration: 0.62,
        ease: STRONG_EASE_OUT,
        times: [0, 0.58, 1],
      }}
    >
      {character}
    </motion.span>
  );
}

function getWordTone(word: string): "positive" | null {
  if (!word) {
    return null;
  }

  if (POSITIVE_WORDS.has(word)) {
    return "positive";
  }

  return null;
}

function AnimatedQuoteText({
  quoteText,
  quoteDurationMs,
  quoteSeed,
  highlightKeywords,
  className,
  staggerDelay = 0.042,
  useLetterShimmer = false,
}: {
  quoteText: string;
  quoteDurationMs: number;
  quoteSeed: string;
  highlightKeywords?: string[];
  className?: string;
  staggerDelay?: number;
  useLetterShimmer?: boolean;
}) {
  const prefersReducedMotion = useReducedMotion();
  const curatedHighlightKeywordSet = useMemo(() => {
    return buildCuratedHighlightKeywordSet(highlightKeywords);
  }, [highlightKeywords]);

  if (useLetterShimmer) {
    if (prefersReducedMotion) {
      const quoteTokens = quoteText.split(TOKEN_SPLIT_REGEX).filter(Boolean);

      return (
        <p className={className}>
          {quoteTokens.map((token, tokenIndex) => {
            const tokenKey = `${token}-${tokenIndex}`;

            if (WHITESPACE_TOKEN_REGEX.test(token)) {
              return <span key={tokenKey}>{token}</span>;
            }

            const highlightColor = getPositiveHighlightColor(
              token,
              curatedHighlightKeywordSet
            );

            return (
              <span
                className={highlightColor ? "font-medium" : undefined}
                key={tokenKey}
                style={getPositiveHighlightStyle(highlightColor)}
              >
                {token}
              </span>
            );
          })}
        </p>
      );
    }

    const quoteCharacters = Array.from(quoteText);
    const glintDuration = 1.16;
    const positiveCharacterColorsByIndex = new Map<number, string>();
    const revealDelayByIndex = new Map<number, number>();
    let characterRevealIndex = 0;

    for (const [characterIndex, character] of quoteCharacters.entries()) {
      if (WHITESPACE_TOKEN_REGEX.test(character)) {
        continue;
      }

      revealDelayByIndex.set(
        characterIndex,
        characterRevealIndex * staggerDelay
      );
      characterRevealIndex += 1;
    }

    for (const wordMatch of quoteText.matchAll(WORD_TOKEN_REGEX)) {
      const highlightColor = getPositiveHighlightColor(
        wordMatch[0],
        curatedHighlightKeywordSet
      );
      if (!highlightColor) {
        continue;
      }

      const wordStartIndex = wordMatch.index ?? -1;
      if (wordStartIndex < 0) {
        continue;
      }

      for (
        let characterOffset = 0;
        characterOffset < wordMatch[0].length;
        characterOffset += 1
      ) {
        positiveCharacterColorsByIndex.set(
          wordStartIndex + characterOffset,
          highlightColor
        );
      }
    }

    return (
      <span className="relative block">
        <p className={className}>
          {quoteCharacters.map((character, characterIndex) => {
            const highlightColor =
              positiveCharacterColorsByIndex.get(characterIndex) ?? null;

            return renderShimmerLetterCharacter({
              character,
              characterIndex,
              highlightColor,
              quoteDurationMs,
              quoteSeed,
              revealDelay: revealDelayByIndex.get(characterIndex) ?? 0,
            });
          })}
        </p>

        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-x-hidden rounded-sm"
        >
          <motion.span
            animate={{
              opacity: [0, 0.82, 0],
              x: ["0%", "560%"],
            }}
            className="absolute inset-y-0 -left-full w-1/3 bg-linear-to-r from-transparent via-primary/75 to-transparent mix-blend-screen"
            initial={{
              opacity: 0,
              x: "0%",
            }}
            transition={{
              delay: 0,
              duration: glintDuration,
              ease: STRONG_EASE_OUT,
            }}
          />
        </span>
      </span>
    );
  }

  const tokenOccurrences = new Map<string, number>();
  let tokenPosition = 0;
  const quoteTokens = quoteText.split(TOKEN_SPLIT_REGEX).filter(Boolean);

  return (
    <p className={className}>
      {quoteTokens.map((token) => {
        const keyCount = (tokenOccurrences.get(token) ?? 0) + 1;
        tokenOccurrences.set(token, keyCount);

        const tokenKey = `${token}-${keyCount}`;
        if (WHITESPACE_TOKEN_REGEX.test(token)) {
          return <span key={tokenKey}>{token}</span>;
        }

        const highlightColor = getPositiveHighlightColor(
          token,
          curatedHighlightKeywordSet
        );
        const tokenClassName = highlightColor ? "font-medium" : undefined;

        if (prefersReducedMotion) {
          return (
            <span
              className={tokenClassName}
              key={tokenKey}
              style={getPositiveHighlightStyle(highlightColor)}
            >
              {token}
            </span>
          );
        }

        const transitionDelay = tokenPosition * staggerDelay;
        tokenPosition += 1;

        if (highlightColor) {
          const neonPalette = getPositiveNeonPalette(highlightColor);
          const neonFlickerTimeline = createNeonFlickerTimeline(
            quoteDurationMs,
            `${quoteSeed}-${tokenKey}`
          );

          return (
            <motion.span
              animate={{
                color: [
                  "hsl(var(--foreground) / 0.5)",
                  neonPalette.introTextColor,
                  neonPalette.flickerTextColor,
                  neonPalette.textColor,
                  neonPalette.textColor,
                  "hsl(var(--foreground) / 0.08)",
                  neonPalette.textColor,
                  neonPalette.textColor,
                ],
                filter: [
                  "blur(6px) saturate(170%) brightness(106%)",
                  "blur(2px) saturate(160%) brightness(111%)",
                  "blur(0px) saturate(154%) brightness(113%)",
                  "blur(0px) saturate(146%) brightness(103%)",
                  "blur(0px) saturate(8%) brightness(4%)",
                  "blur(0px) saturate(168%) brightness(114%)",
                  "blur(0px) saturate(146%) brightness(103%)",
                ],
                opacity: [0, 0.86, 1, 1, 0, 1, 1],
                textShadow: [
                  "0 0 0 transparent",
                  neonPalette.softShadow,
                  neonPalette.flickerShadow,
                  neonPalette.strongShadow,
                  "0 0 0 transparent",
                  neonPalette.flickerShadow,
                  neonPalette.strongShadow,
                ],
                y: [1.2, 0.35, 0, 0, 0, 0, 0],
              }}
              className={tokenClassName}
              initial={{
                color: getPositiveHighlightIntroColor(highlightColor),
                filter: "blur(7px) saturate(162%) brightness(106%)",
                opacity: 0.08,
                textShadow: "0 0 0 transparent",
                y: 1.2,
              }}
              key={tokenKey}
              style={getPositiveHighlightStyle(highlightColor)}
              transition={{
                delay: transitionDelay,
                duration: neonFlickerTimeline.durationSeconds,
                ease: [0.23, 1, 0.32, 1],
                times: neonFlickerTimeline.times,
              }}
            >
              {token}
            </motion.span>
          );
        }

        return (
          <motion.span
            animate={{
              color: [
                "hsl(var(--foreground) / 0.45)",
                "hsl(var(--foreground) / 0.98)",
                "hsl(var(--foreground) / 0.8)",
              ],
              filter: ["blur(6px)", "blur(2px)", "blur(0px)"],
              opacity: [0, 0.86, 1],
              y: [1.2, 0.35, 0],
            }}
            className={tokenClassName}
            initial={{
              color: "hsl(var(--foreground) / 0.35)",
              filter: "blur(7px)",
              opacity: 0.08,
              y: 1.2,
            }}
            key={tokenKey}
            transition={{
              delay: transitionDelay,
              duration: 0.52,
              ease: [0.23, 1, 0.32, 1],
              times: [0, 0.58, 1],
            }}
          >
            {token}
          </motion.span>
        );
      })}
    </p>
  );
}

function useQuotesContext(): QuotesContextValue {
  const quotesContext = useContext(QuotesContext);
  if (!quotesContext) {
    throw new Error("Quotes components must be used inside QuotesProvider");
  }

  return quotesContext;
}

export function QuotesProvider({ children }: { children: ReactNode }) {
  const quotePool = useMemo(() => {
    return resolveQuotePool();
  }, []);

  const [activeQuote, setActiveQuote] = useState<ResolvedQuoteEntry>(() => {
    const quoteFromSession = parseStoredQuote(
      window.sessionStorage.getItem(SESSION_QUOTE_STORAGE_KEY)
    );

    if (
      quoteFromSession &&
      quotePool.some((quote) => quote.key === quoteFromSession.key)
    ) {
      return quoteFromSession;
    }

    const selectedQuote = pickQuote(
      quotePool,
      readRecentQuoteKeys(),
      window.localStorage.getItem(LAST_QUOTE_STORAGE_KEY) ?? undefined
    );

    return selectedQuote;
  });

  useEffect(() => {
    if (quotePool.length <= 1) {
      return;
    }

    const rotationTimer = window.setTimeout(() => {
      setActiveQuote((previousQuote) => {
        return pickQuote(quotePool, readRecentQuoteKeys(), previousQuote.key);
      });
    }, getQuoteRotationIntervalMs(activeQuote.text));

    return () => {
      window.clearTimeout(rotationTimer);
    };
  }, [activeQuote.text, quotePool]);

  useEffect(() => {
    window.sessionStorage.setItem(
      SESSION_QUOTE_STORAGE_KEY,
      JSON.stringify(activeQuote)
    );
    window.localStorage.setItem(LAST_QUOTE_STORAGE_KEY, activeQuote.key);
    appendRecentQuoteKey(activeQuote.key, quotePool.length);
  }, [activeQuote, quotePool.length]);

  const contextValue = useMemo<QuotesContextValue>(() => {
    return {
      activeQuote,
    };
  }, [activeQuote]);

  return (
    <QuotesContext.Provider value={contextValue}>
      {children}
    </QuotesContext.Provider>
  );
}

export function FooterQuote() {
  const { activeQuote } = useQuotesContext();
  const quoteDurationMs = getQuoteRotationIntervalMs(activeQuote.text);
  const fullQuoteWithAttribution = `${activeQuote.text} ~ ${activeQuote.attribution}`;

  const handleQuoteCopy = (event: ReactClipboardEvent<HTMLDivElement>) => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      return;
    }

    if (activeQuote.text.length < QUOTE_CLAMP_COPY_MIN_CHARACTERS) {
      return;
    }

    event.preventDefault();
    event.clipboardData.setData("text/plain", fullQuoteWithAttribution);
  };

  return (
    <div className="w-full flex-1 overflow-hidden">
      <div className="flex items-center gap-1 rounded-md border border-border/60 bg-muted/35">
        <span className="shrink-0 rounded-l bg-primary/10 px-1 py-1 font-medium text-[9px] text-primary uppercase tracking-wide">
          <IconBlockquote className="size-3" />
        </span>

        <div className="min-w-0 flex-1 px-0.5 py-0.5">
          <AnimatePresence mode="wait">
            <motion.div
              animate={{
                filter: "blur(0px)",
                opacity: 1,
                scale: 1,
                y: 0,
              }}
              aria-label={fullQuoteWithAttribution}
              className="relative flex items-center gap-1 rounded-sm"
              exit={{
                filter: "blur(2px)",
                opacity: 0,
                scale: 0.996,
                transition: {
                  duration: 0.16,
                  ease: STRONG_EASE_OUT,
                },
                y: -1.2,
              }}
              initial={{
                filter: "blur(4px)",
                opacity: 0,
                scale: 0.988,
                y: 1.6,
              }}
              key={`${activeQuote.text}-${activeQuote.attribution}`}
              onCopy={handleQuoteCopy}
              role="note"
              transition={{
                duration: 0.22,
                ease: STRONG_EASE_OUT,
              }}
            >
              <div
                aria-hidden
                className="relative min-w-0 flex-1 will-change-contents"
              >
                <AnimatedQuoteText
                  className="line-clamp-1 h-3.5! min-w-0 flex-1 overflow-visible font-mono text-[10px] text-foreground leading-4"
                  highlightKeywords={activeQuote.highlightKeywords}
                  quoteDurationMs={quoteDurationMs}
                  quoteSeed={activeQuote.key}
                  quoteText={activeQuote.text}
                  staggerDelay={0.0135}
                  useLetterShimmer
                />
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <span className="shrink-0 truncate rounded bg-primary/10 px-1 py-px text-[9px] text-primary/85 tracking-tighter">
                  ~ {activeQuote.attribution}
                </span>
              </div>

              <span className="sr-only">{fullQuoteWithAttribution}</span>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
