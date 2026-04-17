type LegacyWidgetSettings = Partial<WidgetSettings>;

export interface WidgetSettings {
  showTasks: boolean;
  showQuickLinks: boolean;
  showCalendar: boolean;
  showQuotes: boolean;
}

export const DEFAULT_WIDGET_SETTINGS: WidgetSettings = {
  showTasks: true,
  showQuickLinks: true,
  showCalendar: true,
  showQuotes: true,
};

export function normalizeWidgetSettings(
  settings: LegacyWidgetSettings | null | undefined
): WidgetSettings {
  return {
    ...DEFAULT_WIDGET_SETTINGS,
    ...settings,
  };
}
