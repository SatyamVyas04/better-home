import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { MOOD_COLORS, type MoodType } from "@/lib/calendar-constants";
import { getContrastColor } from "@/lib/calendar-utils";
import { cn } from "@/lib/utils";
import type { MoodSelectorProps } from "@/types/calendar";

export function MoodSelector({
  selectedMood,
  onSelectMood,
}: MoodSelectorProps) {
  const [hoveredMood, setHoveredMood] = useState<MoodType | null>(null);
  const activeMood = hoveredMood || selectedMood;

  return (
    <div className="space-y-2">
      <div className="flex flex-col items-center gap-3 py-1">
        <div className="flex gap-1.5">
          {Object.entries(MOOD_COLORS).map(([key, { color, label }]) => (
            <Button
              aria-label={label}
              aria-pressed={selectedMood === key}
              className={cn(
                "size-6 rounded-full border border-border/30 p-0 transition-transform duration-200 ease-out hover:scale-110",
                selectedMood === key && "scale-110"
              )}
              key={key}
              onClick={() => onSelectMood(key as MoodType)}
              onMouseEnter={() => setHoveredMood(key as MoodType)}
              onMouseLeave={() => setHoveredMood(null)}
              size="icon-sm"
              style={{
                backgroundColor: color,
                boxShadow:
                  selectedMood === key
                    ? `0 0 0 2px var(--background), 0 0 0 4px ${color}`
                    : undefined,
              }}
              type="button"
              variant="ghost"
            >
              <span className="sr-only">{label}</span>
            </Button>
          ))}
        </div>

        <div
          className={cn(
            "flex h-7 min-w-40 items-center justify-center rounded-full px-4 font-medium text-xs transition-colors duration-300",
            !activeMood && "bg-muted/30 text-muted-foreground"
          )}
          style={{
            backgroundColor: activeMood
              ? MOOD_COLORS[activeMood].color
              : "var(--muted)",
            color: activeMood ? getContrastColor(activeMood) : undefined,
            textShadow: "0 0 4px rgba(0, 0, 0, 1)",
          }}
        >
          <AnimatePresence mode="wait">
            <motion.span
              animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
              exit={{ filter: "blur(4px)", opacity: 0, y: -5 }}
              initial={{ filter: "blur(4px)", opacity: 0, y: 5 }}
              key={activeMood || "none"}
              transition={{ duration: 0.2 }}
            >
              {activeMood ? MOOD_COLORS[activeMood].label : "select mood"}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
