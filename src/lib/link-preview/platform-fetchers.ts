import { buildCacheEntry, getXPostTextFromEmbedHtml } from "./builders";
import { X_PREVIEW_FALLBACK_IMAGE_URL } from "./constants";
import { getDefaultIconUrl } from "./icon-metadata";
import {
  type GitHubResourceDetails,
  getCanonicalYouTubeWatchUrl,
  getXStatusDetails,
  getYouTubeThumbnailUrlById,
  getYouTubeVideoId,
  parseGitHubResource,
} from "./platform";
import type { LinkPreviewCacheEntry } from "./types";
import { clipText, getNonEmptyString, resolveUrl } from "./utils";

interface YouTubeOEmbedResponse {
  author_name?: string;
  thumbnail_url?: string;
  title?: string;
}

const YOUTUBE_SHORT_DESCRIPTION_REGEX =
  /"shortDescription":"((?:\\.|[^"\\])*)"/;

const extractYouTubeShortDescription = (html: string): string => {
  const match = YOUTUBE_SHORT_DESCRIPTION_REGEX.exec(html);
  const encodedDescription = getNonEmptyString(match?.[1]);
  if (!encodedDescription) {
    return "";
  }

  try {
    return getNonEmptyString(
      JSON.parse(`"${encodedDescription}"`) as string
    ).replace(/\s+/g, " ");
  } catch {
    return "";
  }
};

const fetchYouTubeVideoDescription = async (
  canonicalWatchUrl: string,
  signal: AbortSignal
): Promise<string> => {
  try {
    const response = await fetch(canonicalWatchUrl, {
      credentials: "omit",
      signal,
    });

    if (!response.ok) {
      return "";
    }

    const html = await response.text();
    return extractYouTubeShortDescription(html);
  } catch {
    return "";
  }
};

export const fetchYouTubePreview = async (
  targetUrl: string,
  signal: AbortSignal,
  now: number,
  previousEntry?: LinkPreviewCacheEntry | null
): Promise<LinkPreviewCacheEntry | null> => {
  const videoId = getYouTubeVideoId(targetUrl);
  if (!videoId) {
    return null;
  }

  const canonicalWatchUrl = getCanonicalYouTubeWatchUrl(videoId);
  const oEmbedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalWatchUrl)}&format=json`;

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
    const author = getNonEmptyString(payload.author_name);
    const videoDescription = await fetchYouTubeVideoDescription(
      canonicalWatchUrl,
      signal
    );
    const descriptionParts = [
      author ? `by ${author}` : "",
      clipText(videoDescription, 360),
    ].filter(Boolean);
    const description = descriptionParts.join(" • ");
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

export const fetchXPreview = async (
  targetUrl: string,
  signal: AbortSignal,
  now: number,
  previousEntry?: LinkPreviewCacheEntry | null
): Promise<LinkPreviewCacheEntry | null> => {
  const statusDetails = getXStatusDetails(targetUrl);
  if (!statusDetails) {
    return null;
  }

  const canonicalStatusUrl = `https://x.com/${statusDetails.username}/status/${statusDetails.statusId}`;
  const oEmbedEndpoints = [
    "https://publish.x.com/oembed",
    "https://publish.twitter.com/oembed",
  ];
  const query = `url=${encodeURIComponent(canonicalStatusUrl)}&omit_script=true`;

  try {
    let payload: XOEmbedResponse | null = null;

    for (const endpoint of oEmbedEndpoints) {
      const response = await fetch(`${endpoint}?${query}`, {
        credentials: "omit",
        signal,
      });

      if (!response.ok) {
        continue;
      }

      payload = (await response.json()) as XOEmbedResponse;
      break;
    }

    if (!payload) {
      return null;
    }

    const description = getXPostTextFromEmbedHtml(
      getNonEmptyString(payload.html)
    );

    return buildCacheEntry({
      description,
      iconUrl: getDefaultIconUrl(targetUrl),
      imageUrl: X_PREVIEW_FALLBACK_IMAGE_URL,
      now,
      platform: "x",
      previousEntry,
      quality: description ? "success" : "degraded",
      siteName: "X",
      source: "x-oembed",
      title: `@${statusDetails.username} on X`,
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

export const fetchGitHubPreview = (
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
