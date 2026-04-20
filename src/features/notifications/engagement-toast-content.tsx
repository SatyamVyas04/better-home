import { IconHeart } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface EngagementToastContentProps {
  description: string;
  onPrimaryAction: () => void;
  onSecondaryAction?: () => void;
  primaryActionLabel: string;
  secondaryActionLabel?: string;
  title: string;
  visual?: ReactNode;
}

const DEFAULT_VISUAL = (
  <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
    <IconHeart className="size-4" />
  </div>
);

export function EngagementToastContent({
  description,
  onPrimaryAction,
  onSecondaryAction,
  primaryActionLabel,
  secondaryActionLabel,
  title,
  visual,
}: EngagementToastContentProps) {
  return (
    <div
      aria-live="polite"
      className="flex w-[min(360px,calc(100vw-2.25rem))] items-start gap-3 px-1 py-0.5"
    >
      {visual ?? DEFAULT_VISUAL}
      <div className="min-w-0 flex-1">
        <p className="font-medium text-[12px] text-foreground leading-snug">
          {title}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
          {description}
        </p>
        <div className="mt-2.5 flex flex-wrap items-center justify-end gap-1.5">
          <Button
            className="h-6 px-2 text-[10px]"
            onClick={onPrimaryAction}
            size="xs"
            type="button"
            variant="default"
          >
            {primaryActionLabel}
          </Button>
          {secondaryActionLabel && onSecondaryAction ? (
            <Button
              className="h-6 px-2 text-[10px]"
              onClick={onSecondaryAction}
              size="xs"
              type="button"
              variant="secondary"
            >
              {secondaryActionLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
