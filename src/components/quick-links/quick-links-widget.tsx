import { IconArrowDown, IconArrowUp, IconHistory } from "@tabler/icons-react";
import { ImportBookmarksContent } from "@/components/quick-links/import-bookmarks-content";
import type {
  QuickLink,
  QuickLinksProps,
  QuickLinksSortMode,
} from "@/components/quick-links/model/quick-links.types";
import { QuickLinksAddFlow } from "@/components/quick-links/quick-links-add-flow";
import { QuickLinksList } from "@/components/quick-links/quick-links-list";
import { QuickLinksPreviewCard } from "@/components/quick-links/quick-links-preview-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useQuickLinksAddFlow } from "@/hooks/use-quick-links-add-flow";
import { useQuickLinksImportController } from "@/hooks/use-quick-links-import-controller";
import { useQuickLinksPreviewController } from "@/hooks/use-quick-links-preview-controller";

const getQuickLinksCardClasses = (expanded: boolean, fullSize: boolean) => {
  if (fullSize) {
    return "flex min-h-0 w-full flex-1 flex-col gap-0 border-border/50 py-2";
  }

  if (expanded) {
    return "flex min-h-0 w-full flex-1 flex-col gap-0 border-border/50 py-2 lg:w-71";
  }

  return "flex h-fit max-h-40 w-full flex-col gap-0 border-border/50 py-2 lg:max-h-none lg:w-71";
};

export function QuickLinks({
  expanded = false,
  fullSize = false,
}: QuickLinksProps) {
  const [links, setLinks] = useLocalStorage<QuickLink[]>(
    "better-home-quick-links",
    [
      {
        id: "default-github",
        title: "github",
        url: "https://github.com/SatyamVyas04",
        favicon: "https://www.google.com/s2/favicons?domain=github.com&sz=64",
      },
    ]
  );

  const previewController = useQuickLinksPreviewController({
    links,
    setLinks,
  });
  const importController = useQuickLinksImportController({
    ensureLinkPreview: previewController.ensureLinkPreview,
    getComparableUrl: previewController.getComparableUrl,
    getResolvedFavicon: previewController.getResolvedFavicon,
    setLinks,
  });
  const addFlowController = useQuickLinksAddFlow({
    clearStagedTitlePreview: previewController.clearStagedTitlePreview,
    ensureLinkPreview: previewController.ensureLinkPreview,
    getResolvedFavicon: previewController.getResolvedFavicon,
    setLinks,
    stageResolvedTitlePreview: previewController.stageResolvedTitlePreview,
  });

  return (
    <>
      <Dialog
        onOpenChange={importController.setIsImportDialogOpen}
        open={importController.isImportDialogOpen}
      >
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <Card className={getQuickLinksCardClasses(expanded, fullSize)}>
              <CardHeader className="px-3 pb-1">
                <CardTitle className="font-medium text-xs lowercase">
                  quick links
                </CardTitle>
              </CardHeader>
              <CardContent
                className={`flex flex-col gap-1.5 px-3 pt-1 ${expanded || fullSize ? "min-h-0 flex-1" : ""}`}
              >
                <QuickLinksList
                  displayedLinks={previewController.displayedLinks}
                  expanded={expanded}
                  onCloseFloatingPreview={
                    previewController.closeFloatingPreview
                  }
                  onDeleteLink={previewController.deleteLink}
                  onMoveFloatingPreview={previewController.moveFloatingPreview}
                  onOpenFloatingPreview={previewController.openFloatingPreview}
                  onScheduleFloatingPreviewClose={
                    previewController.scheduleFloatingPreviewClose
                  }
                />

                <QuickLinksAddFlow controller={addFlowController} />
              </CardContent>
            </Card>
          </ContextMenuTrigger>

          <ContextMenuContent className="w-56 bg-card/50 backdrop-blur-lg">
            <ContextMenuRadioGroup
              onValueChange={(value) =>
                previewController.setSortMode(value as QuickLinksSortMode)
              }
              value={previewController.sortMode}
            >
              <ContextMenuItem className="text-xs lowercase" disabled>
                sorting
              </ContextMenuItem>
              <ContextMenuRadioItem
                className="text-xs lowercase"
                value="alphabetical-asc"
              >
                <IconArrowDown className="size-3.5" />
                alphabetical (a-z)
              </ContextMenuRadioItem>
              <ContextMenuRadioItem
                className="text-xs lowercase"
                value="alphabetical-desc"
              >
                <IconArrowUp className="size-3.5" />
                alphabetical (z-a)
              </ContextMenuRadioItem>
              <ContextMenuRadioItem
                className="text-xs lowercase"
                value="recent"
              >
                <IconHistory className="size-3.5" />
                default (recency)
              </ContextMenuRadioItem>
            </ContextMenuRadioGroup>

            <ContextMenuSeparator />
            <ContextMenuItem className="text-xs lowercase" disabled>
              actions
            </ContextMenuItem>
            <ContextMenuItem
              className="text-xs lowercase"
              onSelect={importController.openImportDialog}
            >
              import bookmarks
            </ContextMenuItem>
            <ContextMenuItem
              className="text-xs lowercase"
              disabled={!previewController.hasDuplicates}
              onSelect={previewController.deleteDuplicateLinks}
            >
              delete duplicates
            </ContextMenuItem>
            <ContextMenuItem
              className="text-xs lowercase"
              disabled={!previewController.hasPreviewCacheEntries}
              onSelect={previewController.clearQuickLinksPreviewCache}
            >
              clear preview cache
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>

        <DialogContent>
          <DialogHeader>
            <DialogTitle>import bookmarks</DialogTitle>
            <DialogDescription>
              choose bookmarks to add into quick links
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between gap-2">
            <p className="text-muted-foreground text-xs lowercase">
              {importController.bookmarkOptions.length} available
            </p>
            <div className="flex gap-1">
              <Button
                disabled={
                  importController.bookmarkOptions.length === 0 ||
                  importController.isImportLoading
                }
                onClick={importController.selectAllBookmarks}
                size="sm"
                type="button"
                variant="ghost"
              >
                select all
              </Button>
              <Button
                disabled={
                  importController.selectedBookmarkIds.length === 0 ||
                  importController.isImportLoading
                }
                onClick={importController.clearBookmarkSelection}
                size="sm"
                type="button"
                variant="ghost"
              >
                clear
              </Button>
            </div>
          </div>

          <ImportBookmarksContent
            bookmarkOptions={importController.bookmarkOptions}
            importError={importController.importError}
            isImportLoading={importController.isImportLoading}
            onToggleBookmarkSelection={importController.toggleBookmarkSelection}
            selectedBookmarkIds={importController.selectedBookmarkIds}
          />

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                cancel
              </Button>
            </DialogClose>
            <Button
              disabled={
                importController.selectedBookmarkIds.length === 0 ||
                importController.isImportLoading
              }
              onClick={importController.importSelectedBookmarks}
              type="button"
            >
              import selected
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <QuickLinksPreviewCard
        activePreviewDisplayTitle={previewController.activePreviewDisplayTitle}
        activePreviewImageUrl={previewController.activePreviewImageUrl}
        activePreviewLink={previewController.activePreviewLink}
        activePreviewMetadataDescriptionText={
          previewController.activePreviewMetadataDescriptionText
        }
        activePreviewMetadataTitleText={
          previewController.activePreviewMetadataTitleText
        }
        activePreviewPlatform={previewController.activePreviewPlatform}
        activePreviewUserTitleText={
          previewController.activePreviewUserTitleText
        }
        expanded={expanded}
        hasActivePreviewImage={previewController.hasActivePreviewImage}
        isActivePreviewImageMarkedFailed={
          previewController.isActivePreviewImageMarkedFailed
        }
        isActivePreviewLoading={previewController.isActivePreviewLoading}
        previewContentDirection={previewController.previewContentDirection}
        previewPosition={previewController.previewPosition}
      />
    </>
  );
}
