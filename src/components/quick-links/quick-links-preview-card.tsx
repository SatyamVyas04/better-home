import { IconLoader2 } from "@tabler/icons-react";
import { AnimatePresence, motion } from "motion/react";
import { PreviewFallbackMedia } from "@/components/quick-links/preview-fallback-media";
import { Card } from "@/components/ui/card";
import {
  EASE_IN_OUT,
  PREVIEW_CARD_HEIGHT,
  PREVIEW_CARD_WIDTH,
  PREVIEW_MEDIA_HEIGHT,
  previewContentSwapVariants,
} from "@/constants/quick-links";
import type { QuickLinksPreviewCardProps } from "@/types/quick-links";

export function QuickLinksPreviewCard({
  activePreviewDisplayTitle,
  activePreviewImageUrl,
  activePreviewLink,
  activePreviewMetadataDescriptionText,
  activePreviewMetadataTitleText,
  activePreviewPlatform,
  activePreviewUserTitleText,
  expanded,
  hasActivePreviewImage,
  isActivePreviewImageMarkedFailed,
  isActivePreviewLoading,
  previewContentDirection,
  previewPosition,
}: QuickLinksPreviewCardProps) {
  return (
    <AnimatePresence>
      {!expanded && activePreviewLink ? (
        <motion.div
          animate={{
            opacity: 1,
            scale: 1,
            x: previewPosition.x,
            y: previewPosition.y,
          }}
          className="pointer-events-none fixed top-0 left-0 z-70"
          exit={{ opacity: 0, scale: 0.975 }}
          initial={{
            opacity: 0,
            scale: 0.97,
            x: previewPosition.x,
            y: previewPosition.y,
          }}
          style={{
            width: PREVIEW_CARD_WIDTH,
          }}
          transition={{
            damping: 34,
            mass: 0.58,
            stiffness: 360,
            type: "spring",
          }}
        >
          <Card
            className="relative min-h-0 gap-0 overflow-hidden rounded-[10px] border border-border/50 bg-card py-0 text-foreground shadow-[0_24px_50px_-24px_hsl(var(--foreground)/0.55)] backdrop-blur-2xl"
            style={{ height: PREVIEW_CARD_HEIGHT }}
          >
            <AnimatePresence
              custom={previewContentDirection}
              initial={false}
              mode="sync"
            >
              <motion.div
                animate="center"
                className="absolute inset-0 flex min-h-0 flex-col"
                custom={previewContentDirection}
                exit="exit"
                initial="enter"
                key={activePreviewLink.id}
                transition={{ duration: 0.24, ease: EASE_IN_OUT }}
                variants={previewContentSwapVariants}
              >
                <div
                  className="relative w-full shrink-0 overflow-hidden border-border/35 border-b"
                  style={{ height: PREVIEW_MEDIA_HEIGHT }}
                >
                  {hasActivePreviewImage &&
                  !isActivePreviewImageMarkedFailed ? (
                    <img
                      alt={activePreviewDisplayTitle}
                      className="block h-full w-full object-cover object-center"
                      decoding="async"
                      fetchPriority="high"
                      height={PREVIEW_MEDIA_HEIGHT}
                      loading="eager"
                      src={activePreviewImageUrl}
                      width={PREVIEW_CARD_WIDTH}
                    />
                  ) : (
                    <PreviewFallbackMedia
                      favicon={activePreviewLink.favicon}
                      platform={activePreviewPlatform}
                      title={activePreviewDisplayTitle}
                    />
                  )}
                  <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/28 via-black/5 to-transparent" />
                  {isActivePreviewLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/25 backdrop-blur-[1px]">
                      <IconLoader2 className="size-4 animate-spin text-white" />
                    </div>
                  ) : null}
                </div>

                <div className="flex min-h-0 flex-1 flex-col px-3.5 pt-2.5 pb-1">
                  <p className="min-w-0 overflow-hidden text-[12px] normal-case leading-4 tracking-tight [-webkit-box-orient:vertical] [-webkit-line-clamp:1] [display:-webkit-box]">
                    {activePreviewUserTitleText}
                  </p>
                  <p className="min-h-7 min-w-0 overflow-hidden text-[11px] text-muted-foreground/75 normal-case leading-3.5 tracking-normal [-webkit-box-orient:vertical] [-webkit-line-clamp:2] [display:-webkit-box]">
                    {activePreviewMetadataDescriptionText}
                  </p>
                  <div className="mt-auto border-border/35 border-t pt-1.5">
                    <p className="w-full truncate text-[10px] text-muted-foreground/70 normal-case">
                      {activePreviewMetadataTitleText}
                    </p>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </Card>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
