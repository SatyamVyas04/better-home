import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { quotesDefault } from "../src/constants/quotes-default";
import type {
  DefaultQuoteRecord,
  QuoteEntry,
  QuoteSourceRecord,
} from "../src/types/quotes";

const WORD_TOKEN_REGEX = /[A-Za-z0-9']+/g;
const NUMERIC_TOKEN_REGEX = /^\d+$/;
const APOSTROPHE_TOKEN_REGEX = /'/;

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

const THEMATIC_WORDS = new Set([
  "awareness",
  "breathe",
  "clarity",
  "compassion",
  "consciousness",
  "discipline",
  "freedom",
  "future",
  "gratitude",
  "growth",
  "happiness",
  "harmony",
  "healing",
  "hope",
  "intention",
  "journey",
  "kindness",
  "learn",
  "life",
  "light",
  "listen",
  "mind",
  "mindful",
  "path",
  "peace",
  "presence",
  "purpose",
  "resilience",
  "self",
  "soul",
  "strength",
  "time",
  "transform",
  "truth",
  "wisdom",
]);

const HIGH_SIGNAL_WORDS = new Set([
  "accomplishment",
  "action",
  "adapt",
  "advantages",
  "ambition",
  "awareness",
  "balance",
  "belief",
  "brave",
  "brand",
  "business",
  "calm",
  "candor",
  "career",
  "character",
  "clarity",
  "commitment",
  "compassion",
  "confidence",
  "consistency",
  "control",
  "courage",
  "culture",
  "curiosity",
  "dedication",
  "delight",
  "design",
  "discipline",
  "effort",
  "empathy",
  "endurance",
  "energy",
  "entrepreneur",
  "execution",
  "faith",
  "failure",
  "focus",
  "freedom",
  "future",
  "generosity",
  "goals",
  "goodness",
  "grace",
  "gratitude",
  "growth",
  "happiness",
  "health",
  "heart",
  "hope",
  "impact",
  "innovation",
  "integrity",
  "journey",
  "kindness",
  "leadership",
  "learn",
  "life",
  "longevity",
  "love",
  "mastery",
  "meaning",
  "meditation",
  "mind",
  "mission",
  "motivation",
  "network",
  "obstacle",
  "opportunity",
  "optimism",
  "passion",
  "patience",
  "peace",
  "persistence",
  "perspective",
  "power",
  "practice",
  "presence",
  "product",
  "productivity",
  "progress",
  "purpose",
  "quality",
  "questions",
  "resilience",
  "respect",
  "risk",
  "service",
  "simplicity",
  "solitude",
  "stability",
  "stillness",
  "strength",
  "success",
  "technology",
  "time",
  "truth",
  "victory",
  "vision",
  "wisdom",
  "work",
]);

const LOW_SIGNAL_WORDS = new Set([
  "actually",
  "almost",
  "another",
  "anything",
  "anywhere",
  "around",
  "away",
  "bloody",
  "cannot",
  "came",
  "comes",
  "could",
  "different",
  "doing",
  "else",
  "enough",
  "even",
  "ever",
  "every",
  "everyone",
  "far",
  "found",
  "getting",
  "goes",
  "gone",
  "happens",
  "hard",
  "however",
  "itself",
  "knew",
  "least",
  "less",
  "little",
  "long",
  "many",
  "matter",
  "middle",
  "more",
  "most",
  "much",
  "must",
  "needed",
  "nothing",
  "often",
  "once",
  "only",
  "others",
  "outside",
  "overall",
  "person",
  "really",
  "remains",
  "right",
  "said",
  "same",
  "second",
  "simple",
  "simply",
  "single",
  "slightly",
  "something",
  "sometimes",
  "soon",
  "still",
  "stuff",
  "such",
  "thing",
  "things",
  "third",
  "throughout",
  "today",
  "tomorrow",
  "truly",
  "understand",
  "unless",
  "until",
  "usually",
  "very",
  "whatever",
  "whenever",
  "whole",
  "without",
  "world",
]);

const ALLOWED_SHORT_KEYWORDS = new Set(["ai", "ego"]);

const STOP_WORDS = new Set([
  "a",
  "about",
  "after",
  "again",
  "all",
  "am",
  "an",
  "and",
  "any",
  "are",
  "as",
  "at",
  "be",
  "because",
  "been",
  "before",
  "being",
  "between",
  "both",
  "but",
  "by",
  "can",
  "could",
  "did",
  "do",
  "does",
  "doing",
  "done",
  "down",
  "each",
  "even",
  "every",
  "for",
  "from",
  "further",
  "had",
  "has",
  "have",
  "having",
  "he",
  "her",
  "here",
  "hers",
  "herself",
  "him",
  "himself",
  "his",
  "how",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "itself",
  "just",
  "let",
  "like",
  "made",
  "make",
  "me",
  "might",
  "more",
  "most",
  "must",
  "my",
  "myself",
  "never",
  "no",
  "nor",
  "not",
  "now",
  "of",
  "off",
  "on",
  "once",
  "one",
  "only",
  "or",
  "other",
  "our",
  "ours",
  "ourselves",
  "out",
  "over",
  "own",
  "same",
  "she",
  "should",
  "so",
  "some",
  "such",
  "than",
  "that",
  "the",
  "their",
  "theirs",
  "them",
  "themselves",
  "then",
  "there",
  "these",
  "they",
  "this",
  "those",
  "through",
  "to",
  "too",
  "toward",
  "under",
  "until",
  "up",
  "very",
  "was",
  "we",
  "were",
  "what",
  "when",
  "where",
  "which",
  "while",
  "who",
  "why",
  "will",
  "with",
  "would",
  "you",
  "your",
  "yours",
  "yourself",
  "yourselves",
]);

function normalizeToken(word: string): string {
  return word.toLowerCase().replace(/(^[^a-z0-9]+)|([^a-z0-9]+$)/g, "");
}

function toQuoteEntry(record: QuoteSourceRecord): QuoteEntry {
  if ((record as DefaultQuoteRecord).quote) {
    const defaultQuote = record as DefaultQuoteRecord;

    return {
      attribution: defaultQuote.author,
      highlightKeywords: defaultQuote.highlightKeywords,
      text: defaultQuote.quote,
    };
  }

  return record as QuoteEntry;
}

function getTargetKeywordCount(textLength: number): number {
  if (textLength <= 50) {
    return 1;
  }

  if (textLength <= 105) {
    return 2;
  }

  if (textLength <= 180) {
    return 3;
  }

  return 4;
}

function isValidKeywordCandidate(token: string): boolean {
  if (!token) {
    return false;
  }

  if (NUMERIC_TOKEN_REGEX.test(token)) {
    return false;
  }

  if (APOSTROPHE_TOKEN_REGEX.test(token)) {
    return false;
  }

  if (STOP_WORDS.has(token)) {
    return false;
  }

  if (LOW_SIGNAL_WORDS.has(token)) {
    return false;
  }

  if (token.length < 4 && !ALLOWED_SHORT_KEYWORDS.has(token)) {
    return false;
  }

  return true;
}

function scoreKeywordCandidate(
  token: string,
  frequencyByToken: Map<string, number>
): number {
  const frequencyScore = (frequencyByToken.get(token) ?? 0) * 10;
  const thematicScore = THEMATIC_WORDS.has(token) ? 24 : 0;
  const highSignalScore = HIGH_SIGNAL_WORDS.has(token) ? 18 : 0;
  const positiveScore = POSITIVE_WORDS.has(token) ? 14 : 0;
  const lowSignalPenalty = LOW_SIGNAL_WORDS.has(token) ? -28 : 0;
  const lengthScore = Math.min(10, Math.max(0, token.length - 3));

  return (
    frequencyScore +
    thematicScore +
    highSignalScore +
    positiveScore +
    lowSignalPenalty +
    lengthScore
  );
}

function pickHighlightKeywords(quoteText: string): string[] {
  const tokenMatches = quoteText.match(WORD_TOKEN_REGEX) ?? [];
  const frequencyByToken = new Map<string, number>();

  for (const tokenMatch of tokenMatches) {
    const normalizedToken = normalizeToken(tokenMatch);
    if (!normalizedToken) {
      continue;
    }

    frequencyByToken.set(
      normalizedToken,
      (frequencyByToken.get(normalizedToken) ?? 0) + 1
    );
  }

  const uniqueTokens = Array.from(frequencyByToken.keys());
  const maxKeywords = getTargetKeywordCount(quoteText.length);

  const candidateTokens = uniqueTokens
    .filter((token) => {
      return isValidKeywordCandidate(token);
    })
    .sort((tokenA, tokenB) => {
      const scoreA = scoreKeywordCandidate(tokenA, frequencyByToken);
      const scoreB = scoreKeywordCandidate(tokenB, frequencyByToken);

      return scoreB - scoreA;
    });

  const selectedKeywords = candidateTokens.slice(0, maxKeywords);

  if (selectedKeywords.length === 0) {
    const emergencyCandidate = uniqueTokens
      .filter((token) => {
        return isValidKeywordCandidate(token);
      })
      .sort((tokenA, tokenB) => {
        return (
          scoreKeywordCandidate(tokenB, frequencyByToken) -
          scoreKeywordCandidate(tokenA, frequencyByToken)
        );
      })
      .at(0);

    if (emergencyCandidate) {
      selectedKeywords.push(emergencyCandidate);
    }

    if (selectedKeywords.length === 0) {
      const fallbackAlphabeticCandidate = uniqueTokens.find((token) => {
        if (NUMERIC_TOKEN_REGEX.test(token)) {
          return false;
        }

        if (APOSTROPHE_TOKEN_REGEX.test(token)) {
          return false;
        }

        return token.length >= 3;
      });

      if (fallbackAlphabeticCandidate) {
        selectedKeywords.push(fallbackAlphabeticCandidate);
      }
    }
  }

  return selectedKeywords;
}

const curatedQuotes = quotesDefault
  .map((sourceRecord) => {
    return toQuoteEntry(sourceRecord);
  })
  .filter((quoteEntry) => {
    return quoteEntry.text.trim().length > 0;
  })
  .map((quoteEntry) => {
    return {
      attribution: quoteEntry.attribution,
      highlightKeywords: pickHighlightKeywords(quoteEntry.text),
      text: quoteEntry.text,
    };
  });

const outputFilePath = join(
  process.cwd(),
  "src",
  "constants",
  "quotes-default.ts"
);

const outputContent = [
  'import type { QuoteEntry } from "@/types/quotes";',
  "",
  `export const quotesDefault: QuoteEntry[] = ${JSON.stringify(curatedQuotes, null, 2)};`,
  "",
].join("\n");

writeFileSync(outputFilePath, outputContent, "utf8");

console.log(
  `Generated curated highlight keywords for ${curatedQuotes.length} quotes.`
);
