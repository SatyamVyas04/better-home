import { IconBrandGithub, IconBrandX, IconHeart } from "@tabler/icons-react";
import { useEffect } from "react";
import { InteractiveCalendar } from "@/components/interactive-calendar";
import { QuickLinks } from "@/components/quick-links";
import { ThemeProvider } from "@/components/theme-provider";
import { TodoList } from "@/components/todo-list";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLocalStorage } from "@/hooks/use-local-storage";
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
        localStorage.setItem("vite-ui-theme", message.theme);
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
      <div className="flex min-h-0 flex-1">
        <TodoList fullSize />
      </div>
    ),
    links: (
      <div className="flex min-h-0 flex-1">
        <QuickLinks expanded fullSize />
      </div>
    ),
    calendar: (
      <div className="flex min-h-0 flex-1">
        <InteractiveCalendar />
      </div>
    ),
    "tasks-links": (
      <div className="flex min-h-0 flex-1 flex-col gap-3 md:flex-row">
        <div className="flex min-h-0 flex-1">
          <TodoList fullSize />
        </div>
        <div className="flex min-h-0 flex-1">
          <QuickLinks expanded fullSize />
        </div>
      </div>
    ),
    "tasks-calendar": (
      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        <div className="flex min-h-0 shrink-0">
          <TodoList />
        </div>
        <div className="flex min-h-0 min-w-0 flex-1">
          <InteractiveCalendar />
        </div>
      </div>
    ),
    "links-calendar": (
      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        <div className="flex min-h-0 shrink-0">
          <QuickLinks expanded />
        </div>
        <div className="flex min-h-0 min-w-0 flex-1">
          <InteractiveCalendar />
        </div>
      </div>
    ),
    all: (
      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        <div className="flex min-h-0 shrink-0 flex-col gap-3">
          <TodoList />
          <QuickLinks />
        </div>
        <div className="flex min-h-0 min-w-0 flex-1">
          <InteractiveCalendar />
        </div>
      </div>
    ),
  };

  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <div className="flex h-screen flex-col overflow-hidden bg-background">
        <main className="flex min-h-0 flex-1 flex-col p-3">
          {layouts[layoutKey]}
        </main>

        <footer className="border-border border-t bg-card py-2 shadow-black/10 shadow-sm ring-1 ring-black/10 transition-all duration-200 hover:shadow-md hover:ring-black/20 dark:shadow-white/10 dark:ring-white/10 dark:hover:ring-white/20">
          <TooltipProvider delayDuration={200}>
            <div className="flex items-center justify-between px-3 text-muted-foreground text-xs">
              <div className="flex items-center gap-2">
                <img
                  alt="better-home logo"
                  className="size-4"
                  height={16}
                  src="/better-home-logo-16.png"
                  width={16}
                />
                <span className="font-medium text-foreground">better-home</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a
                      className="transition-colors hover:text-foreground"
                      href="https://github.com/SatyamVyas04/better-home"
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      <IconBrandGithub className="size-3.5" />
                    </a>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="text-[10px] lowercase">view source</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline">by</span>
                <a
                  className="hidden font-medium transition-colors hover:text-foreground sm:inline"
                  href="https://github.com/SatyamVyas04"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Satyam Vyas
                </a>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a
                      className="transition-colors hover:text-foreground"
                      href="https://github.com/SatyamVyas04"
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      <IconBrandGithub className="size-3.5" />
                    </a>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="text-[10px] lowercase">github profile</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a
                      className="transition-colors hover:text-foreground"
                      href="https://x.com/SatyamVyas04"
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      <IconBrandX className="size-3.5" />
                    </a>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="text-[10px] lowercase">follow on x</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a
                      className="flex items-center gap-1 rounded-md text-pink-500 transition-colors hover:text-pink-400"
                      href="https://github.com/sponsors/SatyamVyas04"
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      <IconHeart className="size-3.5" />
                    </a>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="text-[10px] lowercase">
                      support this project
                    </p>
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
