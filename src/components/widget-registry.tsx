import {
  IconCalendarHeart,
  IconChecklist,
  IconLink,
} from "@tabler/icons-react";
import type { ComponentType, ReactNode } from "react";
import { InteractiveCalendar } from "@/components/calendar/interactive-calendar";
import { QuickLinks } from "@/components/quick-links/quick-links-widget";
import { TodoList } from "@/components/todo-list/todo-list-widget";
import type { WidgetSettings } from "@/types/widget-settings";

export type WidgetId = "tasks" | "quick-links" | "calendar";
export type WidgetRenderVariant =
  | "default"
  | "expanded"
  | "full"
  | "compact-split"
  | "compact-full";

type WidgetSettingKey = "showTasks" | "showQuickLinks" | "showCalendar";

type WidgetIcon = ComponentType<{ className?: string }>;

interface WidgetManifestItem {
  description: string;
  icon: WidgetIcon;
  id: WidgetId;
  label: string;
  settingKey: WidgetSettingKey;
}

const APP_WIDGET_RENDERERS: Record<
  WidgetId,
  (variant: WidgetRenderVariant) => ReactNode
> = {
  tasks: (variant) => {
    if (variant === "full") {
      return <TodoList fullSize />;
    }

    return <TodoList />;
  },
  "quick-links": (variant) => {
    if (variant === "compact-split") {
      return <QuickLinks compactCards compactColumns={3} fullSize />;
    }

    if (variant === "compact-full") {
      return <QuickLinks compactCards compactColumns={4} fullSize />;
    }

    if (variant === "full") {
      return <QuickLinks expanded fullSize />;
    }

    if (variant === "expanded") {
      return <QuickLinks displayMode="icon-hover" expanded />;
    }

    return <QuickLinks />;
  },
  calendar: () => <InteractiveCalendar />,
};

export const WIDGET_MANIFEST: WidgetManifestItem[] = [
  {
    description: "tasks",
    icon: IconChecklist,
    id: "tasks",
    label: "tasks",
    settingKey: "showTasks",
  },
  {
    description: "quick links",
    icon: IconLink,
    id: "quick-links",
    label: "quick links",
    settingKey: "showQuickLinks",
  },
  {
    description: "mood calendar",
    icon: IconCalendarHeart,
    id: "calendar",
    label: "mood calendar",
    settingKey: "showCalendar",
  },
];

export function getEnabledWidgetIds(settings: WidgetSettings): WidgetId[] {
  return WIDGET_MANIFEST.filter((widget) => settings[widget.settingKey]).map(
    (widget) => widget.id
  );
}

export function renderWidget(
  widgetId: WidgetId,
  variant: WidgetRenderVariant = "default"
): ReactNode {
  return APP_WIDGET_RENDERERS[widgetId](variant);
}
