// Interactive mood calendar with quadrimester/yearly view and animated transitions
"use client";

import { AnimatePresence, motion } from "motion/react";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { cn } from "@/lib/utils";

const MOOD_COLORS = {
  coreMemory: { color: "#00C0E8", label: "Core Memory" },
  goodDay: { color: "#34C759", label: "A Good Day" },
  neutral: { color: "#FFD60A", label: "Neutral" },
  badDay: { color: "#FF8D28", label: "A Bad Day" },
  nightmare: { color: "#FF3C30", label: "Nightmare" },
} as const;

type MoodType = keyof typeof MOOD_COLORS;

interface DayEntry {
  mood: MoodType | null;
  remark: string;
}

interface CalendarData {
  [dateKey: string]: DayEntry;
}

function getDateKey(year: number, month: number, day: number): string {
  return `${year}-${month}-${day}`;
}

function getContrastColor(moodKey: string): string {
  return moodKey === "neutral" ? "#000" : "#fff";
}

interface DatePopoverProps {
  dateKey: string;
  entry: DayEntry;
  onSave: (dateKey: string, entry: DayEntry) => void;
  displayDate: string;
  children: React.ReactNode;
}

function DatePopover({
  dateKey,
  entry,
  onSave,
  displayDate,
  children,
}: DatePopoverProps) {
  const [open, setOpen] = useState(false);
  const [selectedMood, setSelectedMood] = useState<MoodType | null>(entry.mood);
  const [remark, setRemark] = useState(entry.remark);

  useEffect(() => {
    setSelectedMood(entry.mood);
    setRemark(entry.remark);
  }, [entry.mood, entry.remark]);

  const handleSave = () => {
    onSave(dateKey, { mood: selectedMood, remark });
    setOpen(false);
  };

  const handleClear = () => {
    setSelectedMood(null);
    setRemark("");
    onSave(dateKey, { mood: null, remark: "" });
    setOpen(false);
  };

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-64" side="right" sideOffset={12}>
        <div className="space-y-3">
          <div className="space-y-0.5">
            <h4 className="font-medium text-foreground text-sm">
              {displayDate}
            </h4>
            <p className="text-muted-foreground text-xs">how was your day?</p>
          </div>

          <div className="space-y-2">
            <Label className="font-medium text-xs lowercase">mood</Label>
            <div className="grid grid-cols-1 gap-1.5">
              {Object.entries(MOOD_COLORS).map(([key, { color, label }]) => (
                <button
                  aria-label={label}
                  aria-pressed={selectedMood === key}
                  className={cn(
                    "flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs transition-all duration-200",
                    selectedMood === key
                      ? "border-2"
                      : "border-2 border-border/50 hover:border-border hover:bg-accent/30"
                  )}
                  key={key}
                  onClick={() => setSelectedMood(key as MoodType)}
                  style={{
                    borderColor: selectedMood === key ? color : undefined,
                  }}
                  title={label}
                  type="button"
                >
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-foreground">{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label
              className="font-medium text-xs lowercase"
              htmlFor={`remark-${dateKey}`}
            >
              notes
            </Label>
            <Textarea
              id={`remark-${dateKey}`}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="add a note about your day..."
              rows={3}
              value={remark}
            />
          </div>

          <div className="flex gap-2">
            <Button
              className="flex-1 bg-transparent text-xs"
              onClick={handleClear}
              size="sm"
              variant="outline"
            >
              clear
            </Button>
            <Button className="flex-1 text-xs" onClick={handleSave} size="sm">
              save
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

const DAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

// 2026 calendar configuration: startDay (0=Monday through 6=Sunday)
const MONTHS_2026 = [
  { name: "JAN", days: 31, startDay: 3 },
  { name: "FEB", days: 28, startDay: 6 },
  { name: "MAR", days: 31, startDay: 6 },
  { name: "APR", days: 30, startDay: 2 },
  { name: "MAY", days: 31, startDay: 4 },
  { name: "JUN", days: 30, startDay: 0 },
  { name: "JUL", days: 31, startDay: 2 },
  { name: "AUG", days: 31, startDay: 5 },
  { name: "SEP", days: 30, startDay: 1 },
  { name: "OCT", days: 31, startDay: 3 },
  { name: "NOV", days: 30, startDay: 6 },
  { name: "DEC", days: 31, startDay: 1 },
];

interface DateCell {
  day: number;
  week: number;
  dayOfWeek: number;
}

function generateCalendarData(
  startDay: number,
  daysInMonth: number
): DateCell[] {
  const cells: DateCell[] = [];
  let dayOfWeek = startDay;
  let week = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ day, week, dayOfWeek });
    dayOfWeek++;
    if (dayOfWeek === 7) {
      dayOfWeek = 0;
      week++;
    }
  }

  return cells;
}

interface InteractiveCalendarProps {
  className?: string;
}

const QUADRIMESTERS = [
  { label: "Jan - Apr", months: [0, 1, 2, 3] },
  { label: "May - Aug", months: [4, 5, 6, 7] },
  { label: "Sep - Dec", months: [8, 9, 10, 11] },
];

// Layout constants
const CELL_SIZE = 20;
const CELL_GAP = 4;
const MONTH_GAP = 28;
const DAY_LABEL_WIDTH = 28;
const QUAD_CELL_SIZE = 36;
const QUAD_CELL_GAP = 6;
const QUAD_DAY_LABEL_WIDTH = 38;

function MonthGrid({
  month,
  monthIndex,
  getEntryForDate,
  getFillColor,
  handleSaveEntry,
  showAllYear,
  showNumbers,
  animationDelay = 0,
}: {
  month: (typeof MONTHS_2026)[number];
  monthIndex: number;
  getEntryForDate: (dateKey: string) => DayEntry;
  getFillColor: (dateKey: string) => string;
  handleSaveEntry: (dateKey: string, entry: DayEntry) => void;
  showAllYear: boolean;
  showNumbers: boolean;
  animationDelay?: number;
}) {
  const monthData = generateCalendarData(month.startDay, month.days);
  const maxWeeks = 6;

  // Use larger sizes for quadrimester view, smaller for full year
  const cellSize = showAllYear ? CELL_SIZE : QUAD_CELL_SIZE;
  const cellGap = showAllYear ? CELL_GAP : QUAD_CELL_GAP;
  const dayLabelWidth = showAllYear ? DAY_LABEL_WIDTH : QUAD_DAY_LABEL_WIDTH;
  const fontSize = showAllYear ? 10 : 14;
  const labelFontSize = showAllYear ? 7 : 11;

  const svgWidth = dayLabelWidth + maxWeeks * (cellSize + cellGap);
  const svgHeight = 7 * (cellSize + cellGap) + 20;

  return (
    <motion.div
      animate={{
        filter: "blur(0px)",
        opacity: 1,
        scale: showAllYear ? 1.1 : 1,
      }}
      className="flex flex-col items-center"
      initial={{ filter: "blur(8px)", opacity: 0, scale: 0.95 }}
      transition={{
        delay: animationDelay,
        duration: 0.4,
        ease: "easeOut",
      }}
    >
      {/** biome-ignore lint/a11y/noSvgWithoutTitle: Calendar month grid */}
      <svg
        aria-label={`${month.name} 2026 Mood Calendar`}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight + (showAllYear ? 10 : 20)}`}
        width={svgWidth}
        xmlns="http://www.w3.org/2000/svg"
      >
        <g>
          {DAY_LABELS.map((label, i) => (
            <text
              dominantBaseline="middle"
              fill="#888888"
              fontFamily="system-ui, -apple-system, sans-serif"
              fontSize={labelFontSize}
              fontWeight="500"
              key={label}
              x="0"
              y={cellSize / 2 + i * (cellSize + cellGap)}
            >
              {label}
            </text>
          ))}
        </g>

        {monthData.map((cell) => {
          const x = dayLabelWidth + cell.week * (cellSize + cellGap);
          const y = cell.dayOfWeek * (cellSize + cellGap);
          const dateKey = getDateKey(2026, monthIndex + 1, cell.day);
          const entry = getEntryForDate(dateKey);
          const displayDate = new Date(
            2026,
            monthIndex,
            cell.day
          ).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          });

          return (
            <DatePopover
              dateKey={dateKey}
              displayDate={displayDate}
              entry={entry}
              key={dateKey}
              onSave={handleSaveEntry}
            >
              <g className="group cursor-pointer">
                <rect
                  className="transition-all duration-200 group-hover:opacity-80"
                  fill={getFillColor(dateKey)}
                  height={cellSize}
                  rx="4"
                  width={cellSize}
                  x={x}
                  y={y}
                />
                {showNumbers && (
                  <text
                    dominantBaseline="central"
                    fill={
                      getFillColor(dateKey) === "#323232"
                        ? "#666"
                        : getContrastColor(
                            Object.entries(MOOD_COLORS).find(
                              ([, v]) => v.color === getFillColor(dateKey)
                            )?.[0] || ""
                          )
                    }
                    fontFamily="system-ui, -apple-system, sans-serif"
                    fontSize={fontSize}
                    fontWeight="500"
                    textAnchor="middle"
                    x={x + cellSize / 2}
                    y={y + cellSize / 2}
                  >
                    {String(cell.day).padStart(2, "0")}
                  </text>
                )}
              </g>
            </DatePopover>
          );
        })}

        <text
          dominantBaseline="middle"
          fill="#ffffff"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontSize={showAllYear ? 10 : 14}
          fontWeight="600"
          textAnchor="middle"
          x={
            dayLabelWidth + (maxWeeks * (cellSize + cellGap)) / 2 - cellGap / 2
          }
          y={7 * (cellSize + cellGap) + (showAllYear ? 10 : 20)}
        >
          {month.name}
        </text>
      </svg>
    </motion.div>
  );
}

export function InteractiveCalendar({ className }: InteractiveCalendarProps) {
  const [calendarData, setCalendarData] = useLocalStorage<CalendarData>(
    "mood-calendar-2026-data",
    {}
  );
  const [currentQuadrimester, setCurrentQuadrimester] = useState(0);
  const [showAllYear, setShowAllYear] = useState(false);
  const [showNumbers, setShowNumbers] = useLocalStorage(
    "mood-calendar-show-numbers",
    true
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
      return calendarData[dateKey] ?? { mood: null, remark: "" };
    },
    [calendarData]
  );

  const getFillColor = useCallback(
    (dateKey: string): string => {
      const entry = getEntryForDate(dateKey);
      if (entry.mood) {
        return MOOD_COLORS[entry.mood].color;
      }
      return "#323232";
    },
    [getEntryForDate]
  );

  const currentMonths = showAllYear
    ? MONTHS_2026.map((_, i) => i)
    : QUADRIMESTERS[currentQuadrimester].months;

  const handlePrevQuadrimester = () => {
    setCurrentQuadrimester((prev) => (prev > 0 ? prev - 1 : 2));
  };

  const handleNextQuadrimester = () => {
    setCurrentQuadrimester((prev) => (prev < 2 ? prev + 1 : 0));
  };

  return (
    <div className={cn("flex min-h-0 flex-1 gap-2", className)}>
      <Card className="flex min-h-0 flex-1 flex-col gap-0 border-border/50 py-2">
        <CardHeader className="flex flex-row items-center justify-between px-3 pb-1">
          <CardTitle className="font-medium text-xs lowercase">
            mood calendar 2026
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              aria-label={
                showNumbers ? "Hide date numbers" : "Show date numbers"
              }
              className="size-6 p-0"
              onClick={() => setShowNumbers(!showNumbers)}
              size="sm"
              title={showNumbers ? "Hide numbers" : "Show numbers"}
              variant={showNumbers ? "default" : "outline"}
            >
              <svg
                aria-hidden="true"
                className="size-3"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </Button>
            <Button
              className="h-6 px-2 text-xs"
              onClick={() => setShowAllYear(!showAllYear)}
              size="sm"
              variant={showAllYear ? "default" : "outline"}
            >
              {showAllYear ? "quadrimester" : "full year"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 overflow-auto px-4 py-3">
          <AnimatePresence mode="wait">
            <motion.div
              animate={{ filter: "blur(0px)", opacity: 1 }}
              className={cn(
                "m-auto grid h-full w-full place-content-center items-center justify-center",
                showAllYear
                  ? "grid-cols-4 grid-rows-3"
                  : "grid-cols-2 grid-rows-2 gap-x-8 gap-y-4"
              )}
              exit={{ filter: "blur(4px)", opacity: 0 }}
              initial={{ filter: "blur(4px)", opacity: 0 }}
              key={showAllYear ? "full-year" : `quad-${currentQuadrimester}`}
              style={{ gap: showAllYear ? `${MONTH_GAP}px` : undefined }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              {currentMonths.map((monthIndex, i) => {
                const month = MONTHS_2026[monthIndex];
                return (
                  <MonthGrid
                    animationDelay={i * 0.05}
                    getEntryForDate={getEntryForDate}
                    getFillColor={getFillColor}
                    handleSaveEntry={handleSaveEntry}
                    key={month.name}
                    month={month}
                    monthIndex={monthIndex}
                    showAllYear={showAllYear}
                    showNumbers={showNumbers}
                  />
                );
              })}
            </motion.div>
          </AnimatePresence>
        </CardContent>
        <CardFooter className="flex items-center justify-end px-3 pt-1">
          {!showAllYear && (
            <div className="flex items-center gap-1">
              <Button
                aria-label="Previous quadrimester"
                className="size-6 p-0"
                onClick={handlePrevQuadrimester}
                size="sm"
                variant="ghost"
              >
                <svg
                  aria-hidden="true"
                  className="size-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path d="M15 19l-7-7 7-7" />
                </svg>
              </Button>
              <span className="min-w-16 text-center font-medium text-muted-foreground text-xs">
                {QUADRIMESTERS[currentQuadrimester].label}
              </span>
              <Button
                aria-label="Next quadrimester"
                className="size-6 p-0"
                onClick={handleNextQuadrimester}
                size="sm"
                variant="ghost"
              >
                <svg
                  aria-hidden="true"
                  className="size-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </Button>
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
