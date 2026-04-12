import { useCallback, useEffect, useRef } from "react";
import {
  PREVIEW_INTERACTION_WARMUP_BATCH_DELAY_MS,
  PREVIEW_INTERACTION_WARMUP_BATCH_SIZE,
  PREVIEW_INTERACTION_WARMUP_INITIAL_LINKS,
  PREVIEW_INTERACTION_WARMUP_SECOND_STAGE_DELAY_MS,
  PREVIEW_MOUNT_WARMUP_MAX_LINKS,
  PREVIEW_MOUNT_WARMUP_START_DELAY_MS,
} from "@/constants/quick-links";
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

export function useQuickLinksPreviewWarmup({
  ensureLinkPreview,
  getComparableUrl,
  links,
}: UseQuickLinksPreviewWarmupOptions): UseQuickLinksPreviewWarmupResult {
  const hasStartedMountWarmupRef = useRef(false);
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
      const warmPreviews = async () => {
        for (
          let index = 0;
          index < warmupUrls.length;
          index += PREVIEW_INTERACTION_WARMUP_BATCH_SIZE
        ) {
          if (isCancelled) {
            return;
          }

          const batchUrls = warmupUrls.slice(
            index,
            index + PREVIEW_INTERACTION_WARMUP_BATCH_SIZE
          );

          for (const warmupUrl of batchUrls) {
            if (isCancelled) {
              return;
            }

            ensureLinkPreview(warmupUrl);
          }

          await new Promise<void>((resolve) => {
            window.setTimeout(
              () => resolve(),
              PREVIEW_INTERACTION_WARMUP_BATCH_DELAY_MS
            );
          });
        }
      };

      warmPreviews().catch(() => null);
    }, PREVIEW_MOUNT_WARMUP_START_DELAY_MS);

    return () => {
      isCancelled = true;
      window.clearTimeout(warmupTimeoutId);
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
