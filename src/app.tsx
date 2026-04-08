import {
  IconAlertCircle,
  IconBrandGithub,
  IconBrandX,
  IconHeart,
  IconRefresh,
} from "@tabler/icons-react";
import { useEffect } from "react";
import { ThemeProvider } from "@/components/theme-provider/theme-provider";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { BackupWidget } from "@/components/widgets/backup-widget/backup-widget";
import { renderWidget } from "@/components/widgets/widget-registry";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useStorageMigration } from "@/hooks/use-storage-migration";
import { writeAppStorageRaw } from "@/lib/extension-storage";
import {
  DEFAULT_WIDGET_SETTINGS,
  type WidgetSettings,
} from "@/types/widget-settings";

interface ChromeMessage {
  type: string;
  theme?: string;
}

declare const chrome: {
  runtime?: {
    onMessage?: {
      addListener: (
        callback: (
          message: ChromeMessage,
          sender: unknown,
          sendResponse: unknown
        ) => void
      ) => void;
      removeListener: (
        callback: (
          message: ChromeMessage,
          sender: unknown,
          sendResponse: unknown
        ) => void
      ) => void;
    };
  };
};

type LayoutKey =
  | "none"
  | "tasks"
  | "links"
  | "calendar"
  | "tasks-links"
  | "tasks-calendar"
  | "links-calendar"
  | "all";

function getLayoutKey(settings: WidgetSettings): LayoutKey {
  const { showTasks, showQuickLinks, showCalendar } = settings;
  const flags = `${showTasks ? "1" : "0"}${showQuickLinks ? "1" : "0"}${showCalendar ? "1" : "0"}`;

  const mapping: Record<string, LayoutKey> = {
    "000": "none",
    100: "tasks",
    "010": "links",
    "001": "calendar",
    110: "tasks-links",
    101: "tasks-calendar",
    "011": "links-calendar",
    111: "all",
  };

  return mapping[flags] || "none";
}

function App() {
  const [settings] = useLocalStorage<WidgetSettings>(
    "better-home-widget-settings",
    DEFAULT_WIDGET_SETTINGS
  );
  const { status: migrationStatus, retryMigration } = useStorageMigration();

  useEffect(() => {
    const handleThemeMessage = (
      message: ChromeMessage,
      _sender: unknown,
      _sendResponse: unknown
    ) => {
      if (message.type === "THEME_CHANGED" && message.theme) {
        const root = window.document.documentElement;
        root.classList.remove("light", "dark");
        root.classList.add(message.theme);
        writeAppStorageRaw("vite-ui-theme", message.theme).catch(() => null);
      }
    };

    chrome?.runtime?.onMessage?.addListener?.(handleThemeMessage);

    return () => {
      chrome?.runtime?.onMessage?.removeListener?.(handleThemeMessage);
    };
  }, []);

  const layoutKey = getLayoutKey(settings);

  const layouts: Record<LayoutKey, React.ReactNode> = {
    none: (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground text-sm lowercase">
          no widgets enabled *_*
        </p>
      </div>
    ),
    tasks: (
      <div className="flex min-h-0 flex-1">{renderWidget("tasks", "full")}</div>
    ),
    links: (
      <div className="flex min-h-0 flex-1">
        {renderWidget("quick-links", "full")}
      </div>
    ),
    calendar: (
      <div className="flex min-h-0 flex-1">{renderWidget("calendar")}</div>
    ),
    "tasks-links": (
      <div className="flex min-h-0 flex-1 flex-col gap-3 md:flex-row">
        <div className="flex min-h-0 flex-1">
          {renderWidget("tasks", "full")}
        </div>
        <div className="flex min-h-0 flex-1">
          {renderWidget("quick-links", "full")}
        </div>
      </div>
    ),
    "tasks-calendar": (
      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        <div className="flex min-h-0 shrink-0">{renderWidget("tasks")}</div>
        <div className="flex min-h-0 min-w-0 flex-1">
          {renderWidget("calendar")}
        </div>
      </div>
    ),
    "links-calendar": (
      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        <div className="flex min-h-0 shrink-0">
          {renderWidget("quick-links", "expanded")}
        </div>
        <div className="flex min-h-0 min-w-0 flex-1">
          {renderWidget("calendar")}
        </div>
      </div>
    ),
    all: (
      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        <div className="flex min-h-0 shrink-0 flex-col gap-3">
          {renderWidget("tasks")}
          {renderWidget("quick-links")}
        </div>
        <div className="flex min-h-0 min-w-0 flex-1">
          {renderWidget("calendar")}
        </div>
      </div>
    ),
  };

  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <div className="flex h-screen flex-col overflow-hidden bg-background">
        {migrationStatus.state === "error" && (
          <div className="mx-3 mt-3 flex items-center justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-[11px] text-destructive">
            <div className="flex min-w-0 items-center gap-1.5">
              <IconAlertCircle className="size-3.5 shrink-0" />
              <span className="truncate">
                {migrationStatus.message}
                {migrationStatus.details ? ` · ${migrationStatus.details}` : ""}
              </span>
            </div>
            <Button
              className="h-5 shrink-0 px-1.5 text-[10px] text-destructive hover:bg-destructive/15"
              onClick={() => {
                retryMigration().catch(() => null);
              }}
              size="xs"
              type="button"
              variant="ghost"
            >
              <IconRefresh className="size-3" />
              retry
            </Button>
          </div>
        )}

        <main className="flex min-h-0 flex-1 flex-col p-3">
          {layouts[layoutKey]}
        </main>

        <footer className="border-border border-t bg-card py-1">
          <TooltipProvider delayDuration={200}>
            <div className="flex w-full items-center overflow-hidden px-3 text-muted-foreground text-xs">
              <div className="flex shrink-0 items-center gap-2 pr-3">
                <a
                  className="flex shrink-0 items-center gap-2 transition-colors hover:text-foreground"
                  href="https://github.com/SatyamVyas04/better-home"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <img
                    alt="better-home logo"
                    className="size-4 shrink-0"
                    height={16}
                    src="/better-home-logo-48.png"
                    width={16}
                  />
                  <span className="font-medium text-foreground">
                    better-home
                  </span>
                </a>
              </div>

              <span className="h-4 w-px shrink-0 bg-border/70" />

              <div className="min-w-0 flex-1 px-3">
                <p className="truncate text-[11px] text-muted-foreground">
                  quotes, coming soon
                </p>
              </div>

              <div className="shrink-0 px-1">
                <BackupWidget />
              </div>

              <span className="h-4 w-px shrink-0 bg-border/70" />

              <div className="ml-1 flex shrink-0 items-center gap-px">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      asChild
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                    >
                      <a
                        aria-label="source"
                        href="https://github.com/SatyamVyas04/better-home"
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        <IconBrandGithub className="size-3.5" />
                      </a>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="text-[10px]">source</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      asChild
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                    >
                      <a
                        aria-label="x"
                        href="https://x.com/SatyamVyas04"
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        <IconBrandX className="size-3.5" />
                      </a>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="text-[10px]">x</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      asChild
                      className="text-pink-500 transition-colors hover:text-pink-400"
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                    >
                      <a
                        aria-label="support"
                        href="https://github.com/sponsors/SatyamVyas04"
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        <IconHeart className="size-3.5" />
                      </a>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="text-[10px]">support us</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </TooltipProvider>
        </footer>
      </div>
    </ThemeProvider>
  );
}

export default App;
