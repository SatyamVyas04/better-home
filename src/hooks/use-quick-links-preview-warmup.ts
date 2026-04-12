import { useCallback, useEffect, useRef } from "react";
import {
  PREVIEW_EXISTING_LINKS_HYDRATION_MARKER_KEY,
  PREVIEW_EXISTING_LINKS_HYDRATION_START_DELAY_MS,
  PREVIEW_INTERACTION_WARMUP_BATCH_DELAY_MS,
  PREVIEW_INTERACTION_WARMUP_BATCH_SIZE,
  PREVIEW_INTERACTION_WARMUP_INITIAL_LINKS,
  PREVIEW_INTERACTION_WARMUP_SECOND_STAGE_DELAY_MS,
  PREVIEW_MOUNT_WARMUP_MAX_LINKS,
  PREVIEW_MOUNT_WARMUP_START_DELAY_MS,
} from "@/constants/quick-links";
import { APP_VERSION } from "@/lib/extension-storage";
import type { QuickLink } from "@/types/quick-links";

interface UseQuickLinksPreviewWarmupOptions {
  ensureLinkPreview: (url: string) => void;
  getComparableUrl: (url: string) => string;
  links: QuickLink[];
}

interface UseQuickLinksPreviewWarmupResult {
  resetPreviewWarmupState: () => void;
  startInteractionPreviewWarmup: () => void;
}

function readPreviewHydrationMarker(): string {
  try {
    return (
      window.localStorage.getItem(
        PREVIEW_EXISTING_LINKS_HYDRATION_MARKER_KEY
      ) || ""
    );
  } catch {
    return "";
  }
}

function writePreviewHydrationMarker(value: string): void {
  try {
    window.localStorage.setItem(
      PREVIEW_EXISTING_LINKS_HYDRATION_MARKER_KEY,
      value
    );
  } catch {
    return;
  }
}

function buildDedupedWarmupUrls(
  links: QuickLink[],
  getComparableUrl: (url: string) => string
): string[] {
  const seenComparableUrls = new Set<string>();
  const warmupUrls: string[] = [];

  for (const link of links) {
    const comparableUrl = getComparableUrl(link.url);
    if (seenComparableUrls.has(comparableUrl)) {
      continue;
    }

    seenComparableUrls.add(comparableUrl);
    warmupUrls.push(link.url);
  }

  return warmupUrls;
}

async function warmUrlsInSimpleBatches({
  ensureLinkPreview,
  isCancelled,
  urls,
}: {
  ensureLinkPreview: (url: string) => void;
  isCancelled: () => boolean;
  urls: string[];
}): Promise<boolean> {
  for (
    let index = 0;
    index < urls.length;
    index += PREVIEW_INTERACTION_WARMUP_BATCH_SIZE
  ) {
    if (isCancelled()) {
      return false;
    }

    const batchUrls = urls.slice(
      index,
      index + PREVIEW_INTERACTION_WARMUP_BATCH_SIZE
    );

    for (const batchUrl of batchUrls) {
      if (isCancelled()) {
        return false;
      }

      ensureLinkPreview(batchUrl);
    }

    await new Promise<void>((resolve) => {
      window.setTimeout(
        () => resolve(),
        PREVIEW_INTERACTION_WARMUP_BATCH_DELAY_MS
      );
    });
  }

  return !isCancelled();
}

export function useQuickLinksPreviewWarmup({
  ensureLinkPreview,
  getComparableUrl,
  links,
}: UseQuickLinksPreviewWarmupOptions): UseQuickLinksPreviewWarmupResult {
  const hasStartedMountWarmupRef = useRef(false);
  const hasStartedExistingLinksHydrationRef = useRef(false);
  const hasStartedInteractionWarmupRef = useRef(false);
  const interactionWarmupCancelledRef = useRef(false);
  const interactionWarmupTimeoutIdsRef = useRef<number[]>([]);

  const cancelInteractionWarmup = useCallback(() => {
    interactionWarmupCancelledRef.current = true;
    for (const id of interactionWarmupTimeoutIdsRef.current) {
      window.clearTimeout(id);
    }
    interactionWarmupTimeoutIdsRef.current = [];
  }, []);

  const startInteractionPreviewWarmup = useCallback(() => {
    if (hasStartedInteractionWarmupRef.current) {
      return;
    }

    hasStartedInteractionWarmupRef.current = true;
    interactionWarmupCancelledRef.current = false;
    interactionWarmupTimeoutIdsRef.current = [];

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return;
    }

    const seenComparableUrls = new Set<string>();
    const warmupUrls: string[] = [];

    for (const link of links) {
      const comparableUrl = getComparableUrl(link.url);
      if (seenComparableUrls.has(comparableUrl)) {
        continue;
      }

      seenComparableUrls.add(comparableUrl);
      warmupUrls.push(link.url);
    }

    if (warmupUrls.length === 0) {
      return;
    }

    const initialWarmupUrls = warmupUrls.slice(
      0,
      PREVIEW_INTERACTION_WARMUP_INITIAL_LINKS
    );
    const backgroundWarmupUrls = warmupUrls.slice(
      PREVIEW_INTERACTION_WARMUP_INITIAL_LINKS
    );

    const warmUrlsInBatches = async (urls: string[]) => {
      for (
        let index = 0;
        index < urls.length;
        index += PREVIEW_INTERACTION_WARMUP_BATCH_SIZE
      ) {
        if (interactionWarmupCancelledRef.current) {
          return;
        }

        const batchUrls = urls.slice(
          index,
          index + PREVIEW_INTERACTION_WARMUP_BATCH_SIZE
        );

        for (const batchUrl of batchUrls) {
          if (interactionWarmupCancelledRef.current) {
            return;
          }

          ensureLinkPreview(batchUrl);
        }

        await new Promise<void>((resolve) => {
          const timeoutId = window.setTimeout(
            () => resolve(),
            PREVIEW_INTERACTION_WARMUP_BATCH_DELAY_MS
          );
          interactionWarmupTimeoutIdsRef.current.push(timeoutId);
        });
      }
    };

    const warmProgressively = async () => {
      await warmUrlsInBatches(initialWarmupUrls);

      if (
        backgroundWarmupUrls.length === 0 ||
        interactionWarmupCancelledRef.current
      ) {
        return;
      }

      await new Promise<void>((resolve) => {
        const timeoutId = window.setTimeout(
          () => resolve(),
          PREVIEW_INTERACTION_WARMUP_SECOND_STAGE_DELAY_MS
        );
        interactionWarmupTimeoutIdsRef.current.push(timeoutId);
      });

      await warmUrlsInBatches(backgroundWarmupUrls);
    };

    warmProgressively().catch(() => null);
  }, [ensureLinkPreview, getComparableUrl, links]);

  useEffect(() => {
    return () => {
      cancelInteractionWarmup();
    };
  }, [cancelInteractionWarmup]);

  useEffect(() => {
    if (hasStartedMountWarmupRef.current) {
      return;
    }

    hasStartedMountWarmupRef.current = true;

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return;
    }

    const seenComparableUrls = new Set<string>();
    const warmupUrls: string[] = [];

    for (const link of links) {
      const comparableUrl = getComparableUrl(link.url);
      if (seenComparableUrls.has(comparableUrl)) {
        continue;
      }

      seenComparableUrls.add(comparableUrl);
      warmupUrls.push(link.url);

      if (warmupUrls.length >= PREVIEW_MOUNT_WARMUP_MAX_LINKS) {
        break;
      }
    }

    if (warmupUrls.length === 0) {
      return;
    }

    let isCancelled = false;
    const warmupTimeoutId = window.setTimeout(() => {
      warmUrlsInSimpleBatches({
        ensureLinkPreview,
        isCancelled: () => isCancelled,
        urls: warmupUrls,
      }).catch(() => null);
    }, PREVIEW_MOUNT_WARMUP_START_DELAY_MS);

    return () => {
      isCancelled = true;
      window.clearTimeout(warmupTimeoutId);
    };
  }, [ensureLinkPreview, getComparableUrl, links]);

  useEffect(() => {
    if (hasStartedExistingLinksHydrationRef.current) {
      return;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return;
    }

    if (readPreviewHydrationMarker() === APP_VERSION) {
      hasStartedExistingLinksHydrationRef.current = true;
      return;
    }

    hasStartedExistingLinksHydrationRef.current = true;

    const warmupUrls = buildDedupedWarmupUrls(links, getComparableUrl);
    if (warmupUrls.length === 0) {
      writePreviewHydrationMarker(APP_VERSION);
      return;
    }

    let isCancelled = false;
    const hydrationTimeoutId = window.setTimeout(() => {
      const hydrateExistingLinks = async () => {
        const completed = await warmUrlsInSimpleBatches({
          ensureLinkPreview,
          isCancelled: () => isCancelled,
          urls: warmupUrls,
        });

        if (completed) {
          writePreviewHydrationMarker(APP_VERSION);
        }
      };

      hydrateExistingLinks().catch(() => null);
    }, PREVIEW_EXISTING_LINKS_HYDRATION_START_DELAY_MS);

    return () => {
      isCancelled = true;
      window.clearTimeout(hydrationTimeoutId);
    };
  }, [ensureLinkPreview, getComparableUrl, links]);

  const resetPreviewWarmupState = useCallback(() => {
    hasStartedMountWarmupRef.current = false;
    hasStartedInteractionWarmupRef.current = false;
    cancelInteractionWarmup();
  }, [cancelInteractionWarmup]);

  return {
    resetPreviewWarmupState,
    startInteractionPreviewWarmup,
  };
}
