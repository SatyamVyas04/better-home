// Main application component with responsive widget layout
import { IconBrandGithub, IconBrandX, IconHeart } from "@tabler/icons-react";
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

function App() {
  const [settings] = useLocalStorage<WidgetSettings>(
    "better-home-widget-settings",
    DEFAULT_WIDGET_SETTINGS
  );

  const { showTasks, showQuickLinks, showCalendar } = settings;

  const hasAnyWidget = showTasks || showQuickLinks || showCalendar;
  const onlyTodo = showTasks && !showQuickLinks && !showCalendar;
  const onlyQuickLinks = !showTasks && showQuickLinks && !showCalendar;
  const todoAndQuickOnly = showTasks && showQuickLinks && !showCalendar;
  const todoAndCalendarOnly = showTasks && !showQuickLinks && showCalendar;
  const quickAndCalendarOnly = !showTasks && showQuickLinks && showCalendar;
  const onlyCalendar = showCalendar && !showTasks && !showQuickLinks;
  const allThree = showTasks && showQuickLinks && showCalendar;

  const renderContent = () => {
    if (!hasAnyWidget) {
      return (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-muted-foreground text-sm lowercase">
            no widgets enabled *_*
          </p>
        </div>
      );
    }

    if (onlyTodo) {
      return (
        <div className="flex min-h-0 flex-1">
          <TodoList fullSize />
        </div>
      );
    }

    if (onlyQuickLinks) {
      return (
        <div className="flex min-h-0 flex-1">
          <QuickLinks expanded fullSize />
        </div>
      );
    }

    if (todoAndQuickOnly) {
      return (
        <div className="flex min-h-0 flex-1 flex-col gap-3 md:flex-row">
          <div className="flex min-h-0 flex-1">
            <TodoList fullSize />
          </div>
          <div className="flex min-h-0 flex-1">
            <QuickLinks expanded fullSize />
          </div>
        </div>
      );
    }

    if (todoAndCalendarOnly) {
      return (
        <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
          <div className="flex min-h-0 shrink-0">
            <TodoList />
          </div>
          <div className="flex min-h-0 min-w-0 flex-1">
            <InteractiveCalendar />
          </div>
        </div>
      );
    }

    if (quickAndCalendarOnly) {
      return (
        <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
          <div className="flex min-h-0 shrink-0">
            <QuickLinks expanded />
          </div>
          <div className="flex min-h-0 min-w-0 flex-1">
            <InteractiveCalendar />
          </div>
        </div>
      );
    }

    if (onlyCalendar) {
      return (
        <div className="flex min-h-0 flex-1">
          <InteractiveCalendar />
        </div>
      );
    }

    if (allThree) {
      return (
        <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
          <div className="flex min-h-0 shrink-0 flex-col gap-3">
            <TodoList />
            <QuickLinks />
          </div>
          <div className="flex min-h-0 min-w-0 flex-1">
            <InteractiveCalendar />
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <div className="flex h-screen flex-col overflow-hidden bg-background">
        <main className="flex min-h-0 flex-1 flex-col p-3">
          {renderContent()}
        </main>

        <footer className="border-border/40 border-t py-2">
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
