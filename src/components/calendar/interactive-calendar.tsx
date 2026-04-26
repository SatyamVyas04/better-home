import {
  Icon123,
  IconCalendarMonth,
  IconCalendarPin,
  IconCaretLeftFilled,
  IconCaretRightFilled,
} from "@tabler/icons-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCalendarData } from "@/hooks/use-calendar-data";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { MOOD_COLORS } from "@/lib/calendar-constants";
import {
  CALENDAR_END_YEAR,
  CALENDAR_START_YEAR,
  getMonthsForYear,
  QUADRIMESTERS,
} from "@/lib/calendar-utils";
import { runTrackedUserAction } from "@/lib/session-history";
import { cn } from "@/lib/utils";
import type { InteractiveCalendarProps } from "@/types/calendar";
import { MonthGrid } from "./month-grid";

const YEAR_OPTIONS = Array.from(
  { length: CALENDAR_END_YEAR - CALENDAR_START_YEAR + 1 },
  (_, index) => {
    const year = CALENDAR_START_YEAR + index;
    return {
      label: String(year),
      value: year,
    };
  }
);

export function InteractiveCalendar({ className }: InteractiveCalendarProps) {
  const { getEntryForDate, handleSaveEntry } = useCalendarData();
  const today = new Date();
  const currentYearFromDate = today.getFullYear();
  const [currentYear, setCurrentYear] = useState(() => {
    const now = new Date().getFullYear();
    return Math.min(Math.max(now, CALENDAR_START_YEAR), CALENDAR_END_YEAR);
  });
  const [currentQuadrimester, setCurrentQuadrimester] = useState(0);
  const [showAllYear, setShowAllYear] = useState(false);
  const [showNumbers, setShowNumbers] = useLocalStorage(
    "mood-calendar-show-numbers",
    true
  );
  const monthsForYear = getMonthsForYear(currentYear);

  const handleJumpToToday = useCallback(() => {
    const clampedYear = Math.min(
      Math.max(currentYearFromDate, CALENDAR_START_YEAR),
      CALENDAR_END_YEAR
    );
    setCurrentYear(clampedYear);
    if (clampedYear !== currentYear) {
      setShowAllYear(false);
    }
    const month = today.getMonth();
    const newQuadrimester = Math.floor(month / 4);
    setCurrentQuadrimester(newQuadrimester);
    setShowAllYear(false);
  }, [currentYear, currentYearFromDate, today]);

  const getFillColor = useCallback(
    (dateKey: string): string => {
      const entry = getEntryForDate(dateKey);
      if (entry.mood) {
        return MOOD_COLORS[entry.mood].color;
      }
      return "var(--muted)";
    },
    [getEntryForDate]
  );

  const currentMonths = showAllYear
    ? monthsForYear.map((_, i) => i)
    : QUADRIMESTERS[currentQuadrimester].months;

  const handlePrevQuadrimester = () => {
    setCurrentQuadrimester((prev) =>
      prev > 0 ? prev - 1 : QUADRIMESTERS.length - 1
    );
  };

  const handleNextQuadrimester = () => {
    setCurrentQuadrimester((prev) =>
      prev < QUADRIMESTERS.length - 1 ? prev + 1 : 0
    );
  };

  return (
    <div className={cn("flex min-h-0 flex-1 gap-2", className)}>
      <Card className="relative flex min-h-0 min-w-0 flex-1 flex-col gap-0 overflow-hidden border-border/50 p-0">
        <CardHeader className="px-3 py-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="font-medium text-xs lowercase">
              mood calendar
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button
                aria-label="Jump to today"
                className="h-8 w-8"
                onClick={handleJumpToToday}
                size="icon-sm"
                title="Jump to today"
              >
                <IconCalendarPin className="size-3.5" />
              </Button>
              <Button
                aria-label={
                  showNumbers ? "Hide date numbers" : "Show date numbers"
                }
                className="h-8 w-8"
                onClick={() => {
                  runTrackedUserAction("toggle calendar numbers", () => {
                    setShowNumbers(!showNumbers);
                  });
                }}
                size="icon-sm"
                title={showNumbers ? "Hide numbers" : "Show numbers"}
                variant={showNumbers ? "default" : "outline"}
              >
                <Icon123 className="size-3.5" />
              </Button>
              <Button
                aria-label={
                  showAllYear ? "Show quadrimester" : "Show full year"
                }
                className="h-8 w-8"
                onClick={() => setShowAllYear(!showAllYear)}
                size="icon-sm"
                title={showAllYear ? "Show quadrimester" : "Show full year"}
                variant={showAllYear ? "default" : "outline"}
              >
                <IconCalendarMonth className="size-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="relative flex max-h-196 flex-1 flex-col gap-1.5 px-3">
          <AnimatePresence mode="wait">
            <motion.div
              animate={{ filter: "blur(0px)", opacity: 1 }}
              className={cn(
                "calendar-grid flex h-full w-full scale-90 flex-col content-start items-center justify-start justify-items-center md:grid",
                showAllYear
                  ? "grid-cols-2 grid-rows-6 lg:grid-cols-4 lg:grid-rows-3"
                  : "grid-cols-2 grid-rows-2"
              )}
              exit={{ filter: "blur(4px)", opacity: 0 }}
              initial={{ filter: "blur(4px)", opacity: 0 }}
              key={`${currentYear}-${showAllYear ? "full-year" : `quad-${currentQuadrimester}`}`}
              style={{ gap: "12px" }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {currentMonths.map((monthIndex, i) => {
                const month = monthsForYear[monthIndex];
                return (
                  <MonthGrid
                    animationDelay={i * 0.05}
                    getEntryForDate={getEntryForDate}
                    getFillColor={getFillColor}
                    handleSaveEntry={handleSaveEntry}
                    key={`${currentYear}-${month.name}`}
                    month={month}
                    monthIndex={monthIndex}
                    showAllYear={showAllYear}
                    showNumbers={showNumbers}
                    year={currentYear}
                  />
                );
              })}
            </motion.div>
          </AnimatePresence>
        </CardContent>

        <CardFooter className="absolute right-2 bottom-2 flex items-center justify-end gap-1 rounded-full p-0 px-2 backdrop-blur-sm">
          {!showAllYear && (
            <div className="flex items-center gap-0.5">
              <Button
                aria-label="Previous quadrimester"
                className="size-7 p-0"
                onClick={handlePrevQuadrimester}
                size="icon-sm"
                variant="ghost"
              >
                <IconCaretLeftFilled className="size-3.5" />
              </Button>
              <span className="min-w-16 text-center font-medium text-[10px] text-muted-foreground lowercase">
                {QUADRIMESTERS[currentQuadrimester].label}
              </span>
              <Button
                aria-label="Next quadrimester"
                className="size-7 p-0"
                onClick={handleNextQuadrimester}
                size="icon-sm"
                variant="ghost"
              >
                <IconCaretRightFilled className="size-3.5" />
              </Button>
            </div>
          )}

          <Select
            onValueChange={(val: string) => setCurrentYear(Number(val))}
            value={String(currentYear)}
          >
            <SelectTrigger className="h-7 w-16 border-none bg-accent/50 px-1.5 font-medium text-[10px] lowercase tabular-nums hover:bg-accent focus:ring-0">
              <SelectValue placeholder="year" />
            </SelectTrigger>
            <SelectContent className="min-w-20">
              {YEAR_OPTIONS.map((opt) => (
                <SelectItem
                  className="text-[10px] lowercase"
                  key={opt.value}
                  value={String(opt.value)}
                >
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardFooter>
      </Card>
    </div>
  );
}
