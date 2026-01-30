// Date entry popover with mood, work log, and journal inputs

import { IconTrash } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MOOD_COLORS, type MoodType } from "@/lib/calendar-constants";
import type { DatePopoverProps } from "@/types/calendar";
import { MoodSelector } from "./mood-selector";

export function DatePopover({
  dateKey,
  entry,
  onSave,
  displayDate,
  children,
}: DatePopoverProps) {
  const [open, setOpen] = useState(false);
  const [selectedMood, setSelectedMood] = useState<MoodType | null>(entry.mood);
  const [workLog, setWorkLog] = useState(entry.workLog || "");
  const [journal, setJournal] = useState(entry.journal || "");
  const [isHolding, setIsHolding] = useState(false);
  const holdTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setSelectedMood(entry.mood);
    setWorkLog(entry.workLog || "");
    setJournal(entry.journal || "");
  }, [entry.mood, entry.workLog, entry.journal]);

  const handleSave = () => {
    onSave(dateKey, { mood: selectedMood, workLog, journal });
    setOpen(false);
  };

  const handleClear = () => {
    setSelectedMood(null);
    setWorkLog("");
    setJournal("");
    onSave(dateKey, { mood: null, workLog: "", journal: "" });
    setIsHolding(false);
    setOpen(false);
  };

  const handleMouseDown = () => {
    setIsHolding(true);
    holdTimeoutRef.current = setTimeout(() => {
      handleClear();
    }, 2000);
  };

  const handleMouseUp = () => {
    setIsHolding(false);
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
  };

  const hasContent = Boolean(entry.workLog || entry.journal);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <TooltipProvider>
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>{children}</PopoverTrigger>
          </TooltipTrigger>
          {hasContent && (
            <TooltipContent
              className="min-w-40 max-w-60 p-2.5 text-xs"
              side="top"
            >
              <div className="flex flex-col gap-2">
                <div className="flex flex-row items-center justify-between">
                  <h2 className="font-medium text-sm">
                    {Intl.DateTimeFormat().format(new Date(dateKey))}
                  </h2>
                  <div
                    className="h-4 w-4 rounded-full border"
                    style={{
                      backgroundColor: entry.mood
                        ? MOOD_COLORS[entry.mood].color
                        : "var(--muted)",
                      borderColor: entry.mood
                        ? MOOD_COLORS[entry.mood].color
                        : undefined,
                    }}
                  />
                </div>
                {entry.workLog && (
                  <div className="space-y-0.5">
                    <span className="font-semibold text-[10px] text-muted-foreground uppercase tracking-wider">
                      Work
                    </span>
                    <p className="wrap-break-word line-clamp-8 text-wrap text-xs">
                      {entry.workLog}
                    </p>
                  </div>
                )}
                {entry.journal && (
                  <div className="space-y-0.5">
                    <span className="font-semibold text-[10px] text-muted-foreground uppercase tracking-wider">
                      Journal
                    </span>
                    <p className="wrap-break-word line-clamp-8 text-wrap text-xs">
                      {entry.journal}
                    </p>
                  </div>
                )}
              </div>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
      <PopoverContent className="w-72" side="right" sideOffset={12}>
        <div className="space-y-4 text-center">
          <div className="space-y-0.5">
            <h4 className="font-medium text-foreground text-sm">
              {displayDate}
            </h4>
            <p className="text-muted-foreground text-xs">how was your day?</p>
          </div>

          <MoodSelector
            onSelectMood={setSelectedMood}
            selectedMood={selectedMood}
          />

          <div className="space-y-1.5">
            <Label
              className="font-medium text-xs lowercase"
              htmlFor={`work-${dateKey}`}
            >
              work log
            </Label>
            <Textarea
              className="min-h-15 resize-y"
              id={`work-${dateKey}`}
              onChange={(e) => setWorkLog(e.target.value)}
              placeholder="what did you get done today?"
              rows={3}
              value={workLog}
            />
          </div>

          <div className="space-y-1.5">
            <Label
              className="font-medium text-xs lowercase"
              htmlFor={`journal-${dateKey}`}
            >
              journal
            </Label>
            <Textarea
              className="min-h-15 resize-y"
              id={`journal-${dateKey}`}
              onChange={(e) => setJournal(e.target.value)}
              placeholder="how did it go overall?"
              rows={3}
              value={journal}
            />
          </div>

          <div className="flex gap-2">
            <Button
              className="relative flex-1 cursor-pointer overflow-clip bg-transparent text-xs active:scale-95"
              onMouseDown={handleMouseDown}
              onMouseLeave={handleMouseUp}
              onMouseUp={handleMouseUp}
              onTouchEnd={handleMouseUp}
              onTouchStart={handleMouseDown}
              size="sm"
              variant="outline"
            >
              <div
                aria-hidden="true"
                className={`absolute flex h-full w-full flex-row items-center justify-center gap-2 bg-destructive transition-[clip-path] ${
                  isHolding
                    ? "duration-2000 ease-linear [clip-path:inset(0px_0px_0px_0px)]"
                    : "duration-200 ease-out [clip-path:inset(0px_100%_0px_0px)]"
                }`}
              >
                <IconTrash className="size-3" />
                <span>hold to clear</span>
              </div>
              <div className="flex flex-row items-center gap-2">
                <IconTrash className="size-3" />
                <span>hold to clear</span>
              </div>
            </Button>
            <Button
              className="flex-1 cursor-pointer text-xs"
              onClick={handleSave}
              size="sm"
            >
              save
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
