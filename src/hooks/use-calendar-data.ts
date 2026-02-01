import { useCallback } from "react";

import { useLocalStorage } from "@/hooks/use-local-storage";
import type { CalendarData, DayEntry } from "@/types/calendar";

export function useCalendarData() {
  const [calendarData, setCalendarData] = useLocalStorage<CalendarData>(
    "mood-calendar-2026-data",
    {}
  );

  const handleSaveEntry = useCallback(
    (dateKey: string, entry: DayEntry) => {
      setCalendarData((prev) => ({
        ...prev,
        [dateKey]: entry,
      }));
    },
    [setCalendarData]
  );

  const getEntryForDate = useCallback(
    (dateKey: string): DayEntry => {
      return calendarData[dateKey] ?? { mood: null, workLog: "", journal: "" };
    },
    [calendarData]
  );

  return { calendarData, handleSaveEntry, getEntryForDate };
}
