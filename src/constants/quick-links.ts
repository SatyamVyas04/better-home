export const WWW_PREFIX_REGEX = /^www\./i;
export const PREVIEW_CARD_WIDTH = 360;
export const PREVIEW_MEDIA_ASPECT_RATIO = 1.91;
export const PREVIEW_MEDIA_HEIGHT = Math.round(
  PREVIEW_CARD_WIDTH / PREVIEW_MEDIA_ASPECT_RATIO
);
export const PREVIEW_CARD_BODY_HEIGHT = 96;
export const PREVIEW_CARD_HEIGHT =
  PREVIEW_MEDIA_HEIGHT + PREVIEW_CARD_BODY_HEIGHT;
export const PREVIEW_POINTER_OFFSET_X = 12;
export const PREVIEW_POINTER_OFFSET_Y = 10;
export const PREVIEW_CARD_VIEWPORT_GUTTER = 4;
export const PREVIEW_OPEN_DELAY_MS = 150;
export const PREVIEW_CLOSE_DELAY_MS = 130;
export const PREVIEW_DESCRIPTION_MIN_CHARACTERS = 80;
export const PREVIEW_MOUNT_WARMUP_MAX_LINKS = 24;
export const PREVIEW_MOUNT_WARMUP_START_DELAY_MS = 120;
export const PREVIEW_INTERACTION_WARMUP_INITIAL_LINKS = 16;
export const PREVIEW_INTERACTION_WARMUP_BATCH_SIZE = 4;
export const PREVIEW_INTERACTION_WARMUP_BATCH_DELAY_MS = 70;
export const PREVIEW_INTERACTION_WARMUP_SECOND_STAGE_DELAY_MS = 220;
export const PREVIEW_CONTENT_SWAP_DISTANCE_PX = 40;
export const URL_SEGMENT_SEPARATOR_REGEX = /[-_]+/g;
export const EASE_OUT = [0.23, 1, 0.32, 1] as const;
export const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const;

export const previewContentSwapVariants = {
  center: {
    filter: "blur(0px)",
    opacity: 1,
    x: 0,
  },
  enter: (direction: number) => ({
    filter: "blur(4px)",
    opacity: 0,
    x: direction * PREVIEW_CONTENT_SWAP_DISTANCE_PX,
  }),
  exit: (direction: number) => ({
    filter: "blur(4px)",
    opacity: 0,
    x: direction * -PREVIEW_CONTENT_SWAP_DISTANCE_PX,
  }),
};
