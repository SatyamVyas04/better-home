import type React from "react";
import type { MoodType } from "@/lib/calendar-constants";

export interface DayEntry {
  journal: string;
  mood: MoodType | null;
  workLog: string;
}

export interface CalendarData {
  [dateKey: string]: DayEntry;
}

export interface DateCell {
  day: number;
  dayOfWeek: number;
  week: number;
}

export interface InteractiveCalendarProps {
  className?: string;
}

export interface MoodSelectorProps {
  onSelectMood: (mood: MoodType) => void;
  selectedMood: MoodType | null;
}

export interface DatePopoverProps {
  children: React.ReactNode;
  dateKey: string;
  displayDate: string;
  entry: DayEntry;
  onSave: (dateKey: string, entry: DayEntry) => void;
}

export interface MonthGridProps {
  animationDelay?: number;
  dayLabels: string[];
  firstDayOfWeek: number;
  getEntryForDate: (dateKey: string) => DayEntry;
  getFillColor: (dateKey: string) => string;
  handleSaveEntry: (dateKey: string, entry: DayEntry) => void;
  month: {
    name: string;
    days: number;
    startDay: number;
  };
  monthIndex: number;
  showAllYear: boolean;
  showNumbers: boolean;
  year: number;
}
