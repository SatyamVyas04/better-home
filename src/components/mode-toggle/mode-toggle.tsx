import { IconMoon, IconSun } from "@tabler/icons-react";
import { useTheme } from "@/components/theme-provider/theme-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ModeToggle() {
  const { setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="relative" size="icon-sm" variant="outline">
          <IconSun className="size-3 rotate-0 scale-100 opacity-100 transition-[transform,opacity] duration-200 ease-out dark:-rotate-90 dark:scale-95 dark:opacity-0" />
          <IconMoon className="absolute size-3 rotate-90 scale-95 opacity-0 transition-[transform,opacity] duration-200 ease-out dark:rotate-0 dark:scale-100 dark:opacity-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem className="text-xs" onClick={() => setTheme("light")}>
          Light
        </DropdownMenuItem>
        <DropdownMenuItem className="text-xs" onClick={() => setTheme("dark")}>
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-xs"
          onClick={() => setTheme("system")}
        >
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
