import { IconDeviceDesktop, IconMoon, IconSun } from "@tabler/icons-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useTheme } from "@/features/theme/theme-provider";

export function ModeToggle() {
  const { settings, setThemeMode } = useTheme();

  return (
    <ToggleGroup
      onValueChange={(value) => {
        const nextMode = value.find((mode) => mode !== settings.mode);

        if (
          nextMode === "light" ||
          nextMode === "dark" ||
          nextMode === "system"
        ) {
          setThemeMode(nextMode);
        }
      }}
      type="multiple"
      value={settings.mode ? [settings.mode] : []}
      variant="outline"
    >
      <ToggleGroupItem aria-label="Light theme" value="light">
        <IconSun className="size-3.5" />
      </ToggleGroupItem>
      <ToggleGroupItem aria-label="Dark theme" value="dark">
        <IconMoon className="size-3.5" />
      </ToggleGroupItem>
      <ToggleGroupItem aria-label="System theme" value="system">
        <IconDeviceDesktop className="size-3.5" />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
