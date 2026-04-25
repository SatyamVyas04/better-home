import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { EngagementToastContent } from "@/features/notifications/engagement-toast-content";
import {
  APP_VERSION,
  persistChangelogLastSeenVersion,
  persistFeedbackPromptState,
  readChangelogLastSeenVersion,
  readFeedbackPromptState,
} from "@/lib/extension-storage";
import { compareAppVersions } from "@/lib/version-utils";

const CHANGELOG_TOAST_ID = `better-home-changelog-${APP_VERSION}`;
const FEEDBACK_TOAST_ID = "better-home-feedback-review";
const WELCOME_TOAST_ID = "better-home-welcome";
const NEW_USER_FEEDBACK_PROMPT_INTERVAL_MS = 1000 * 60 * 60 * 24;
const REGULAR_FEEDBACK_PROMPT_INTERVAL_MS = 1000 * 60 * 60 * 24 * 3;
const REVIEW_COMPLETED_FEEDBACK_PROMPT_INTERVAL_MS = 1000 * 60 * 60 * 24 * 14;
const FEEDBACK_TOAST_AFTER_CHANGELOG_DELAY_MS = 4000;
const FEEDBACK_REVIEW_URL =
  "https://chromewebstore.google.com/detail/better-home/mfjbpiocndfighipkbgoepkikcjkfldi/reviews";
const FEEDBACK_REPO_URL = "https://github.com/SatyamVyas04/better-home/issues";
const GITHUB_RELEASE_URL = `https://github.com/SatyamVyas04/better-home/releases/tag/v${APP_VERSION}`;
const MASCOT_WELCOME_SRC = "/mascots/mascot-welcome.png";
const MASCOT_UPDATE_SRC = "/mascots/mascot-update.png";
const MASCOT_REVIEW_SRC = "/mascots/mascot-review.png";
const MASCOT_FEEDBACK_SRC = "/mascots/mascot-feedback.png";
const MASCOT_ERROR_SRC = "/mascots/mascot-error.png";

interface UseEngagementNotificationsOptions {
  isReady: boolean;
}

interface FeedbackPromptVariant {
  actionType: "opened-feedback" | "opened-review";
  ctaLabel: string;
  description: string;
  mascotAlt: string;
  mascotSrc: string;
  title: string;
  url: string;
}

interface MaybeShowFeedbackPromptOptions {
  forceShow?: boolean;
}

function openExternalLink(url: string): void {
  window.open(url, "_blank", "noopener,noreferrer");
}

async function maybeShowChangelogToast(): Promise<boolean> {
  const lastSeenVersion = await readChangelogLastSeenVersion();

  if (!lastSeenVersion) {
    await persistChangelogLastSeenVersion(APP_VERSION);
    return false;
  }

  const versionComparison = compareAppVersions(lastSeenVersion, APP_VERSION);

  if (versionComparison >= 0) {
    if (versionComparison !== 0) {
      await persistChangelogLastSeenVersion(APP_VERSION);
    }

    return false;
  }

  await persistChangelogLastSeenVersion(APP_VERSION);

  const changelogUrl = GITHUB_RELEASE_URL;

  toast.custom(
    (toastId) => {
      return (
        <EngagementToastContent
          description="check out the release notes for all the details."
          mascotAlt="update mascot"
          mascotSrc={MASCOT_UPDATE_SRC}
          onPrimaryAction={() => {
            openExternalLink(changelogUrl);
            toast.dismiss(toastId);
          }}
          onSecondaryAction={() => {
            toast.dismiss(toastId);
          }}
          primaryActionLabel="view release"
          secondaryActionLabel="close"
          title={`updated to v${APP_VERSION}`}
        />
      );
    },
    {
      duration: 12_000,
      id: CHANGELOG_TOAST_ID,
    }
  );

  return true;
}

function shouldShowFeedbackPrompt(
  lastPromptedAt: string,
  currentTimestamp: number,
  cadence: "new" | "regular",
  lastAction: "dismissed" | "opened-feedback" | "opened-review" | undefined
): boolean {
  const lastPromptedTimestamp = Date.parse(lastPromptedAt);

  if (!Number.isFinite(lastPromptedTimestamp)) {
    return false;
  }

  let cadenceIntervalMs = REGULAR_FEEDBACK_PROMPT_INTERVAL_MS;

  if (cadence === "new") {
    cadenceIntervalMs = NEW_USER_FEEDBACK_PROMPT_INTERVAL_MS;
  } else if (lastAction === "opened-review") {
    cadenceIntervalMs = REVIEW_COMPLETED_FEEDBACK_PROMPT_INTERVAL_MS;
  }

  return currentTimestamp - lastPromptedTimestamp >= cadenceIntervalMs;
}

async function maybeShowWelcomeToast(): Promise<boolean> {
  const existingState = await readFeedbackPromptState();

  if (existingState) {
    return false;
  }

  await persistFeedbackPromptState({
    cadence: "new",
    lastAction: "dismissed",
    lastPromptedAt: new Date().toISOString(),
  });

  toast.custom(
    (toastId) => {
      return (
        <EngagementToastContent
          description="start with your daily essentials in one place: tasks, quick links, and mood tracking."
          mascotAlt="welcome mascot"
          mascotSrc={MASCOT_WELCOME_SRC}
          onPrimaryAction={() => {
            toast.dismiss(toastId);
          }}
          primaryActionLabel="let's go"
          title="welcome to better-home"
        />
      );
    },
    {
      duration: 10_000,
      id: WELCOME_TOAST_ID,
    }
  );

  return true;
}

function resolveFeedbackPromptVariant(
  lastAction: "dismissed" | "opened-feedback" | "opened-review" | undefined
): FeedbackPromptVariant {
  if (lastAction === "opened-review" || lastAction === "opened-feedback") {
    return {
      actionType: "opened-feedback",
      ctaLabel: "share feedback",
      description:
        "thanks for supporting us. if you spot anything we can improve, tell us on github.",
      mascotAlt: "feedback mascot",
      mascotSrc: MASCOT_FEEDBACK_SRC,
      title: "got ideas for better-home?",
      url: FEEDBACK_REPO_URL,
    };
  }

  return {
    actionType: "opened-review",
    ctaLabel: "leave a review",
    description:
      "your review helps this little project grow and keeps the updates coming.",
    mascotAlt: "review mascot",
    mascotSrc: MASCOT_REVIEW_SRC,
    title: "could you share a quick review?",
    url: FEEDBACK_REVIEW_URL,
  };
}

async function maybeShowFeedbackPrompt(
  options: MaybeShowFeedbackPromptOptions = {}
): Promise<boolean> {
  const { forceShow = false } = options;
  const now = new Date();
  const nowIso = now.toISOString();
  const currentTimestamp = now.getTime();
  let existingState = await readFeedbackPromptState();

  if (!existingState) {
    existingState = {
      cadence: "new",
      lastAction: "dismissed",
      lastPromptedAt: nowIso,
    };

    await persistFeedbackPromptState(existingState);

    if (!forceShow) {
      return false;
    }
  }

  const lastAction = existingState.lastAction;
  const cadence = existingState.cadence ?? "regular";
  const hasOpenedReviewBefore = lastAction === "opened-review";

  if (
    !(
      forceShow ||
      shouldShowFeedbackPrompt(
        existingState.lastPromptedAt,
        currentTimestamp,
        cadence,
        lastAction
      )
    )
  ) {
    return false;
  }

  await persistFeedbackPromptState({
    cadence: "regular",
    lastAction: hasOpenedReviewBefore ? "opened-review" : "dismissed",
    lastPromptedAt: nowIso,
  });

  const promptVariant = resolveFeedbackPromptVariant(lastAction);

  toast.custom(
    (toastId) => {
      return (
        <EngagementToastContent
          description={promptVariant.description}
          mascotAlt={promptVariant.mascotAlt}
          mascotSrc={promptVariant.mascotSrc}
          onPrimaryAction={() => {
            const nextAction = hasOpenedReviewBefore
              ? "opened-review"
              : promptVariant.actionType;

            persistFeedbackPromptState({
              cadence: "regular",
              lastAction: nextAction,
              lastPromptedAt: new Date().toISOString(),
            }).catch(() => null);
            openExternalLink(promptVariant.url);
            toast.dismiss(toastId);
          }}
          onSecondaryAction={() => {
            const nextAction = hasOpenedReviewBefore
              ? "opened-review"
              : "dismissed";

            persistFeedbackPromptState({
              cadence: "regular",
              lastAction: nextAction,
              lastPromptedAt: new Date().toISOString(),
            }).catch(() => null);
            toast.dismiss(toastId);
          }}
          primaryActionLabel={promptVariant.ctaLabel}
          secondaryActionLabel="maybe later"
          title={promptVariant.title}
        />
      );
    },
    {
      duration: 14_000,
      id: FEEDBACK_TOAST_ID,
    }
  );

  return true;
}

export function useEngagementNotifications({
  isReady,
}: UseEngagementNotificationsOptions): void {
  const hasProcessedRef = useRef(false);
  const delayedFeedbackTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isReady || hasProcessedRef.current) {
      return () => null;
    }

    hasProcessedRef.current = true;

    const runNotifications = async () => {
      const hasShownChangelog = await maybeShowChangelogToast();

      if (hasShownChangelog) {
        delayedFeedbackTimerRef.current = globalThis.setTimeout(() => {
          maybeShowFeedbackPrompt({ forceShow: true }).catch(() => null);
        }, FEEDBACK_TOAST_AFTER_CHANGELOG_DELAY_MS);
        return;
      }

      const hasShownWelcome = await maybeShowWelcomeToast();

      if (hasShownWelcome) {
        return;
      }

      await maybeShowFeedbackPrompt();
    };

    runNotifications().catch(() => {
      toast.custom(
        (toastId) => {
          return (
            <EngagementToastContent
              description="we hit a small snag while preparing updates."
              mascotAlt="error mascot"
              mascotSrc={MASCOT_ERROR_SRC}
              onPrimaryAction={() => {
                toast.dismiss(toastId);
              }}
              primaryActionLabel="close"
              title="notifications need a retry"
            />
          );
        },
        {
          duration: 6000,
          id: "better-home-notifications-fallback",
        }
      );
    });

    return () => {
      if (delayedFeedbackTimerRef.current !== null) {
        globalThis.clearTimeout(delayedFeedbackTimerRef.current);
      }
    };
  }, [isReady]);
}
