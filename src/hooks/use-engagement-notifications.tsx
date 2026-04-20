import {
  IconClockExclamation,
  IconHeart,
  IconHome,
  IconMessageReport,
  IconRefresh,
} from "@tabler/icons-react";
import { type ReactNode, useEffect, useRef } from "react";
import { toast } from "sonner";
import { EngagementToastContent } from "@/features/notifications/engagement-toast-content";
import { readLatestChangelogSummary } from "@/lib/changelog-summary";
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
const REGULAR_FEEDBACK_PROMPT_INTERVAL_MS = 1000 * 60 * 60 * 24 * 14;
const FEEDBACK_TOAST_AFTER_CHANGELOG_DELAY_MS = 4000;
const FEEDBACK_REVIEW_URL =
  "https://chromewebstore.google.com/detail/better-home/mfjbpiocndfighipkbgoepkikcjkfldi/reviews";
const FEEDBACK_REPO_URL = "https://github.com/SatyamVyas04/better-home/issues";
const FALLBACK_CHANGELOG_URL =
  "https://github.com/SatyamVyas04/better-home/blob/main/CHANGELOG.md";

interface UseEngagementNotificationsOptions {
  isReady: boolean;
}

interface FeedbackPromptVariant {
  actionType: "opened-feedback" | "opened-review";
  ctaLabel: string;
  description: string;
  title: string;
  url: string;
  visual: ReactNode;
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

  const changelogSummary = readLatestChangelogSummary();
  const changelogUrl = changelogSummary?.compareUrl ?? FALLBACK_CHANGELOG_URL;
  const releaseDateText = changelogSummary?.releaseDate
    ? ` (${changelogSummary.releaseDate})`
    : "";
  const highlightsText = changelogSummary
    ? changelogSummary.highlights.join(". ")
    : "small improvements and bug fixes are now live";

  toast.custom(
    (toastId) => {
      return (
        <EngagementToastContent
          description={`${highlightsText}.`}
          onPrimaryAction={() => {
            openExternalLink(changelogUrl);
            toast.dismiss(toastId);
          }}
          onSecondaryAction={() => {
            toast.dismiss(toastId);
          }}
          primaryActionLabel="view changelog"
          secondaryActionLabel="close"
          title={`updated to v${APP_VERSION}${releaseDateText}`}
          visual={
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
              <IconRefresh className="size-4" />
            </div>
          }
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
  cadence: "new" | "regular"
): boolean {
  const lastPromptedTimestamp = Date.parse(lastPromptedAt);

  if (!Number.isFinite(lastPromptedTimestamp)) {
    return false;
  }

  const cadenceIntervalMs =
    cadence === "new"
      ? NEW_USER_FEEDBACK_PROMPT_INTERVAL_MS
      : REGULAR_FEEDBACK_PROMPT_INTERVAL_MS;

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
          onPrimaryAction={() => {
            toast.dismiss(toastId);
          }}
          primaryActionLabel="let's go"
          title="welcome to better-home"
          visual={
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
              <IconHome className="size-4" />
            </div>
          }
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
      title: "got ideas for better-home?",
      url: FEEDBACK_REPO_URL,
      visual: (
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400">
          <IconMessageReport className="size-4" />
        </div>
      ),
    };
  }

  return {
    actionType: "opened-review",
    ctaLabel: "leave a review",
    description:
      "your review helps this little project grow and keeps the updates coming.",
    title: "could you share a quick review?",
    url: FEEDBACK_REVIEW_URL,
    visual: (
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-rose-500/35 bg-rose-500/10 text-rose-500">
        <IconHeart className="size-4" />
      </div>
    ),
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

  if (
    !(
      forceShow ||
      shouldShowFeedbackPrompt(
        existingState.lastPromptedAt,
        currentTimestamp,
        cadence
      )
    )
  ) {
    return false;
  }

  await persistFeedbackPromptState({
    cadence: "regular",
    lastAction: "dismissed",
    lastPromptedAt: nowIso,
  });

  const promptVariant = resolveFeedbackPromptVariant(lastAction);

  toast.custom(
    (toastId) => {
      return (
        <EngagementToastContent
          description={promptVariant.description}
          onPrimaryAction={() => {
            persistFeedbackPromptState({
              cadence: "regular",
              lastAction: promptVariant.actionType,
              lastPromptedAt: new Date().toISOString(),
            }).catch(() => null);
            openExternalLink(promptVariant.url);
            toast.dismiss(toastId);
          }}
          onSecondaryAction={() => {
            persistFeedbackPromptState({
              cadence: "regular",
              lastAction: "dismissed",
              lastPromptedAt: new Date().toISOString(),
            }).catch(() => null);
            toast.dismiss(toastId);
          }}
          primaryActionLabel={promptVariant.ctaLabel}
          secondaryActionLabel="maybe later"
          title={promptVariant.title}
          visual={promptVariant.visual}
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
              onPrimaryAction={() => {
                toast.dismiss(toastId);
              }}
              primaryActionLabel="close"
              title="notifications need a retry"
              visual={
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-amber-500/35 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <IconClockExclamation className="size-4" />
                </div>
              }
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
