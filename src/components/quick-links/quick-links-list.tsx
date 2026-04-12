import { IconExternalLink, IconTrash, IconX } from "@tabler/icons-react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EASE_OUT } from "@/constants/quick-links";
import type { QuickLinksListProps } from "@/types/quick-links";

export function QuickLinksList({
  displayedLinks,
  expanded,
  onCloseFloatingPreview,
  onDeleteLink,
  onMoveFloatingPreview,
  onOpenFloatingPreview,
  onScheduleFloatingPreviewClose,
}: QuickLinksListProps) {
  if (expanded) {
    return (
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex min-h-full flex-col space-y-0.5 pr-0">
          <AnimatePresence mode="popLayout">
            {displayedLinks.map((link) => (
              <motion.a
                animate={{ filter: "blur(0px)", opacity: 1, scale: 1, x: 0 }}
                className="group flex items-center gap-2 rounded-md border border-border/50 px-1.5 py-1 transition-[transform,background-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-accent/30 focus-visible:bg-accent/30 focus-visible:ring-2 focus-visible:ring-ring/30 active:scale-[0.98]"
                exit={{
                  filter: "blur(4px)",
                  opacity: 0,
                  scale: 0.95,
                  x: 10,
                }}
                href={link.url}
                initial={{
                  filter: "blur(4px)",
                  opacity: 0,
                  scale: 0.95,
                  x: 10,
                }}
                key={link.id}
                layout
                rel="noopener noreferrer"
                target="_blank"
                transition={{ duration: 0.22, ease: EASE_OUT }}
              >
                {link.favicon ? (
                  <img
                    alt={link.title}
                    className="size-4 h-full shrink-0"
                    height={16}
                    loading="lazy"
                    src={link.favicon}
                    width={16}
                  />
                ) : (
                  <IconExternalLink className="size-4 shrink-0 text-muted-foreground" />
                )}
                <span className="flex-1 truncate text-xs">{link.title}</span>
                <Button
                  className="size-6 opacity-0 transition-[transform,opacity] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] focus-visible:opacity-100 active:scale-[0.95] group-focus-within:opacity-100 group-hover:opacity-100"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onDeleteLink(link.id);
                  }}
                  size="icon-sm"
                  variant="ghost"
                >
                  <IconTrash className="size-3.5 text-destructive" />
                  <span className="sr-only">Delete {link.title}</span>
                </Button>
              </motion.a>
            ))}
            {displayedLinks.length === 0 ? (
              <motion.div
                animate={{ opacity: 1 }}
                className="flex flex-1 items-center justify-center py-8"
                exit={{ opacity: 0 }}
                initial={{ opacity: 0 }}
                key="empty-message-list"
                transition={{ duration: 0.3 }}
              >
                <p className="text-muted-foreground text-xs lowercase">
                  no links saved
                </p>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </ScrollArea>
    );
  }

  return (
    <div className="min-h-0 flex-1">
      <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-11 md:grid-cols-15 lg:grid-cols-7">
        <AnimatePresence mode="popLayout">
          {displayedLinks.map((link) => (
            <motion.div
              animate={{ filter: "blur(0px)", opacity: 1, scale: 1 }}
              exit={{ filter: "blur(4px)", opacity: 0, scale: 0.9 }}
              initial={{ filter: "blur(4px)", opacity: 0, scale: 0.5 }}
              key={link.id}
              layout
              transition={{ duration: 0.22, ease: EASE_OUT }}
            >
              <div className="group relative w-fit">
                <a
                  className="relative -m-1 block p-1"
                  href={link.url}
                  onBlur={onScheduleFloatingPreviewClose}
                  onClick={(event) => {
                    event.currentTarget.blur();
                    onCloseFloatingPreview();
                  }}
                  onFocus={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    onOpenFloatingPreview(
                      link,
                      rect.right,
                      rect.top + rect.height / 2,
                      { immediate: true }
                    );
                  }}
                  onMouseEnter={(event) =>
                    onOpenFloatingPreview(link, event.clientX, event.clientY)
                  }
                  onMouseLeave={onScheduleFloatingPreviewClose}
                  onMouseMove={(event) =>
                    onMoveFloatingPreview(event.clientX, event.clientY)
                  }
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <span className="flex size-8 items-center justify-center rounded-md border border-border/50 transition-[transform,background-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-accent/30 focus-visible:bg-accent/30 focus-visible:ring-2 focus-visible:ring-ring/30 active:scale-[0.97]">
                    {link.favicon ? (
                      <img
                        alt={link.title}
                        className="size-4"
                        height={16}
                        loading="lazy"
                        src={link.favicon}
                        width={16}
                      />
                    ) : (
                      <IconExternalLink className="size-4 text-muted-foreground" />
                    )}
                  </span>
                </a>
                <button
                  className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-destructive text-white opacity-0 transition-[transform,opacity,background-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-destructive/90 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/80 active:scale-[0.94] group-focus-within:opacity-100 group-hover:opacity-100"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onDeleteLink(link.id);
                  }}
                  onMouseEnter={(event) =>
                    onOpenFloatingPreview(link, event.clientX, event.clientY)
                  }
                  onMouseLeave={onScheduleFloatingPreviewClose}
                  onMouseMove={(event) =>
                    onMoveFloatingPreview(event.clientX, event.clientY)
                  }
                  type="button"
                >
                  <IconX className="size-2" />
                  <span className="sr-only">Delete {link.title}</span>
                </button>
              </div>
            </motion.div>
          ))}
          {displayedLinks.length === 0 ? (
            <motion.div
              animate={{ opacity: 1 }}
              className="col-span-full flex h-8 items-center justify-center"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              key="empty-message-grid"
              transition={{ duration: 0.3 }}
            >
              <p className="text-muted-foreground text-xs lowercase">
                no links saved
              </p>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
