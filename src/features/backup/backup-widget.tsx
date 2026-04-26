import {
  IconDeviceFloppy,
  IconFolderOpen,
  IconInfoCircle,
  IconUpload,
} from "@tabler/icons-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useUnicodeSpinnerFrame } from "@/hooks/use-unicode-spinner-frame";
import {
  type BackupLocationStatus,
  type BackupStatus,
  backupNow,
  ensureDailyAutoBackup,
  loadBackupFromFilePicker,
  parseBackupFile,
  readBackupLocationStatus,
  restoreBackup,
  selectBackupLocation,
} from "@/lib/backup-utils";
import {
  readSessionCheckpointSummaries,
  readUndoSessionRestoreHint,
  restoreSessionCheckpoint,
  type SessionCheckpointSummary,
  type SessionRestoreUndoHint,
  undoLatestSessionRestore,
} from "@/lib/session-history";
import {
  BACKUP_VISIBLE_STATUS_MIN_SAVING_MS,
  type BackupTabKey,
  DEFAULT_BACKUP_LOCATION_STATUS,
  DEFAULT_BACKUP_STATUS,
} from "./backup-widget.constants";
import {
  formatHistoryAge,
  getBackupStatusTone,
  getFooterBackupLabel,
  getFooterLoaderName,
  resolveFooterBackupState,
} from "./backup-widget.utils";
import { useVisibleBackupStatus } from "./use-backup-widget-status";

const SESSION_AREA_LABELS: Record<string, string> = {
  "better-home-widget-settings": "widgets",
  "better-home-todos": "todos",
  "better-home-todo-groups": "todo groups",
  "better-home-todo-sort": "todo sort",
  "better-home-todo-group-by": "todo grouping",
  "better-home-todo-collapsed-sections": "collapsed groups",
  "better-home-todo-filters": "todo filters",
  "better-home-quick-links": "quick links",
  "better-home-quick-links-sort": "quick links sort",
  "mood-calendar-2026-data": "calendar",
  "mood-calendar-show-numbers": "calendar numbers",
  "vite-ui-theme": "theme",
};

const VISIBLE_SESSION_ARCHIVE_COUNT = 3;

function toSessionAreaLabels(changedKeys: string[]): string[] {
  const uniqueLabels = new Set<string>();

  for (const changedKey of changedKeys) {
    uniqueLabels.add(SESSION_AREA_LABELS[changedKey] ?? changedKey);
  }

  return [...uniqueLabels];
}

interface SessionArchiveItemProps {
  index: number;
  isRestoring: boolean;
  onRestore: (sessionCheckpointId: string) => void;
  sessionCheckpoint: SessionCheckpointSummary;
}

function SessionArchiveItem({
  index,
  isRestoring,
  onRestore,
  sessionCheckpoint,
}: SessionArchiveItemProps) {
  const areaLabels = toSessionAreaLabels(sessionCheckpoint.changedKeys);
  const visibleAreaLabels = areaLabels.slice(0, 3);
  const hiddenAreaCount = areaLabels.length - visibleAreaLabels.length;

  return (
    <div className="rounded-md border border-border/60 bg-card/60 px-2 py-2 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[11px] text-foreground">
            {index === 0 ? "last session" : `session ${index + 1}`}
          </p>
          <p className="truncate text-[10px] text-muted-foreground">
            {`${sessionCheckpoint.actionCount} change${sessionCheckpoint.actionCount === 1 ? "" : "s"} · ${formatHistoryAge(sessionCheckpoint.closedAt)}`}
          </p>
        </div>
        <Button
          disabled={isRestoring}
          onClick={() => {
            onRestore(sessionCheckpoint.id);
          }}
          size="xs"
          type="button"
          variant="outline"
        >
          {isRestoring ? "restoring..." : "restore"}
        </Button>
      </div>

      {areaLabels.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {visibleAreaLabels.map((areaLabel) => (
            <span
              className="rounded border border-border/60 bg-background/60 px-1.5 py-0.5 text-[9px] text-muted-foreground"
              key={`${sessionCheckpoint.id}-${areaLabel}`}
            >
              {areaLabel}
            </span>
          ))}
          {hiddenAreaCount > 0 ? (
            <span className="rounded border border-border/60 bg-background/60 px-1.5 py-0.5 text-[9px] text-muted-foreground">
              +{hiddenAreaCount}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

interface SetupTabContentProps {
  backupLocationStatus: BackupLocationStatus;
  handleBackupNow: () => void;
  handleRestoreFileClick: () => void;
  handleSelectBackupLocation: () => void;
  handleUploadBackup: (event: React.ChangeEvent<HTMLInputElement>) => void;
  isBackingUp: boolean;
  isBackupLocationReady: boolean;
  isSelectingBackupLocation: boolean;
  lastSuccessfulWriteAge: string;
  restoreFileInputRef: React.RefObject<HTMLInputElement | null>;
}

function SetupTabContent({
  backupLocationStatus,
  handleBackupNow,
  handleRestoreFileClick,
  handleSelectBackupLocation,
  handleUploadBackup,
  isBackingUp,
  isBackupLocationReady,
  isSelectingBackupLocation,
  lastSuccessfulWriteAge,
  restoreFileInputRef,
}: SetupTabContentProps) {
  return (
    <TabsContent className="space-y-2" value="options">
      <div className="rounded-md border border-border/60 bg-muted/30 p-2">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-medium text-[11px] text-foreground">
            {backupLocationStatus.fileName ?? "no folder chosen"}
          </span>
          <span
            className={`text-[10px] ${
              isBackupLocationReady ? "text-emerald-500" : "text-destructive"
            }`}
          >
            {isBackupLocationReady ? "ready" : "not ready"}
          </span>
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">
          last saved: {lastSuccessfulWriteAge}
        </p>
        {backupLocationStatus.lastWriteErrorMessage ? (
          <p className="mt-1 truncate text-[10px] text-destructive">
            {backupLocationStatus.lastWriteErrorMessage}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Button
          className="w-full"
          disabled={isSelectingBackupLocation}
          onClick={handleSelectBackupLocation}
          size="sm"
          type="button"
          variant="outline"
        >
          <IconFolderOpen className="size-3.5" />
          {isSelectingBackupLocation ? "choosing..." : "choose folder"}
        </Button>

        <div className="flex items-center gap-2">
          <Button
            className="flex-1"
            disabled={!isBackupLocationReady || isBackingUp}
            onClick={handleBackupNow}
            size="sm"
            type="button"
            variant="outline"
          >
            <IconDeviceFloppy className="size-3.5" />
            {isBackingUp ? "saving..." : "save now"}
          </Button>
          <Button
            className="flex-1"
            onClick={handleRestoreFileClick}
            size="sm"
            type="button"
            variant="outline"
          >
            <IconUpload className="size-3.5" />
            load file
          </Button>
        </div>

        <input
          accept=".json"
          className="hidden"
          onChange={handleUploadBackup}
          ref={restoreFileInputRef}
          type="file"
        />
      </div>
    </TabsContent>
  );
}

interface HistoryTabContentProps {
  handleRestoreSession: (sessionCheckpointId: string) => void;
  handleUndoSessionRestore: () => void;
  hasHiddenSessionCheckpoints: boolean;
  hiddenSessionCheckpoints: SessionCheckpointSummary[];
  isArchiveExpanded: boolean;
  isRestoringSessionId: string | null;
  isUndoingSessionRestore: boolean;
  latestSession: SessionCheckpointSummary | null;
  sessionCheckpoints: SessionCheckpointSummary[];
  setIsArchiveExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  undoSessionRestoreHint: SessionRestoreUndoHint | null;
  visibleSessionCheckpoints: SessionCheckpointSummary[];
}

function HistoryTabContent({
  handleRestoreSession,
  handleUndoSessionRestore,
  hasHiddenSessionCheckpoints,
  hiddenSessionCheckpoints,
  isArchiveExpanded,
  isRestoringSessionId,
  isUndoingSessionRestore,
  latestSession,
  sessionCheckpoints,
  setIsArchiveExpanded,
  undoSessionRestoreHint,
  visibleSessionCheckpoints,
}: HistoryTabContentProps) {
  return (
    <TabsContent className="space-y-2" value="history">
      <Card
        className="relative gap-2 border border-border/60 bg-muted/25 py-3 shadow-sm"
        size="sm"
      >
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(125deg,hsl(var(--primary)/0.09),transparent_58%)]" />
        <CardHeader className="relative px-3">
          <CardTitle className="font-medium text-[11px]">
            session restore
          </CardTitle>
          <CardDescription className="text-[10px]">
            sessions are saved only when this tab closes with net changes
          </CardDescription>
        </CardHeader>
        <CardContent className="relative px-3">
          {latestSession ? (
            <p className="text-[10px] text-emerald-500">
              latest session: {latestSession.actionCount} change
              {latestSession.actionCount === 1 ? "" : "s"} ·{" "}
              {formatHistoryAge(latestSession.closedAt)}
            </p>
          ) : (
            <p className="text-[10px] text-muted-foreground">
              no session saved yet because there are no net changes to restore
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-[11px] text-foreground">
          session archive
        </span>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label="Show undo session restore preview"
                className="h-5 w-5 p-0"
                disabled={undoSessionRestoreHint === null}
                size="xs"
                type="button"
                variant="outline"
              >
                <IconInfoCircle className="size-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent align="end" className="max-w-76" side="top">
              {undoSessionRestoreHint ? (
                <div className="space-y-1">
                  <p className="font-medium text-[10px] leading-snug">
                    {undoSessionRestoreHint.summary}
                  </p>
                  {undoSessionRestoreHint.details.map((detailLine) => (
                    <p
                      className="text-[10px] text-background/90 leading-snug"
                      key={detailLine}
                    >
                      {detailLine}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-[10px]">No undo preview available.</p>
              )}
            </TooltipContent>
          </Tooltip>

          <Button
            className="h-5 px-2 text-[10px]"
            disabled={
              !undoSessionRestoreHint?.canUndo || isUndoingSessionRestore
            }
            onClick={handleUndoSessionRestore}
            size="xs"
            type="button"
            variant="outline"
          >
            {isUndoingSessionRestore ? "undoing..." : "undo"}
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        {sessionCheckpoints.length === 0 ? (
          <div className="rounded-md border border-border/70 border-dashed bg-muted/20 px-2 py-2 text-[11px] text-muted-foreground">
            no restorable sessions
          </div>
        ) : (
          <>
            {visibleSessionCheckpoints.map((sessionCheckpoint, index) => (
              <SessionArchiveItem
                index={index}
                isRestoring={isRestoringSessionId === sessionCheckpoint.id}
                key={sessionCheckpoint.id}
                onRestore={handleRestoreSession}
                sessionCheckpoint={sessionCheckpoint}
              />
            ))}

            {hasHiddenSessionCheckpoints ? (
              <div className="rounded-md border border-border/60 bg-muted/20 p-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] text-muted-foreground">
                    showing latest {VISIBLE_SESSION_ARCHIVE_COUNT} of{" "}
                    {sessionCheckpoints.length} sessions
                  </p>
                  <Button
                    className="h-6 px-2 text-[10px]"
                    onClick={() => {
                      setIsArchiveExpanded((previousValue) => {
                        return !previousValue;
                      });
                    }}
                    size="xs"
                    type="button"
                    variant="outline"
                  >
                    {isArchiveExpanded
                      ? "show less"
                      : `show more (${hiddenSessionCheckpoints.length})`}
                  </Button>
                </div>

                {isArchiveExpanded ? (
                  <ScrollArea className="mt-2 h-44 pr-2">
                    <div className="space-y-1.5">
                      {hiddenSessionCheckpoints.map(
                        (sessionCheckpoint, hiddenIndex) => (
                          <SessionArchiveItem
                            index={hiddenIndex + VISIBLE_SESSION_ARCHIVE_COUNT}
                            isRestoring={
                              isRestoringSessionId === sessionCheckpoint.id
                            }
                            key={sessionCheckpoint.id}
                            onRestore={handleRestoreSession}
                            sessionCheckpoint={sessionCheckpoint}
                          />
                        )
                      )}
                    </div>
                  </ScrollArea>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </div>
    </TabsContent>
  );
}

export function BackupWidget() {
  const [backupStatus] = useLocalStorage<BackupStatus>(
    "better-home-backup-status",
    DEFAULT_BACKUP_STATUS
  );
  const [backupLocationStatus, setBackupLocationStatus] =
    useState<BackupLocationStatus>(DEFAULT_BACKUP_LOCATION_STATUS);
  const [activeBackupTab, setActiveBackupTab] =
    useState<BackupTabKey>("options");
  const [sessionCheckpoints, setSessionCheckpoints] = useState<
    SessionCheckpointSummary[]
  >([]);
  const [isRestoringSessionId, setIsRestoringSessionId] = useState<
    string | null
  >(null);
  const [undoSessionRestoreHint, setUndoSessionRestoreHint] =
    useState<SessionRestoreUndoHint | null>(null);
  const [isUndoingSessionRestore, setIsUndoingSessionRestore] = useState(false);
  const [isSelectingBackupLocation, setIsSelectingBackupLocation] =
    useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isArchiveExpanded, setIsArchiveExpanded] = useState(false);
  const restoreFileInputRef = useRef<HTMLInputElement | null>(null);

  const visibleBackupStatus = useVisibleBackupStatus(
    backupStatus,
    BACKUP_VISIBLE_STATUS_MIN_SAVING_MS
  );

  const refreshBackupSurface = useCallback(() => {
    Promise.all([
      readBackupLocationStatus(),
      readSessionCheckpointSummaries(),
      readUndoSessionRestoreHint(),
    ])
      .then(([locationStatus, checkpoints, undoHint]) => {
        setSessionCheckpoints(checkpoints);
        setUndoSessionRestoreHint(undoHint);
        setBackupLocationStatus(locationStatus);

        if (locationStatus.needsReauthorization) {
          setActiveBackupTab("options");
        }
      })
      .catch(() => {
        setSessionCheckpoints([]);
        setUndoSessionRestoreHint(null);
        setBackupLocationStatus(DEFAULT_BACKUP_LOCATION_STATUS);
      });
  }, []);

  useEffect(() => {
    ensureDailyAutoBackup()
      .catch(() => null)
      .finally(() => {
        refreshBackupSurface();
      });
  }, [refreshBackupSurface]);

  useEffect(() => {
    if (backupStatus.state !== "saving") {
      refreshBackupSurface();
    }
  }, [backupStatus.state, refreshBackupSurface]);

  useEffect(() => {
    const handleWindowFocus = () => {
      refreshBackupSurface();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshBackupSurface();
      }
    };

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshBackupSurface]);

  const handleSelectBackupLocation = async () => {
    setIsSelectingBackupLocation(true);

    const selected = await selectBackupLocation();
    if (selected) {
      setActiveBackupTab("history");
    }

    await refreshBackupSurface();
    setIsSelectingBackupLocation(false);
  };

  const handleBackupNow = async () => {
    setIsBackingUp(true);
    await backupNow();
    await refreshBackupSurface();
    setIsBackingUp(false);
  };

  const handleRestoreFileClick = () => {
    if (!("showOpenFilePicker" in window)) {
      restoreFileInputRef.current?.click();
      return;
    }

    loadBackupFromFilePicker()
      .then((backupPayload) => {
        if (!backupPayload) {
          return;
        }

        return restoreBackup(backupPayload).then(() => {
          window.location.reload();
        });
      })
      .catch(() => null);
  };

  const handleUploadBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    parseBackupFile(file, (backupPayload) => {
      restoreBackup(backupPayload)
        .then(() => {
          window.location.reload();
        })
        .catch(() => null);
    });

    event.target.value = "";
  };

  const handleRestoreSession = async (sessionCheckpointId: string) => {
    setIsRestoringSessionId(sessionCheckpointId);
    const restored = await restoreSessionCheckpoint(sessionCheckpointId);
    setIsRestoringSessionId(null);

    if (restored) {
      window.location.reload();
    }
  };

  const handleUndoSessionRestore = async () => {
    setIsUndoingSessionRestore(true);
    const restored = await undoLatestSessionRestore();
    setIsUndoingSessionRestore(false);

    if (restored) {
      window.location.reload();
    }
  };

  const isBackupLocationReady =
    backupLocationStatus.configured &&
    !backupLocationStatus.needsReauthorization;
  const resolvedBackupState = resolveFooterBackupState(
    visibleBackupStatus,
    isBackupLocationReady
  );
  const footerLoaderName = getFooterLoaderName(
    resolvedBackupState,
    isBackupLocationReady
  );
  const backupStatusGlyph = useUnicodeSpinnerFrame(footerLoaderName);
  const backupStatusTone = getBackupStatusTone(
    resolvedBackupState,
    isBackupLocationReady
  );
  const backupDisplayText = getFooterBackupLabel(
    { ...visibleBackupStatus, state: resolvedBackupState },
    isBackupLocationReady
  );
  const lastSuccessfulWriteAge = backupLocationStatus.lastSuccessfulWriteAt
    ? formatHistoryAge(backupLocationStatus.lastSuccessfulWriteAt)
    : "never";
  const latestSession = sessionCheckpoints[0] ?? null;
  const visibleSessionCheckpoints = sessionCheckpoints.slice(
    0,
    VISIBLE_SESSION_ARCHIVE_COUNT
  );
  const hiddenSessionCheckpoints = sessionCheckpoints.slice(
    VISIBLE_SESSION_ARCHIVE_COUNT
  );
  const hasHiddenSessionCheckpoints = hiddenSessionCheckpoints.length > 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          className="flex h-auto w-auto min-w-0 items-center justify-start gap-1 border border-border px-1 py-0.5"
          size="sm"
          type="button"
          variant="ghost"
        >
          <span
            aria-hidden="true"
            className={`inline-flex w-8 shrink-0 items-center justify-start py-1 text-center font-mono text-[14px] tabular-nums leading-none ${backupStatusTone}`}
          >
            {backupStatusGlyph}
          </span>
          <span className="min-w-[7ch] py-0.5 text-left font-mono font-semibold text-[11px]">
            {backupDisplayText}
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[24rem]" side="top">
        <PopoverHeader>
          <PopoverTitle>save & restore</PopoverTitle>
          <PopoverDescription>
            choose a folder & recover previous sessions.
          </PopoverDescription>
        </PopoverHeader>

        <Tabs
          onValueChange={(nextValue) => {
            setActiveBackupTab(nextValue as BackupTabKey);
          }}
          value={activeBackupTab}
        >
          <TabsList className="flex w-full items-center">
            <TabsTrigger className="w-full" value="options">
              setup
            </TabsTrigger>
            <TabsTrigger className="w-full" value="history">
              previous sessions
            </TabsTrigger>
          </TabsList>

          <SetupTabContent
            backupLocationStatus={backupLocationStatus}
            handleBackupNow={() => {
              handleBackupNow().catch(() => null);
            }}
            handleRestoreFileClick={handleRestoreFileClick}
            handleSelectBackupLocation={() => {
              handleSelectBackupLocation().catch(() => null);
            }}
            handleUploadBackup={handleUploadBackup}
            isBackingUp={isBackingUp}
            isBackupLocationReady={isBackupLocationReady}
            isSelectingBackupLocation={isSelectingBackupLocation}
            lastSuccessfulWriteAge={lastSuccessfulWriteAge}
            restoreFileInputRef={restoreFileInputRef}
          />

          <HistoryTabContent
            handleRestoreSession={(sessionCheckpointId) => {
              handleRestoreSession(sessionCheckpointId).catch(() => null);
            }}
            handleUndoSessionRestore={() => {
              handleUndoSessionRestore().catch(() => null);
            }}
            hasHiddenSessionCheckpoints={hasHiddenSessionCheckpoints}
            hiddenSessionCheckpoints={hiddenSessionCheckpoints}
            isArchiveExpanded={isArchiveExpanded}
            isRestoringSessionId={isRestoringSessionId}
            isUndoingSessionRestore={isUndoingSessionRestore}
            latestSession={latestSession}
            sessionCheckpoints={sessionCheckpoints}
            setIsArchiveExpanded={setIsArchiveExpanded}
            undoSessionRestoreHint={undoSessionRestoreHint}
            visibleSessionCheckpoints={visibleSessionCheckpoints}
          />
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
