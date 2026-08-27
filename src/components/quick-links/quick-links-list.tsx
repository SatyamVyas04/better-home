import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  type DropAnimation,
  defaultDropAnimationSideEffects,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  IconExternalLink,
  IconLoader2,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { PreviewFallbackMedia } from "@/components/quick-links/preview-fallback-media";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/todo-scroll-area";
import { EASE_OUT } from "@/constants/quick-links";
import {
  getPreviewPlatform,
  type LinkPreviewCacheEntry,
  type LinkPreviewPlatform,
} from "@/lib/link-preview";
import { buildPreviewDescriptionText } from "@/lib/quick-links-preview-utils";
import type { QuickLink, QuickLinksListProps } from "@/types/quick-links";

const WWW_PREFIX_REGEX = /^www\./i;

const dropAnimationConfig: DropAnimation = {
  duration: 220,
  easing: "cubic-bezier(0.16, 1, 0.3, 1)",
  sideEffects: defaultDropAnimationSideEffects({
    styles: {
      active: {
        opacity: "0.4",
      },
    },
  }),
};

const getDomainLabel = (url: string): string => {
  try {
    return new URL(url).hostname.replace(WWW_PREFIX_REGEX, "");
  } catch {
    return url;
  }
};

interface CompactCardContentProps {
  isDragging?: boolean;
  isOverlay?: boolean;
  isPreviewImageMarkedFailed?: boolean;
  link: QuickLink;
  loadingPreviewUrls: string[];
  onCloseFloatingPreview: () => void;
  onDeleteLink?: (id: string) => void;
  previewEntry?: LinkPreviewCacheEntry;
  previewImageUrl?: string;
}

interface QuickLinkDisplay {
  description: string;
  displayTitle: string;
  imageUrl: string;
  metadataTitle: string;
  platform: LinkPreviewPlatform;
  siteName: string;
}

function getQuickLinkDisplay(
  link: QuickLink,
  previewEntry?: LinkPreviewCacheEntry
): QuickLinkDisplay {
  const siteName = previewEntry?.siteName || getDomainLabel(link.url);
  const metadataTitle = previewEntry?.title || siteName || "bookmark";
  const displayTitle = link.title || metadataTitle || "saved link";
  const description = previewEntry?.description || "";
  const imageUrl = previewEntry?.imageDataUrl || previewEntry?.imageUrl || "";
  const platform = previewEntry?.platform || getPreviewPlatform(link.url);

  return {
    description,
    displayTitle,
    imageUrl,
    metadataTitle,
    platform,
    siteName,
  };
}

function CompactCardContent({
  isDragging = false,
  isOverlay = false,
  isPreviewImageMarkedFailed = false,
  link,
  loadingPreviewUrls,
  onCloseFloatingPreview,
  onDeleteLink,
  previewEntry,
  previewImageUrl,
}: CompactCardContentProps) {
  const linkDisplay = getQuickLinkDisplay(link, previewEntry);
  const previewDescriptionText = buildPreviewDescriptionText({
    customTitle: link.title,
    description: linkDisplay.description,
    metadataTitle: linkDisplay.metadataTitle,
    siteName: linkDisplay.siteName,
    url: link.url,
  });
  const hasPreviewImage = Boolean(previewImageUrl);
  const isPreviewLoading = loadingPreviewUrls.includes(link.url.toLowerCase());

  return (
    <article
      className={`group relative overflow-hidden rounded-lg border border-border/50 bg-card/65 select-none transition-shadow duration-150 ease-out ${
        isOverlay
          ? "cursor-grabbing shadow-2xl ring-2 ring-primary/40"
          : isDragging
            ? "opacity-0"
            : "cursor-grab active:cursor-grabbing shadow-[0_14px_30px_-24px_hsl(var(--foreground)/0.6)]"
      }`}
    >
      <a
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        draggable={false}
        href={link.url}
        onClick={onCloseFloatingPreview}
        onDragStart={(event) => event.preventDefault()}
        rel="noopener noreferrer"
        target="_blank"
      >
        <div className="relative aspect-[1.91/1] overflow-hidden border-border/35 border-b bg-muted/25">
          {hasPreviewImage && !isPreviewImageMarkedFailed ? (
            <img
              alt={linkDisplay.displayTitle}
              className="h-full w-full object-cover object-center"
              decoding="async"
              draggable={false}
              fetchPriority="high"
              height={188}
              loading="eager"
              src={previewImageUrl}
              width={360}
            />
          ) : (
            <PreviewFallbackMedia
              favicon={link.favicon}
              platform={linkDisplay.platform}
              title={linkDisplay.displayTitle}
            />
          )}

          <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/30 via-black/6 to-transparent" />

          {isPreviewLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/22 backdrop-blur-[1px]">
              <IconLoader2 className="size-4 animate-spin text-white" />
            </div>
          ) : null}

          <p className="absolute right-1.5 bottom-1.5 left-1.5 truncate rounded bg-black/42 px-1.5 py-0.5 text-[9px] text-white/92 normal-case backdrop-blur-[1px]">
            {linkDisplay.siteName}
          </p>
        </div>

        <div className="space-y-1.5 px-2.5 pt-2 pb-2.5">
          <div className="flex items-center gap-1.5">
            {link.favicon ? (
              <img
                alt={linkDisplay.displayTitle}
                className="size-3.5 shrink-0"
                draggable={false}
                height={14}
                loading="lazy"
                src={link.favicon}
                width={14}
              />
            ) : (
              <IconExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
            )}
            <p className="min-w-0 flex-1 overflow-hidden text-[11px] normal-case leading-3.5 tracking-tight [-webkit-box-orient:vertical] [-webkit-line-clamp:1] [display:-webkit-box]">
              {linkDisplay.displayTitle}
            </p>
          </div>
          <p className="h-7 min-w-0 overflow-hidden text-[10px] text-muted-foreground/80 normal-case leading-3.5 tracking-normal [-webkit-box-orient:vertical] [-webkit-line-clamp:2] [display:-webkit-box]">
            {previewDescriptionText}
          </p>
        </div>
      </a>

      {onDeleteLink && !isOverlay && (
        <button
          className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-destructive/95 text-white opacity-0 transition-[transform,opacity,background-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-destructive focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 active:scale-[0.94] group-focus-within:opacity-100 group-hover:opacity-100"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onDeleteLink(link.id);
          }}
          onPointerDown={(event) => event.stopPropagation()}
          type="button"
        >
          <IconX className="size-2.5" />
          <span className="sr-only">Delete {link.title}</span>
        </button>
      )}
    </article>
  );
}

function SortableCompactCard({
  failedPreviewImageUrls,
  getComparableUrl,
  link,
  loadingPreviewUrls,
  onCloseFloatingPreview,
  onDeleteLink,
  previewCache,
}: {
  failedPreviewImageUrls: Record<string, true>;
  getComparableUrl: (url: string) => string;
  link: QuickLink;
  loadingPreviewUrls: string[];
  onCloseFloatingPreview: () => void;
  onDeleteLink: (id: string) => void;
  previewCache: Record<string, LinkPreviewCacheEntry>;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: link.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const comparableUrl = getComparableUrl(link.url);
  const previewEntry = previewCache[comparableUrl];
  const previewImageUrl =
    previewEntry?.imageDataUrl || previewEntry?.imageUrl || "";
  const isPreviewImageMarkedFailed = Boolean(
    previewImageUrl && failedPreviewImageUrls[previewImageUrl]
  );

  return (
    <motion.div
      animate={{ filter: "blur(0px)", opacity: 1, scale: 1, y: 0 }}
      exit={{ filter: "blur(3px)", opacity: 0, scale: 0.95, y: 6 }}
      initial={{ filter: "blur(3px)", opacity: 0, scale: 0.95, y: 8 }}
      layout="position"
      ref={setNodeRef}
      style={style}
      transition={{ duration: 0.22, ease: EASE_OUT }}
      {...attributes}
      {...listeners}
    >
      {isDragging ? (
        <div className="h-full min-h-[148px] w-full rounded-lg border-2 border-dashed border-primary/55 bg-primary/10 transition-colors" />
      ) : (
        <CompactCardContent
          isPreviewImageMarkedFailed={isPreviewImageMarkedFailed}
          link={link}
          loadingPreviewUrls={loadingPreviewUrls}
          onCloseFloatingPreview={onCloseFloatingPreview}
          onDeleteLink={onDeleteLink}
          previewEntry={previewEntry}
          previewImageUrl={previewImageUrl}
        />
      )}
    </motion.div>
  );
}

function SortableListItem({
  link,
  onDeleteLink,
}: {
  link: QuickLink;
  onDeleteLink: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: link.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <motion.div
      animate={{ filter: "blur(0px)", opacity: 1, scale: 1, x: 0 }}
      className="relative"
      exit={{ filter: "blur(4px)", opacity: 0, scale: 0.95, x: 10 }}
      initial={{ filter: "blur(4px)", opacity: 0, scale: 0.95, x: 10 }}
      layout="position"
      ref={setNodeRef}
      style={style}
      transition={{ duration: 0.22, ease: EASE_OUT }}
      {...attributes}
      {...listeners}
    >
      {isDragging ? (
        <div className="h-7 w-full rounded-md border-2 border-dashed border-primary/55 bg-primary/10" />
      ) : (
        <a
          className="group flex cursor-grab select-none items-center gap-2 rounded-md border border-border/50 px-1.5 py-1 transition-[transform,background-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-accent/30 focus-visible:bg-accent/30 focus-visible:ring-2 focus-visible:ring-ring/30 active:cursor-grabbing active:scale-[0.98]"
          draggable={false}
          href={link.url}
          onDragStart={(event) => event.preventDefault()}
          rel="noopener noreferrer"
          target="_blank"
        >
          {link.favicon ? (
            <img
              alt={link.title}
              className="size-4 h-full shrink-0"
              draggable={false}
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
            onPointerDown={(event) => event.stopPropagation()}
            size="icon-sm"
            variant="ghost"
          >
            <IconTrash className="size-3.5 text-destructive" />
            <span className="sr-only">Delete {link.title}</span>
          </Button>
        </a>
      )}
    </motion.div>
  );
}

function SortableIconItem({
  link,
  onCloseFloatingPreview,
  onDeleteLink,
  onMoveFloatingPreview,
  onOpenFloatingPreview,
  onScheduleFloatingPreviewClose,
}: {
  link: QuickLink;
  onCloseFloatingPreview: () => void;
  onDeleteLink: (id: string) => void;
  onMoveFloatingPreview: (x: number, y: number) => void;
  onOpenFloatingPreview: (
    link: QuickLink,
    x: number,
    y: number,
    options?: { immediate?: boolean }
  ) => void;
  onScheduleFloatingPreviewClose: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: link.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <motion.div
      animate={{ filter: "blur(0px)", opacity: 1, scale: 1 }}
      className="relative"
      exit={{ filter: "blur(4px)", opacity: 0, scale: 0.9 }}
      initial={{ filter: "blur(4px)", opacity: 0, scale: 0.5 }}
      layout="position"
      ref={setNodeRef}
      style={style}
      transition={{ duration: 0.22, ease: EASE_OUT }}
      {...attributes}
      {...listeners}
    >
      {isDragging ? (
        <span className="flex size-8 items-center justify-center rounded-md border-2 border-dashed border-primary/55 bg-primary/10" />
      ) : (
        <div className="group relative w-fit">
          <a
            className="relative -m-1 block cursor-grab select-none p-1 active:cursor-grabbing"
            draggable={false}
            href={link.url}
            onBlur={onScheduleFloatingPreviewClose}
            onClick={(event) => {
              event.currentTarget.blur();
              onCloseFloatingPreview();
            }}
            onDragStart={(event) => event.preventDefault()}
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
                  draggable={false}
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
            onPointerDown={(event) => event.stopPropagation()}
            type="button"
          >
            <IconX className="size-2" />
            <span className="sr-only">Delete {link.title}</span>
          </button>
        </div>
      )}
    </motion.div>
  );
}

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
  onReorder,
  onScheduleFloatingPreviewClose,
  previewCache,
}: QuickLinksListProps) {
  const isListMode = displayMode === "list";
  const isCompactCardsMode = displayMode === "compact-cards";
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [items, setItems] = useState(displayedLinks);

  useEffect(() => {
    setItems(displayedLinks);
  }, [displayedLinks]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (!isCompactCardsMode) {
      return;
    }

    for (const link of displayedLinks.slice(0, 24)) {
      ensureLinkPreview(link.url);
    }
  }, [displayedLinks, ensureLinkPreview, isCompactCardsMode]);

  const itemIds = useMemo(() => items.map((link) => link.id), [items]);

  const activeDragLink = useMemo(
    () =>
      activeDragId
        ? items.find((link) => link.id === activeDragId) || null
        : null,
    [activeDragId, items]
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
    onCloseFloatingPreview();
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    setItems((prevItems) => {
      const oldIndex = prevItems.findIndex((item) => item.id === active.id);
      const newIndex = prevItems.findIndex((item) => item.id === over.id);

      if (oldIndex === -1 || newIndex === -1) {
        return prevItems;
      }

      return arrayMove(prevItems, oldIndex, newIndex);
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    let finalItems = items;
    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        finalItems = arrayMove(items, oldIndex, newIndex);
      }
    }

    onReorder(finalItems);
    setActiveDragId(null);
  };

  const handleDragCancel = () => {
    setActiveDragId(null);
    setItems(displayedLinks);
  };

  let compactGridColumnsClass = "md:grid-cols-3";
  if (compactColumns === 4) {
    compactGridColumnsClass = "md:grid-cols-4";
  } else if (compactColumns === 2) {
    compactGridColumnsClass = "md:grid-cols-2";
  }

  const activeOverlayComparableUrl = activeDragLink
    ? getComparableUrl(activeDragLink.url)
    : "";
  const activeOverlayPreviewEntry = activeOverlayComparableUrl
    ? previewCache[activeOverlayComparableUrl]
    : undefined;
  const activeOverlayDisplay = activeDragLink
    ? getQuickLinkDisplay(activeDragLink, activeOverlayPreviewEntry)
    : null;
  const activeOverlayPreviewImageUrl = activeOverlayDisplay
    ? activeOverlayDisplay.imageUrl
    : "";
  const isActiveOverlayPreviewImageFailed = Boolean(
    activeOverlayPreviewImageUrl &&
      failedPreviewImageUrls[activeOverlayPreviewImageUrl]
  );

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragCancel={handleDragCancel}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragStart={handleDragStart}
      sensors={sensors}
    >
      {isListMode ? (
        <ScrollArea className="min-h-0 flex-1" maskHeight={40}>
          <SortableContext
            items={itemIds}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex min-h-full flex-col space-y-0.5 pr-0">
              <AnimatePresence mode="popLayout">
                {items.map((link) => (
                  <SortableListItem
                    key={link.id}
                    link={link}
                    onDeleteLink={onDeleteLink}
                  />
                ))}
                {items.length === 0 ? (
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
          </SortableContext>
        </ScrollArea>
      ) : !isCompactCardsMode ? (
        <div className="min-h-0 flex-1">
          <SortableContext items={itemIds} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-11 md:grid-cols-15 lg:grid-cols-7">
              <AnimatePresence mode="popLayout">
                {items.map((link) => (
                  <SortableIconItem
                    key={link.id}
                    link={link}
                    onCloseFloatingPreview={onCloseFloatingPreview}
                    onDeleteLink={onDeleteLink}
                    onMoveFloatingPreview={onMoveFloatingPreview}
                    onOpenFloatingPreview={onOpenFloatingPreview}
                    onScheduleFloatingPreviewClose={
                      onScheduleFloatingPreviewClose
                    }
                  />
                ))}
                {items.length === 0 ? (
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
          </SortableContext>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 md:hidden">
            <ScrollArea className="min-h-0 flex-1" maskHeight={40}>
              <SortableContext
                items={itemIds}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex min-h-full flex-col space-y-0.5 pr-0">
                  <AnimatePresence mode="popLayout">
                    {items.map((link) => (
                      <SortableListItem
                        key={link.id}
                        link={link}
                        onDeleteLink={onDeleteLink}
                      />
                    ))}
                    {items.length === 0 ? (
                      <motion.div
                        animate={{ opacity: 1 }}
                        className="flex flex-1 items-center justify-center py-8"
                        exit={{ opacity: 0 }}
                        initial={{ opacity: 0 }}
                        key="empty-message-list-mobile"
                        transition={{ duration: 0.3 }}
                      >
                        <p className="text-muted-foreground text-xs lowercase">
                          no links saved
                        </p>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              </SortableContext>
            </ScrollArea>
          </div>

          <div className="hidden min-h-0 flex-1 md:block">
            <ScrollArea className="h-full" maskHeight={40}>
              <SortableContext items={itemIds} strategy={rectSortingStrategy}>
                <div className={`grid gap-2 pr-0.5 ${compactGridColumnsClass}`}>
                  <AnimatePresence mode="popLayout">
                    {items.map((link) => (
                      <SortableCompactCard
                        failedPreviewImageUrls={failedPreviewImageUrls}
                        getComparableUrl={getComparableUrl}
                        key={link.id}
                        link={link}
                        loadingPreviewUrls={loadingPreviewUrls}
                        onCloseFloatingPreview={onCloseFloatingPreview}
                        onDeleteLink={onDeleteLink}
                        previewCache={previewCache}
                      />
                    ))}
                    {items.length === 0 ? (
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
              </SortableContext>
            </ScrollArea>
          </div>
        </div>
      )}

      <DragOverlay dropAnimation={dropAnimationConfig}>
        {activeDragLink ? (
          isCompactCardsMode ? (
            <CompactCardContent
              isOverlay
              isPreviewImageMarkedFailed={isActiveOverlayPreviewImageFailed}
              link={activeDragLink}
              loadingPreviewUrls={loadingPreviewUrls}
              onCloseFloatingPreview={onCloseFloatingPreview}
              previewEntry={activeOverlayPreviewEntry}
              previewImageUrl={activeOverlayPreviewImageUrl}
            />
          ) : isListMode ? (
            <div className="flex cursor-grabbing select-none items-center gap-2 rounded-md border border-border/50 bg-card/90 px-1.5 py-1 shadow-xl ring-2 ring-primary/40">
              {activeDragLink.favicon ? (
                <img
                  alt={activeDragLink.title}
                  className="size-4 h-full shrink-0"
                  draggable={false}
                  height={16}
                  src={activeDragLink.favicon}
                  width={16}
                />
              ) : (
                <IconExternalLink className="size-4 shrink-0 text-muted-foreground" />
              )}
              <span className="flex-1 truncate text-xs">
                {activeDragLink.title}
              </span>
            </div>
          ) : (
            <span className="flex size-8 items-center justify-center rounded-md border border-border/50 bg-card shadow-2xl scale-110 ring-2 ring-primary/40">
              {activeDragLink.favicon ? (
                <img
                  alt={activeDragLink.title}
                  className="size-4"
                  draggable={false}
                  height={16}
                  src={activeDragLink.favicon}
                  width={16}
                />
              ) : (
                <IconExternalLink className="size-4 text-muted-foreground" />
              )}
            </span>
          )
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
