import { IconCheck, IconPlus } from "@tabler/icons-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { OverlappingLabelInput } from "@/components/ui/overlapping-label-input";
import { EASE_IN_OUT, EASE_OUT } from "@/constants/quick-links";
import type { UseQuickLinksAddFlowResult } from "@/hooks/use-quick-links-add-flow";
import { useUnicodeSpinnerFrame } from "@/hooks/use-unicode-spinner-frame";

interface QuickLinksAddFlowProps {
  controller: UseQuickLinksAddFlowResult;
}

export function QuickLinksAddFlow({ controller }: QuickLinksAddFlowProps) {
  const loadingSpinnerFrame = useUnicodeSpinnerFrame("diagswipe");

  return (
    <div className="relative h-10 overflow-y-visible rounded-md">
      <motion.div
        animate={{
          opacity: controller.isUrlEntryStage ? 1 : 0,
          x: controller.isUrlEntryStage ? "0%" : "-105%",
        }}
        aria-hidden={!controller.isUrlEntryStage}
        className={`absolute inset-x-0 top-0 flex items-start gap-1 ${controller.isUrlEntryStage ? "pointer-events-auto" : "pointer-events-none"}`}
        initial={false}
        transition={{ duration: 0.18, ease: EASE_OUT }}
      >
        <OverlappingLabelInput
          className="h-8 flex-1 text-xs"
          containerClassName="flex-1"
          disabled={!controller.isUrlEntryStage}
          label="press enter to fetch title"
          labelClassName="bottom-0 left-2 text-[9px]"
          onChange={(event) =>
            controller.handleUrlInputChange(event.target.value)
          }
          onKeyDown={controller.handleUrlInputKeyDown}
          placeholder="add a link..."
          ref={controller.urlInputRef}
          tabIndex={controller.isUrlEntryStage ? 0 : -1}
          value={controller.newUrl}
        />
        <Button
          className="h-8 w-8"
          disabled={!controller.canAdvanceFromUrlStage}
          onClick={controller.handlePrimaryAction}
          size="icon"
          tabIndex={controller.isUrlEntryStage ? 0 : -1}
          type="button"
        >
          <IconPlus className="size-4" />
          <span className="sr-only">Fetch title</span>
        </Button>
      </motion.div>

      <motion.div
        animate={{
          opacity: controller.isUrlEntryStage ? 0 : 1,
          x: controller.isUrlEntryStage ? "105%" : "0%",
        }}
        aria-hidden={!controller.isTitleEntryStage}
        className={`absolute inset-0 top-0 flex items-start gap-1 ${controller.isUrlEntryStage ? "pointer-events-none" : "pointer-events-auto"}`}
        initial={false}
        transition={{ duration: 0.2, ease: EASE_IN_OUT }}
      >
        <OverlappingLabelInput
          className="h-8 flex-1 text-xs"
          containerClassName="flex-1"
          disabled={
            !controller.isTitleEntryStage || controller.isTitleLoadingStage
          }
          label={
            controller.isTitleLoadingStage
              ? "loading title"
              : "press esc to edit url"
          }
          labelClassName="bottom-0 left-2 text-[9px]"
          onChange={(event) =>
            controller.handleTitleInputChange(event.target.value)
          }
          onKeyDown={controller.handleTitleInputKeyDown}
          placeholder="edit title..."
          ref={controller.titleInputRef}
          tabIndex={
            controller.isTitleEntryStage && !controller.isTitleLoadingStage
              ? 0
              : -1
          }
          value={controller.newTitle}
        />
        <Button
          className="h-8 w-8"
          disabled={
            !controller.isTitleEntryStage || controller.isTitleLoadingStage
          }
          onClick={controller.handlePrimaryAction}
          size="icon"
          tabIndex={
            controller.isTitleEntryStage && !controller.isTitleLoadingStage
              ? 0
              : -1
          }
          type="button"
        >
          {controller.isTitleLoadingStage ? (
            <span
              aria-hidden="true"
              className="inline-flex w-4 justify-center font-mono text-[11px] leading-none"
            >
              {loadingSpinnerFrame}
            </span>
          ) : (
            <IconCheck className="size-4" />
          )}
          <span className="sr-only">{controller.primaryButtonLabel}</span>
        </Button>
      </motion.div>
    </div>
  );
}
