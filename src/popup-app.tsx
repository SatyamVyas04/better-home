import {
  IconAlertCircle,
  IconBrandGithub,
  IconBrandLinkedin,
  IconBrandX,
  IconHeart,
  IconMessageReport,
  IconRefresh,
} from "@tabler/icons-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { WIDGET_MANIFEST } from "@/components/widget-registry";
import { ModeToggle } from "@/features/theme/mode-toggle";
import { ThemeProvider } from "@/features/theme/theme-provider";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useStorageMigration } from "@/hooks/use-storage-migration";
import { flushAutosaveBackupNow } from "@/lib/backup-utils";
import {
  APP_VERSION,
  waitForPendingStorageWrites,
} from "@/lib/extension-storage";
import {
  DEFAULT_WIDGET_SETTINGS,
  type WidgetSettings,
} from "@/types/widget-settings";

function PopupApp() {
  const [settings, setSettings] = useLocalStorage<WidgetSettings>(
    "better-home-widget-settings",
    DEFAULT_WIDGET_SETTINGS
  );
  const { status: migrationStatus, retryMigration } = useStorageMigration();

  useEffect(() => {
    const flushPendingPersistence = () => {
      flushAutosaveBackupNow().catch(() => null);
      waitForPendingStorageWrites().catch(() => null);
    };

    window.addEventListener("pagehide", flushPendingPersistence);
    window.addEventListener("beforeunload", flushPendingPersistence);

    return () => {
      window.removeEventListener("pagehide", flushPendingPersistence);
      window.removeEventListener("beforeunload", flushPendingPersistence);
    };
  }, []);

  const toggleSetting = (key: keyof WidgetSettings) => {
    setSettings((previousSettings) => ({
      ...previousSettings,
      [key]: !previousSettings[key],
    }));
  };

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <div className="w-80 bg-card p-4">
        {migrationStatus.state === "error" && (
          <div className="mb-3 flex items-center justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-[10px] text-destructive">
            <div className="flex min-w-0 items-center gap-1">
              <IconAlertCircle className="size-3 shrink-0" />
              <span className="truncate">
                {migrationStatus.message}
                {migrationStatus.details ? ` · ${migrationStatus.details}` : ""}
              </span>
            </div>
            <Button
              className="h-5 shrink-0 px-1 text-[10px] text-destructive hover:bg-destructive/15"
              onClick={() => {
                retryMigration().catch(() => null);
              }}
              size="xs"
              type="button"
              variant="ghost"
            >
              <IconRefresh className="size-2.5" />
              retry
            </Button>
          </div>
        )}

        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              alt="better-home"
              className="size-10"
              height={40}
              src="/better-home-logo-128.png"
              width={40}
            />
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-semibold text-sm">better-home</h1>
                <span className="rounded border border-border/60 px-1.5 py-0 text-[10px] text-muted-foreground">
                  v{APP_VERSION}
                </span>
              </div>
              <p className="mr-4 text-[12px] text-muted-foreground">
                a minimal, delightful new-tab replacement
              </p>
            </div>
          </div>
          <ModeToggle />
        </header>

        <Separator className="my-3" />

        <div className="space-y-2">
          <p className="font-medium text-[11px] text-muted-foreground uppercase tracking-wide">
            Widgets
          </p>
          <div className="space-y-0.5">
            {WIDGET_MANIFEST.map((widget) => {
              const Icon = widget.icon;
              const switchId = `widget-${widget.id}`;

              return (
                <div
                  className="flex items-center justify-between rounded-md px-2 py-1.5 transition-colors hover:bg-accent/30"
                  key={widget.id}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="size-3.5 text-muted-foreground" />
                    <Label
                      className="cursor-pointer text-xs"
                      htmlFor={switchId}
                    >
                      {widget.label}
                    </Label>
                  </div>
                  <Switch
                    checked={settings[widget.settingKey]}
                    className="scale-90"
                    id={switchId}
                    onCheckedChange={() => {
                      toggleSetting(widget.settingKey);
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <Separator className="my-3" />

        <div className="flex gap-2">
          <Button asChild className="flex-1" size="default" variant="outline">
            <a
              href="https://github.com/SatyamVyas04/better-home/issues"
              rel="noopener noreferrer"
              target="_blank"
            >
              <IconMessageReport className="size-3.5" />
              feedback
            </a>
          </Button>
          <Button asChild className="flex-1" size="default" variant="outline">
            <a
              href="https://github.com/sponsors/SatyamVyas04"
              rel="noopener noreferrer"
              target="_blank"
            >
              <IconHeart className="size-3.5" />
              sponsor
            </a>
          </Button>
        </div>

        <Separator className="my-3" />

        <div className="flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground">
            made with <span className="text-rose-500">♥</span> by satyam
          </p>
          <div className="flex items-center gap-2">
            <a
              aria-label="LinkedIn"
              className="text-muted-foreground transition-colors hover:text-foreground"
              href="https://www.linkedin.com/in/satyam-vyas/"
              rel="noopener noreferrer"
              target="_blank"
            >
              <IconBrandLinkedin className="size-4" />
            </a>
            <a
              aria-label="GitHub"
              className="text-muted-foreground transition-colors hover:text-foreground"
              href="https://github.com/SatyamVyas04"
              rel="noopener noreferrer"
              target="_blank"
            >
              <IconBrandGithub className="size-4" />
            </a>
            <a
              aria-label="X"
              className="text-muted-foreground transition-colors hover:text-foreground"
              href="https://x.com/SatyamVyas04"
              rel="noopener noreferrer"
              target="_blank"
            >
              <IconBrandX className="size-4" />
            </a>
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
}

export default PopupApp;
