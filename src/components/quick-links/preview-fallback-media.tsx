import {
  IconBrandGithub,
  IconBrandX,
  IconBrandYoutube,
  IconSparkles,
} from "@tabler/icons-react";
import type { PreviewFallbackMediaProps } from "@/types/quick-links";

export function PreviewFallbackMedia({
  platform,
  favicon,
  title,
}: PreviewFallbackMediaProps) {
  let logo = <IconSparkles className="size-7 text-muted-foreground" />;

  if (favicon) {
    logo = (
      <img
        alt={title}
        className="size-8 rounded-md"
        height={32}
        loading="lazy"
        src={favicon}
        width={32}
      />
    );
  } else if (platform === "youtube") {
    logo = <IconBrandYoutube className="size-8 text-red-500" />;
  } else if (platform === "x") {
    logo = <IconBrandX className="size-7 text-foreground/90" />;
  } else if (platform === "github") {
    logo = <IconBrandGithub className="size-7 text-foreground/90" />;
  }

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-linear-to-br from-sky-500/20 via-emerald-500/10 to-amber-500/20 dark:from-sky-900/50 dark:via-emerald-900/35 dark:to-amber-900/45">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.4),transparent_55%)] dark:bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.09),transparent_55%)]" />
      <div className="relative z-10 flex size-14 items-center justify-center rounded-2xl border border-border/55 bg-card/80 shadow-sm backdrop-blur">
        {logo}
      </div>
    </div>
  );
}
