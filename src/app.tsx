import { IconBrandGithub, IconBrandX } from "@tabler/icons-react";
import { CalendarPlaceholder } from "@/components/calendar-placeholder";
import { QuickLinks } from "@/components/quick-links";
import { ThemeProvider } from "@/components/theme-provider";
import { TodoList } from "@/components/todo-list";
import { useLocalStorage } from "@/hooks/use-local-storage";

interface WidgetSettings {
  showTasks: boolean;
  showQuickLinks: boolean;
  showCalendar: boolean;
}

const DEFAULT_SETTINGS: WidgetSettings = {
  showTasks: true,
  showQuickLinks: true,
  showCalendar: true,
};

function App() {
  const [settings] = useLocalStorage<WidgetSettings>(
    "better-home-widget-settings",
    DEFAULT_SETTINGS
  );

  const hasLeftColumn = settings.showTasks || settings.showQuickLinks;
  const hasRightColumn = settings.showCalendar;
  const hasAnyWidget = hasLeftColumn || hasRightColumn;

  const onlyLeftColumn = hasLeftColumn && !hasRightColumn;
  const onlyRightColumn = hasRightColumn && !hasLeftColumn;

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <div className="flex min-h-screen flex-col bg-background">
        <main className="flex flex-1 flex-col p-3">
          {hasAnyWidget ? (
            <div
              className={`flex flex-1 gap-3 ${onlyLeftColumn || onlyRightColumn ? "" : "flex-col lg:flex-row"}`}
            >
              {hasLeftColumn && (
                <div
                  className={`flex shrink-0 gap-3 ${onlyLeftColumn ? "flex-1 flex-col md:flex-row" : "flex-col"}`}
                >
                  {settings.showTasks && <TodoList />}
                  {settings.showQuickLinks && <QuickLinks />}
                </div>
              )}
              {hasRightColumn && (
                <div className="flex min-h-0 min-w-0 flex-1">
                  <CalendarPlaceholder />
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-muted-foreground text-sm lowercase">
                no widgets enabled *_*
              </p>
            </div>
          )}
        </main>

        <footer className="border-border/40 border-t py-3">
          <div className="flex flex-row items-center justify-between px-4 text-muted-foreground text-xs">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <img
                  alt="better-home logo"
                  className="size-4"
                  height={16}
                  src="/better-home-logo-16.png"
                  width={16}
                />
                <span className="font-medium text-foreground">better-home</span>
              </div>
              <a
                className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                href="https://github.com/SatyamVyas04/better-home"
                rel="noopener noreferrer"
                target="_blank"
              >
                <IconBrandGithub className="size-3.5" />
              </a>
            </div>
            <div className="flex items-center gap-2">
              <span>by</span>
              <a
                className="font-medium transition-colors hover:text-foreground"
                href="https://github.com/SatyamVyas04"
                rel="noopener noreferrer"
                target="_blank"
              >
                Satyam Vyas
              </a>
              <a
                className="transition-colors hover:text-foreground"
                href="https://github.com/SatyamVyas04"
                rel="noopener noreferrer"
                target="_blank"
              >
                <IconBrandGithub className="size-3" />
              </a>
              <a
                className="transition-colors hover:text-foreground"
                href="https://x.com/SatyamVyas04"
                rel="noopener noreferrer"
                target="_blank"
              >
                <IconBrandX className="size-3" />
              </a>
            </div>
          </div>
        </footer>
      </div>
    </ThemeProvider>
  );
}

export default App;
