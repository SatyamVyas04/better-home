import {
  GIT_SUFFIX_REGEX,
  GITHUB_HOST_REGEX,
  GITHUB_NUMBER_REGEX,
  URL_FRAGMENT_SPLIT_REGEX,
  WWW_PREFIX_REGEX,
  X_HOST_REGEX,
  X_STATUS_PATH_REGEX,
  YOUTUBE_HOST_REGEX,
  YOUTUBE_VIDEO_ID_REGEX,
} from "./constants";
import type { LinkPreviewPlatform } from "./types";
import { getNonEmptyString } from "./utils";

const getPlatformFromHost = (hostname: string): LinkPreviewPlatform => {
  if (YOUTUBE_HOST_REGEX.test(hostname)) {
    return "youtube";
  }

  if (X_HOST_REGEX.test(hostname)) {
    return "x";
  }

  if (GITHUB_HOST_REGEX.test(hostname)) {
    return "github";
  }

  return "generic";
};

export const getPreviewPlatform = (targetUrl: string): LinkPreviewPlatform => {
  try {
    return getPlatformFromHost(new URL(targetUrl).hostname.toLowerCase());
  } catch {
    return "generic";
  }
};

export const getHostLabel = (targetUrl: string): string => {
  try {
    return getNonEmptyString(
      new URL(targetUrl).hostname.replace(WWW_PREFIX_REGEX, "")
    );
  } catch {
    return "";
  }
};

const normalizeYouTubeVideoId = (candidate: string): string => {
  const value = getNonEmptyString(candidate).split(URL_FRAGMENT_SPLIT_REGEX)[0];
  return YOUTUBE_VIDEO_ID_REGEX.test(value) ? value : "";
};

export const getYouTubeVideoId = (targetUrl: string): string => {
  try {
    const url = new URL(targetUrl);
    const hostname = url.hostname.toLowerCase();

    if (!YOUTUBE_HOST_REGEX.test(hostname)) {
      return "";
    }

    if (hostname.endsWith("youtu.be")) {
      return normalizeYouTubeVideoId(url.pathname.split("/")[1] || "");
    }

    const queryVideoId = normalizeYouTubeVideoId(
      url.searchParams.get("v") || ""
    );
    if (queryVideoId) {
      return queryVideoId;
    }

    const pathSegments = url.pathname.split("/").filter(Boolean);
    if (pathSegments.length < 2) {
      return "";
    }

    const route = pathSegments[0];
    if (route === "shorts" || route === "embed" || route === "live") {
      return normalizeYouTubeVideoId(pathSegments[1]);
    }

    return "";
  } catch {
    return "";
  }
};

export const getYouTubeThumbnailUrlById = (videoId: string): string =>
  videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : "";

export const getYouTubeThumbnailUrl = (targetUrl: string): string =>
  getYouTubeThumbnailUrlById(getYouTubeVideoId(targetUrl));

export const getCanonicalYouTubeWatchUrl = (videoId: string): string =>
  `https://www.youtube.com/watch?v=${videoId}`;

export interface XStatusDetails {
  statusId: string;
  username: string;
}

export const getXStatusDetails = (targetUrl: string): XStatusDetails | null => {
  try {
    const url = new URL(targetUrl);
    const match = url.pathname.match(X_STATUS_PATH_REGEX);
    if (!match) {
      return null;
    }

    const username = getNonEmptyString(match[1]);
    const statusId = getNonEmptyString(match[2]);
    if (!(username && statusId)) {
      return null;
    }

    return {
      statusId,
      username,
    };
  } catch {
    return null;
  }
};

export const getXProfileHandle = (targetUrl: string): string => {
  try {
    const url = new URL(targetUrl);
    const pathSegments = url.pathname.split("/").filter(Boolean);
    if (pathSegments.length === 0) {
      return "";
    }

    const firstSegment = getNonEmptyString(pathSegments[0]);
    return firstSegment.toLowerCase() === "i" ? "" : firstSegment;
  } catch {
    return "";
  }
};

export type GitHubResourceKind = "issue" | "pull" | "repo" | "user";

export interface GitHubResourceDetails {
  kind: GitHubResourceKind;
  number?: number;
  owner: string;
  repo?: string;
}

export const parseGitHubResource = (
  targetUrl: string
): GitHubResourceDetails | null => {
  try {
    const url = new URL(targetUrl);
    const pathSegments = url.pathname
      .split("/")
      .filter(Boolean)
      .map((segment) => segment.trim());

    if (pathSegments.length === 0) {
      return null;
    }

    const owner = getNonEmptyString(pathSegments[0]);
    if (!owner) {
      return null;
    }

    if (pathSegments.length === 1) {
      return {
        kind: "user",
        owner,
      };
    }

    const repo = getNonEmptyString(pathSegments[1]).replace(
      GIT_SUFFIX_REGEX,
      ""
    );
    if (!repo) {
      return null;
    }

    if (
      pathSegments[2] === "issues" &&
      GITHUB_NUMBER_REGEX.test(pathSegments[3] || "")
    ) {
      return {
        kind: "issue",
        number: Number.parseInt(pathSegments[3], 10),
        owner,
        repo,
      };
    }

    if (
      pathSegments[2] === "pull" &&
      GITHUB_NUMBER_REGEX.test(pathSegments[3] || "")
    ) {
      return {
        kind: "pull",
        number: Number.parseInt(pathSegments[3], 10),
        owner,
        repo,
      };
    }

    return {
      kind: "repo",
      owner,
      repo,
    };
  } catch {
    return null;
  }
};
