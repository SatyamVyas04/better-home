import {
  IconExternalLink,
  IconLoader2,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";
import { PreviewFallbackMedia } from "@/components/quick-links/preview-fallback-media";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/todo-scroll-area";
import { EASE_OUT } from "@/constants/quick-links";
import { getPreviewPlatform } from "@/lib/link-preview";
import { buildPreviewDescriptionText } from "@/lib/quick-links-preview-utils";
import type { QuickLinksListProps } from "@/types/quick-links";

const WWW_PREFIX_REGEX = /^www\./i;

const getDomainLabel = (url: string): string => {
  try {
    return new URL(url).hostname.replace(WWW_PREFIX_REGEX, "");
  } catch {
    return url;
  }
};

export function QuickLinksList({
  compactColumns = 3,
  displayMode,
  displayedLinks,
  ensureLinkPreview,
  failedPreviewImageUrls,
  getComparableUrl,
  loadingPreviewUrls,
  onCloseFloatingPreview,
  onDeleteLink,
  onMoveFloatingPreview,
  onOpenFloatingPreview,
  onScheduleFloatingPreviewClose,
  previewCache,
}: QuickLinksListProps) {
  const isListMode = displayMode === "list";
  const isCompactCardsMode = displayMode === "compact-cards";

  useEffect(() => {
    if (!isCompactCardsMode) {
      return;
    }

    for (const link of displayedLinks.slice(0, 24)) {
      ensureLinkPreview(link.url);
    }
  }, [displayedLinks, ensureLinkPreview, isCompactCardsMode]);

  const renderIconHoverGrid = () => {
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
  };

  const renderIconTitleList = () => {
    return (
      <ScrollArea className="min-h-0 flex-1" maskHeight={40}>
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
  };

  if (isListMode) {
    return renderIconTitleList();
  }

  if (!isCompactCardsMode) {
    return renderIconHoverGrid();
  }

  let compactGridColumnsClass = "md:grid-cols-3";
  if (compactColumns === 4) {
    compactGridColumnsClass = "md:grid-cols-4";
  } else if (compactColumns === 2) {
    compactGridColumnsClass = "md:grid-cols-2";
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 md:hidden">{renderIconTitleList()}</div>

      <div className="hidden min-h-0 flex-1 md:block">
        <ScrollArea className="h-full" maskHeight={40}>
          <div className={`grid gap-2 pr-0.5 ${compactGridColumnsClass}`}>
            <AnimatePresence mode="popLayout">
              {displayedLinks.map((link) => {
                const comparableUrl = getComparableUrl(link.url);
                const previewEntry = previewCache[comparableUrl];
                const previewSiteName =
                  previewEntry?.siteName || getDomainLabel(link.url);
                const previewMetadataTitle =
                  previewEntry?.title || previewSiteName || "bookmark";
                const previewDisplayTitle =
                  link.title || previewMetadataTitle || "saved link";
                const previewDescriptionText = buildPreviewDescriptionText({
                  customTitle: link.title,
                  description: previewEntry?.description || "",
                  metadataTitle: previewMetadataTitle,
                  siteName: previewSiteName,
                  url: link.url,
                });
                const previewImageUrl =
                  previewEntry?.imageDataUrl || previewEntry?.imageUrl || "";
                const isPreviewImageMarkedFailed = Boolean(
                  previewImageUrl && failedPreviewImageUrls[previewImageUrl]
                );
                const hasPreviewImage = Boolean(previewImageUrl);
                const isPreviewLoading =
                  loadingPreviewUrls.includes(comparableUrl);

                return (
                  <motion.article
                    animate={{
                      filter: "blur(0px)",
                      opacity: 1,
                      scale: 1,
                      y: 0,
                    }}
                    className="group relative overflow-hidden rounded-lg border border-border/50 bg-card/65 shadow-[0_14px_30px_-24px_hsl(var(--foreground)/0.6)]"
                    exit={{
                      filter: "blur(3px)",
                      opacity: 0,
                      scale: 0.95,
                      y: 6,
                    }}
                    initial={{
                      filter: "blur(3px)",
                      opacity: 0,
                      scale: 0.95,
                      y: 8,
                    }}
                    key={link.id}
                    layout
                    transition={{ duration: 0.22, ease: EASE_OUT }}
                  >
                    <a
                      className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      href={link.url}
                      onClick={onCloseFloatingPreview}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      <div className="relative aspect-[1.91/1] overflow-hidden border-border/35 border-b bg-muted/25">
                        {hasPreviewImage && !isPreviewImageMarkedFailed ? (
                          <img
                            alt={previewDisplayTitle}
                            className="h-full w-full object-cover object-center"
                            decoding="async"
                            fetchPriority="high"
                            height={188}
                            loading="eager"
                            src={previewImageUrl}
                            width={360}
                          />
                        ) : (
                          <PreviewFallbackMedia
                            favicon={link.favicon}
                            platform={
                              previewEntry?.platform ||
                              getPreviewPlatform(link.url)
                            }
                            title={previewDisplayTitle}
                          />
                        )}

                        <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/30 via-black/6 to-transparent" />

                        {isPreviewLoading ? (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/22 backdrop-blur-[1px]">
                            <IconLoader2 className="size-4 animate-spin text-white" />
                          </div>
                        ) : null}

                        <p className="absolute right-1.5 bottom-1.5 left-1.5 truncate rounded bg-black/42 px-1.5 py-0.5 text-[9px] text-white/92 normal-case backdrop-blur-[1px]">
                          {previewSiteName}
                        </p>
                      </div>

                      <div className="space-y-1.5 px-2.5 pt-2 pb-2.5">
                        <div className="flex items-center gap-1.5">
                          {link.favicon ? (
                            <img
                              alt={previewDisplayTitle}
                              className="size-3.5 shrink-0"
                              height={14}
                              loading="lazy"
                              src={link.favicon}
                              width={14}
                            />
                          ) : (
                            <IconExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
                          )}
                          <p className="min-w-0 flex-1 overflow-hidden text-[11px] normal-case leading-3.5 tracking-tight [-webkit-box-orient:vertical] [-webkit-line-clamp:1] [display:-webkit-box]">
                            {previewDisplayTitle}
                          </p>
                        </div>
                        <p className="h-7 min-w-0 overflow-hidden text-[10px] text-muted-foreground/80 normal-case leading-3.5 tracking-normal [-webkit-box-orient:vertical] [-webkit-line-clamp:2] [display:-webkit-box]">
                          {previewDescriptionText}
                        </p>
                      </div>
                    </a>

                    <button
                      className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-destructive/95 text-white opacity-0 transition-[transform,opacity,background-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-destructive focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 active:scale-[0.94] group-focus-within:opacity-100 group-hover:opacity-100"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onDeleteLink(link.id);
                      }}
                      type="button"
                    >
                      <IconX className="size-2.5" />
                      <span className="sr-only">Delete {link.title}</span>
                    </button>
                  </motion.article>
                );
              })}
              {displayedLinks.length === 0 ? (
                <motion.div
                  animate={{ opacity: 1 }}
                  className="col-span-full flex h-20 items-center justify-center"
                  exit={{ opacity: 0 }}
                  initial={{ opacity: 0 }}
                  key="empty-message-compact-grid"
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
      </div>
    </div>
  );
}
