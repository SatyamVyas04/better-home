import { Button } from "@/components/ui/button";

interface EngagementToastContentProps {
  description: string;
  mascotAlt?: string;
  mascotSrc?: string;
  onPrimaryAction: () => void;
  onSecondaryAction?: () => void;
  primaryActionLabel: string;
  secondaryActionLabel?: string;
  title: string;
}

export function EngagementToastContent({
  description,
  mascotAlt,
  mascotSrc,
  onPrimaryAction,
  onSecondaryAction,
  primaryActionLabel,
  secondaryActionLabel,
  title,
}: EngagementToastContentProps) {
  return (
    <div
      aria-live="polite"
      className="relative w-[min(360px,calc(100vw-2.25rem))] overflow-visible px-1 py-0.5"
    >
      {mascotSrc ? (
        <div className="pointer-events-none absolute -top-2 -left-20 z-10 flex items-start">
          <img
            alt={mascotAlt ?? "better-home mascot"}
            className="h-20 w-auto select-none drop-shadow-sm"
            height={80}
            src={mascotSrc}
            width={80}
          />
        </div>
      ) : null}

      <div className="min-w-0 pl-4">
        <p className="font-medium text-[12px] text-foreground leading-snug">
          {title}
        </p>
        <p className="mt-1 whitespace-pre-line text-[11px] text-muted-foreground leading-relaxed">
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
