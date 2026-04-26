import { useCallback } from "react";

import { useLocalStorage } from "@/hooks/use-local-storage";
import { runTrackedUserAction } from "@/lib/session-history";
import type { CalendarData, DayEntry } from "@/types/calendar";

const MOOD_VALUES = new Set([
  "coreMemory",
  "goodDay",
  "neutral",
  "badDay",
  "nightmare",
]);

function isValidMood(mood: unknown): mood is DayEntry["mood"] {
  if (mood === null || mood === undefined) {
    return true;
  }
  return typeof mood === "string" && MOOD_VALUES.has(mood);
}

function normalizeEntry(entry: unknown): DayEntry {
  if (!entry || typeof entry !== "object") {
    return { mood: null, workLog: "", journal: "" };
  }

  const candidate = entry as Partial<DayEntry>;

  const mood = isValidMood(candidate.mood) ? candidate.mood : null;
  const workLog =
    typeof candidate.workLog === "string" ? candidate.workLog : "";
  const journal =
    typeof candidate.journal === "string" ? candidate.journal : "";

  return { mood, workLog, journal };
}

const DEFAULT_ENTRY: DayEntry = { mood: null, workLog: "", journal: "" };

export function useCalendarData() {
  const [calendarData, setCalendarData] = useLocalStorage<CalendarData>(
    "mood-calendar-2026-data",
    {}
  );

  const handleSaveEntry = useCallback(
    (dateKey: string, entry: DayEntry) => {
      if (!isValidMood(entry.mood)) {
        console.warn(
          `[useCalendarData] Invalid mood for ${dateKey}:`,
          entry.mood
        );
        return;
      }

      runTrackedUserAction("update calendar entry", () => {
        setCalendarData((prev) => ({
          ...prev,
          [dateKey]: entry,
        }));
      });
    },
    [setCalendarData]
  );

  const getEntryForDate = useCallback(
    (dateKey: string): DayEntry => {
      const entry = calendarData[dateKey];
      if (!entry) {
        return DEFAULT_ENTRY;
      }
      return normalizeEntry(entry);
    },
    [calendarData]
  );

  return { calendarData, handleSaveEntry, getEntryForDate };
}
