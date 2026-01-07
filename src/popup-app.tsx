// Extension popup settings panel with widget toggles and attribution
import {
  IconBrandGithub,
  IconBrandLinkedin,
  IconBrandX,
  IconCalendarHeart,
  IconChecklist,
  IconExternalLink,
  IconLink,
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
      <div className="w-72 bg-background p-5">
        <header className="mb-4 flex flex-col items-center text-center">
          <img
            alt="better-home"
            className="size-12"
            height={48}
            src="/better-home-logo-128.png"
            width={48}
          />
          <h1 className="mt-3 font-semibold text-lg">better-home</h1>
          <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
            Just what you need, without the{" "}
            <span className="font-medium text-[#ff383c]">Clutter</span>.
          </p>
        </header>

        <Separator className="my-4" />

        <p className="mb-3 text-muted-foreground text-xs">
          Toggle widgets on your new tab
        </p>

        <div className="space-y-1">
          <div className="flex items-center justify-between rounded-lg py-1">
            <div className="flex items-center gap-2.5">
              <IconChecklist className="size-4 text-muted-foreground" />
              <Label className="cursor-pointer text-sm" htmlFor="show-tasks">
                Tasks
              </Label>
            </div>
            <Switch
              checked={settings.showTasks}
              id="show-tasks"
              onCheckedChange={() => toggleSetting("showTasks")}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg py-1">
            <div className="flex items-center gap-2.5">
              <IconLink className="size-4 text-muted-foreground" />
              <Label
                className="cursor-pointer text-sm"
                htmlFor="show-quick-links"
              >
                Quick Links
              </Label>
            </div>
            <Switch
              checked={settings.showQuickLinks}
              id="show-quick-links"
              onCheckedChange={() => toggleSetting("showQuickLinks")}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg py-1">
            <div className="flex items-center gap-2.5">
              <IconCalendarHeart className="size-4 text-muted-foreground" />
              <Label className="cursor-pointer text-sm" htmlFor="show-calendar">
                Mood Calendar
              </Label>
            </div>
            <Switch
              checked={settings.showCalendar}
              id="show-calendar"
              onCheckedChange={() => toggleSetting("showCalendar")}
            />
          </div>
        </div>

        <Separator className="my-4" />

        <a
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-border/50 py-2.5 text-sm transition-colors hover:bg-accent/30"
          href="https://github.com/SatyamVyas04/better-home/issues"
          rel="noopener noreferrer"
          target="_blank"
        >
          <IconExternalLink className="size-4" />
          Suggest Changes
        </a>

        <Separator className="my-4" />

        <div className="text-center">
          <p className="mb-2 text-muted-foreground text-xs">
            Made with ♥ by Satyam Vyas
          </p>
          <div className="flex items-center justify-center gap-3">
            <a
              aria-label="LinkedIn"
              className="text-muted-foreground transition-colors hover:text-foreground"
              href="https://www.linkedin.com/in/satyam-vyas/"
              rel="noopener noreferrer"
              target="_blank"
            >
              <IconBrandLinkedin className="size-5" />
            </a>
            <a
              aria-label="GitHub"
              className="text-muted-foreground transition-colors hover:text-foreground"
              href="https://github.com/SatyamVyas04"
              rel="noopener noreferrer"
              target="_blank"
            >
              <IconBrandGithub className="size-5" />
            </a>
            <a
              aria-label="X (Twitter)"
              className="text-muted-foreground transition-colors hover:text-foreground"
              href="https://x.com/SatyamVyas04"
              rel="noopener noreferrer"
              target="_blank"
            >
              <IconBrandX className="size-5" />
            </a>
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
}

export default PopupApp;
