// Extension popup settings panel with widget toggles and attribution
import {
  IconBrandGithub,
  IconBrandLinkedin,
  IconBrandX,
  IconCalendarHeart,
  IconChecklist,
  IconHeart,
  IconLink,
  IconMessageReport,
} from "@tabler/icons-react";
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

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <div className="w-72 bg-background p-4">
        <header className="flex items-center gap-3">
          <img
            alt="better-home"
            className="size-10"
            height={40}
            src="/better-home-logo-128.png"
            width={40}
          />
          <div>
            <h1 className="font-semibold text-sm">better-home</h1>
            <p className="text-[11px] text-muted-foreground">
              minimal new tab, no{" "}
              <span className="text-destructive">clutter</span>
            </p>
          </div>
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
