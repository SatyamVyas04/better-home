import {
  IconAlertCircle,
  IconClockExclamation,
  IconHeart,
  IconRefresh,
} from "@tabler/icons-react";
import { useEffect } from "react";
import { FooterQuote, QuotesProvider } from "@/components/quotes/quotes-widget";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { renderWidget } from "@/components/widget-registry";
import { BackupWidget } from "@/features/backup/backup-widget";
import { ThemeProvider } from "@/features/theme/theme-provider";
import { useEngagementNotifications } from "@/hooks/use-engagement-notifications";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useStorageMigration } from "@/hooks/use-storage-migration";
import {
  backupUnsyncedChangesToFileOnLeave,
  flushAutosaveBackupNow,
  queueAutosaveBackup,
} from "@/lib/backup-utils";
import {
  waitForPendingStorageWrites,
  writeAppStorageRaw,
} from "@/lib/extension-storage";
import {
  beginNewTabSession,
  finalizeSessionCheckpointOnLeave,
  redoTrackedUserAction,
  setSessionActionTrackingEnabled,
  undoTrackedUserAction,
} from "@/lib/session-history";
import {
  DEFAULT_WIDGET_SETTINGS,
  normalizeWidgetSettings,
  type WidgetSettings,
} from "@/types/widget-settings";
import { Separator } from "./components/ui/separator";

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
  const [storedSettings] = useLocalStorage<WidgetSettings>(
    "better-home-widget-settings",
    DEFAULT_WIDGET_SETTINGS
  );
  const settings = normalizeWidgetSettings(storedSettings);
  const { status: migrationStatus, retryMigration } = useStorageMigration();

  useEngagementNotifications({
    isReady: migrationStatus.state === "ready",
  });

  useEffect(() => {
    setSessionActionTrackingEnabled(true);
    beginNewTabSession().catch(() => null);

    return () => {
      setSessionActionTrackingEnabled(false);
    };
  }, []);

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

  useEffect(() => {
    const flushPendingPersistence = () => {
      flushAutosaveBackupNow().catch(() => null);
      waitForPendingStorageWrites().catch(() => null);
      finalizeSessionCheckpointOnLeave().catch(() => null);
      backupUnsyncedChangesToFileOnLeave().catch(() => null);
    };

    window.addEventListener("pagehide", flushPendingPersistence);
    window.addEventListener("beforeunload", flushPendingPersistence);

    return () => {
      window.removeEventListener("pagehide", flushPendingPersistence);
      window.removeEventListener("beforeunload", flushPendingPersistence);
    };
  }, []);

  useEffect(() => {
    const isEditableElement = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) {
        return false;
      }

      if (target.isContentEditable) {
        return true;
      }

      const tagName = target.tagName.toLowerCase();
      return (
        tagName === "input" || tagName === "textarea" || tagName === "select"
      );
    };

    const handleGlobalUndoRedo = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isEditableElement(event.target)) {
        return;
      }

      const isPrimaryModifierPressed = event.ctrlKey || event.metaKey;
      if (!isPrimaryModifierPressed) {
        return;
      }

      const pressedKey = event.key.toLowerCase();
      const isUndoShortcut = pressedKey === "z" && !event.shiftKey;
      const isRedoShortcut =
        (pressedKey === "z" && event.shiftKey) || pressedKey === "y";

      if (!(isUndoShortcut || isRedoShortcut)) {
        return;
      }

      event.preventDefault();

      if (isUndoShortcut) {
        undoTrackedUserAction()
          .then((didUndo) => {
            if (didUndo) {
              queueAutosaveBackup();
            }
          })
          .catch(() => null);
        return;
      }

      redoTrackedUserAction()
        .then((didRedo) => {
          if (didRedo) {
            queueAutosaveBackup();
          }
        })
        .catch(() => null);
    };

    window.addEventListener("keydown", handleGlobalUndoRedo);

    return () => {
      window.removeEventListener("keydown", handleGlobalUndoRedo);
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
        {renderWidget("quick-links", "compact-full")}
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
          {renderWidget("quick-links", "compact-split")}
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

        <footer className="border-border/70 border-t bg-card/80 px-1 py-1 backdrop-blur supports-backdrop-filter:bg-card/65">
          <TooltipProvider delayDuration={180}>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <a
                className="group flex shrink-0 items-center gap-1 rounded-md bg-accent px-1 py-1 text-foreground transition-colors"
                href="https://github.com/SatyamVyas04/better-home"
                rel="noopener noreferrer"
                target="_blank"
              >
                <img
                  alt="better-home logo"
                  className="size-3.5 shrink-0"
                  height={14}
                  src="/better-home-logo-48.png"
                  width={14}
                />
                <span className="font-medium text-[10px] text-foreground tracking-tight">
                  better-home
                </span>
              </a>

              {settings.showQuotes && (
                <div className="hidden min-w-0 flex-1 items-center gap-1 md:flex">
                  <Separator className="w-px" orientation="vertical" />
                  <QuotesProvider>
                    <FooterQuote />
                  </QuotesProvider>
                </div>
              )}

              <div className="ml-auto hidden max-w-64 flex-1 lg:flex">
                <div className="flex items-center gap-1 overflow-hidden rounded-md border border-border/60 bg-muted/35">
                  <span className="shrink-0 rounded-l bg-primary/10 px-1 py-1 font-medium text-[9px] text-primary uppercase tracking-wide">
                    <IconClockExclamation className="size-3" />
                  </span>
                  <p className="truncate text-[10px] text-muted-foreground">
                    milestones & reminders, coming soon!
                  </p>
                </div>
              </div>

              <div className="ml-auto shrink-0">
                <BackupWidget />
              </div>

              <Separator className="w-px" orientation="vertical" />

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    asChild
                    className="text-pink-500 transition-colors hover:bg-pink-500! hover:text-white"
                    size="icon-sm"
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
          </TooltipProvider>
        </footer>
      </div>
      <Toaster />
    </ThemeProvider>
  );
}

export default App;
