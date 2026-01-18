// Extension popup settings panel with widget toggles and attribution
import {
  IconBrandGithub,
  IconBrandLinkedin,
  IconBrandX,
  IconCalendarHeart,
  IconChecklist,
  IconDownload,
  IconHeart,
  IconLink,
  IconMessageReport,
  IconUpload,
} from "@tabler/icons-react";
import { ModeToggle } from "@/components/mode-toggle";
import { ThemeProvider } from "@/components/theme-provider";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useLocalStorage } from "@/hooks/use-local-storage";
import {
  DEFAULT_WIDGET_SETTINGS,
  type WidgetSettings,
} from "@/types/widget-settings";

function PopupApp() {
  const [settings, setSettings] = useLocalStorage<WidgetSettings>(
    "better-home-widget-settings",
    DEFAULT_WIDGET_SETTINGS
  );

  const toggleSetting = (key: keyof WidgetSettings) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleDownloadBackup = () => {
    const keys = [
      "better-home-widget-settings",
      "better-home-todos",
      "better-home-quick-links",
      "mood-calendar-2026-data",
      "mood-calendar-show-numbers",
      "vite-ui-theme",
    ];

    const backup: Record<string, unknown> = {};
    for (const key of keys) {
      const value = localStorage.getItem(key);
      if (value) {
        try {
          backup[key] = JSON.parse(value);
        } catch {
          // If parsing fails, store the raw value
          backup[key] = value;
        }
      }
    }

    const dataStr = JSON.stringify(backup, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `better-home-backup-${new Date().toISOString().split("T")[0]}.json`;
    link.style.display = "none";

    // Use documentElement as fallback if body is not available
    const container = document.body || document.documentElement;
    container.appendChild(link);
    link.click();
    container.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleUploadBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const backup = JSON.parse(e.target?.result as string);
        for (const key of Object.keys(backup)) {
          const value = backup[key];
          // Store as-is if already a string (like theme values), otherwise JSON stringify
          if (typeof value === "string" && key === "vite-ui-theme") {
            localStorage.setItem(key, value);
          } else {
            localStorage.setItem(key, JSON.stringify(value));
          }
        }
        // Reload the page to reflect changes
        window.location.reload();
      } catch {
        console.error("Invalid backup file. Please select a valid JSON file.");
      }
    };
    reader.readAsText(file);
    // Reset the input
    event.target.value = "";
  };

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <div className="w-72 bg-card p-4">
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
              <h1 className="font-semibold text-sm">better-home</h1>
              <p className="mr-4 text-pretty text-[12px] text-muted-foreground">
                your minimal new tab experience
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
            <div className="flex items-center justify-between rounded-md px-2 py-1.5 transition-colors hover:bg-accent/30">
              <div className="flex items-center gap-2">
                <IconChecklist className="size-3.5 text-muted-foreground" />
                <Label className="cursor-pointer text-xs" htmlFor="show-tasks">
                  tasks
                </Label>
              </div>
              <Switch
                checked={settings.showTasks}
                className="scale-90"
                id="show-tasks"
                onCheckedChange={() => toggleSetting("showTasks")}
              />
            </div>

            <div className="flex items-center justify-between rounded-md px-2 py-1.5 transition-colors hover:bg-accent/30">
              <div className="flex items-center gap-2">
                <IconLink className="size-3.5 text-muted-foreground" />
                <Label
                  className="cursor-pointer text-xs"
                  htmlFor="show-quick-links"
                >
                  quick links
                </Label>
              </div>
              <Switch
                checked={settings.showQuickLinks}
                className="scale-90"
                id="show-quick-links"
                onCheckedChange={() => toggleSetting("showQuickLinks")}
              />
            </div>

            <div className="flex items-center justify-between rounded-md px-2 py-1.5 transition-colors hover:bg-accent/30">
              <div className="flex items-center gap-2">
                <IconCalendarHeart className="size-3.5 text-muted-foreground" />
                <Label
                  className="cursor-pointer text-xs"
                  htmlFor="show-calendar"
                >
                  mood calendar
                </Label>
              </div>
              <Switch
                checked={settings.showCalendar}
                className="scale-90"
                id="show-calendar"
                onCheckedChange={() => toggleSetting("showCalendar")}
              />
            </div>
          </div>
        </div>

        <Separator className="my-3" />

        <div className="space-y-2">
          <p className="font-medium text-[11px] text-muted-foreground uppercase tracking-wide">
            Data
          </p>
          <div className="flex gap-2">
            <button
              className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border/50 py-3 text-[11px] transition-colors hover:bg-accent/30"
              onClick={handleDownloadBackup}
              type="button"
            >
              <IconDownload className="size-3.5" />
              backup
            </button>
            <label className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border/50 py-2 text-[11px] transition-colors hover:bg-accent/30">
              <IconUpload className="size-3.5" />
              restore
              <input
                accept=".json"
                className="hidden"
                onChange={handleUploadBackup}
                type="file"
              />
            </label>
          </div>
        </div>

        <Separator className="my-3" />

        <div className="flex gap-2">
          <a
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border/50 py-2 text-[11px] transition-colors hover:bg-accent/30"
            href="https://github.com/SatyamVyas04/better-home/issues"
            rel="noopener noreferrer"
            target="_blank"
          >
            <IconMessageReport className="size-3.5" />
            feedback
          </a>
          <a
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-pink-500/10 py-2 text-[11px] text-pink-500 transition-colors hover:bg-pink-500/20"
            href="https://github.com/sponsors/SatyamVyas04"
            rel="noopener noreferrer"
            target="_blank"
          >
            <IconHeart className="size-3.5" />
            sponsor
          </a>
        </div>

        <Separator className="my-3" />

        <div className="flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground">
            made with ♥ by satyam
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
              aria-label="X (Twitter)"
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
