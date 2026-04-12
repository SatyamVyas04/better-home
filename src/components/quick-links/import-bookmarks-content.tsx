import { IconExternalLink, IconLoader2 } from "@tabler/icons-react";
import { useMemo } from "react";
import type { ImportBookmarksContentProps } from "@/components/quick-links/model/quick-links.types";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export function ImportBookmarksContent({
  bookmarkOptions,
  importError,
  isImportLoading,
  onToggleBookmarkSelection,
  selectedBookmarkIds,
}: ImportBookmarksContentProps) {
  const selectedSet = useMemo(
    () => new Set(selectedBookmarkIds),
    [selectedBookmarkIds]
  );

  if (isImportLoading) {
    return (
      <div className="flex h-56 items-center justify-center gap-2 rounded-md border border-border/50 bg-muted/20 px-3">
        <IconLoader2 className="size-3.5 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground text-xs lowercase">
          loading bookmarks...
        </p>
      </div>
    );
  }

  if (importError) {
    return (
      <div className="flex h-56 items-center justify-center rounded-md border border-border/50 border-dashed bg-muted/20 px-3 text-center">
        <p className="text-muted-foreground text-xs lowercase">{importError}</p>
      </div>
    );
  }

  if (bookmarkOptions.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center rounded-md border border-border/50 border-dashed bg-muted/20 px-3 text-center">
        <p className="text-muted-foreground text-xs lowercase">
          no bookmarks available to import
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-56 rounded-md border border-border/50 bg-muted/20 p-1">
      <div className="space-y-1 pr-2">
        {bookmarkOptions.map((bookmark) => {
          const isSelected = selectedSet.has(bookmark.id);

          return (
            <label
              className={cn(
                "flex w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-md border px-2 py-1.5 text-left transition-[transform,background-color,border-color,filter] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] focus-within:bg-accent/30 focus-within:ring-2 focus-within:ring-ring/30 hover:bg-accent/30 active:scale-[0.99]",
                isSelected
                  ? "border-primary/35 bg-primary/10 ring-1 ring-primary/20"
                  : "border-transparent"
              )}
              key={bookmark.id}
            >
              <input
                checked={isSelected}
                className="sr-only"
                onChange={() => onToggleBookmarkSelection(bookmark.id)}
                type="checkbox"
              />
              <Checkbox
                aria-hidden
                checked={isSelected}
                className="pointer-events-none self-center"
                tabIndex={-1}
              />
              {bookmark.favicon ? (
                <img
                  alt={bookmark.title}
                  className="size-3.5 shrink-0 rounded-sm"
                  height={14}
                  loading="lazy"
                  src={bookmark.favicon}
                  width={14}
                />
              ) : (
                <IconExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
              )}
              <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                <p className="wrap-anywhere overflow-hidden text-xs lowercase leading-tight [-webkit-box-orient:vertical] [-webkit-line-clamp:2] [display:-webkit-box]">
                  {bookmark.title}
                </p>
                <p className="wrap-anywhere overflow-hidden text-[10px] text-muted-foreground lowercase leading-tight [-webkit-box-orient:vertical] [-webkit-line-clamp:2] [display:-webkit-box]">
                  {bookmark.location}
                </p>
              </div>
            </label>
          );
        })}
      </div>
    </ScrollArea>
  );
}
