// TypeScript type definitions for calendar components and data structures
import type React from "react";
import type { MoodType } from "@/lib/calendar-constants";

export interface DayEntry {
  mood: MoodType | null;
  workLog: string;
  journal: string;
}

export interface CalendarData {
  [dateKey: string]: DayEntry;
}

export interface DateCell {
  day: number;
  week: number;
  dayOfWeek: number;
}

export interface InteractiveCalendarProps {
  className?: string;
}

export interface MoodSelectorProps {
  selectedMood: MoodType | null;
  onSelectMood: (mood: MoodType) => void;
}

export interface DatePopoverProps {
  dateKey: string;
  entry: DayEntry;
  onSave: (dateKey: string, entry: DayEntry) => void;
  displayDate: string;
  children: React.ReactNode;
}

export interface MonthGridProps {
  month: {
    name: string;
    days: number;
    startDay: number;
  };
  monthIndex: number;
  getEntryForDate: (dateKey: string) => DayEntry;
  getFillColor: (dateKey: string) => string;
  handleSaveEntry: (dateKey: string, entry: DayEntry) => void;
  showAllYear: boolean;
  showNumbers: boolean;
  animationDelay?: number;
}
