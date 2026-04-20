import changelogMarkdown from "../../CHANGELOG.md?raw";

export interface LatestChangelogSummary {
  compareUrl: string;
  highlights: string[];
  releaseDate?: string;
  version: string;
}

const RELEASE_HEADING_REGEX =
  /^## \[([^\]]+)\]\(([^)]+)\)(?: \(([^)]+)\))?\s*$/;
const SECTION_HEADING_REGEX = /^###\s+(.+)$/;
const BULLET_LINE_REGEX = /^\*\s+(.+)$/;
const NEWLINE_SPLIT_REGEX = /\r?\n/;

function sanitizeBulletText(line: string): string {
  return line
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/\s+\([^)]*\)$/g, "")
    .trim();
}

function pickHighlights(
  featureHighlights: string[],
  bugFixHighlights: string[],
  fallbackHighlights: string[],
  maxHighlights: number
): string[] {
  const prioritizedHighlights = [
    ...featureHighlights,
    ...bugFixHighlights,
    ...fallbackHighlights,
  ];

  return prioritizedHighlights.slice(0, maxHighlights);
}

export function readLatestChangelogSummary(
  maxHighlights = 2
): LatestChangelogSummary | null {
  const lines = changelogMarkdown.split(NEWLINE_SPLIT_REGEX);
  const releaseHeadingIndex = lines.findIndex((line) => {
    return RELEASE_HEADING_REGEX.test(line.trim());
  });

  if (releaseHeadingIndex < 0) {
    return null;
  }

  const releaseHeadingMatch = lines[releaseHeadingIndex]
    ?.trim()
    .match(RELEASE_HEADING_REGEX);

  if (!releaseHeadingMatch) {
    return null;
  }

  const [, version, compareUrl, releaseDate] = releaseHeadingMatch;
  const featureHighlights: string[] = [];
  const bugFixHighlights: string[] = [];
  const fallbackHighlights: string[] = [];

  let currentSection = "";

  for (
    let lineIndex = releaseHeadingIndex + 1;
    lineIndex < lines.length;
    lineIndex += 1
  ) {
    const trimmedLine = lines[lineIndex]?.trim();

    if (!trimmedLine) {
      continue;
    }

    if (trimmedLine.startsWith("## ")) {
      break;
    }

    const sectionMatch = trimmedLine.match(SECTION_HEADING_REGEX);
    if (sectionMatch) {
      currentSection = sectionMatch[1]?.toLowerCase() ?? "";
      continue;
    }

    const bulletMatch = trimmedLine.match(BULLET_LINE_REGEX);
    if (!bulletMatch) {
      continue;
    }

    const cleanedHighlight = sanitizeBulletText(bulletMatch[1] ?? "");
    if (!cleanedHighlight) {
      continue;
    }

    if (currentSection.includes("feature")) {
      featureHighlights.push(cleanedHighlight);
      continue;
    }

    if (currentSection.includes("bug")) {
      bugFixHighlights.push(cleanedHighlight);
      continue;
    }

    fallbackHighlights.push(cleanedHighlight);
  }

  const highlights = pickHighlights(
    featureHighlights,
    bugFixHighlights,
    fallbackHighlights,
    maxHighlights
  );

  if (highlights.length === 0) {
    highlights.push("small improvements and fixes are ready for you");
  }

  return {
    compareUrl,
    highlights,
    releaseDate,
    version,
  };
}
