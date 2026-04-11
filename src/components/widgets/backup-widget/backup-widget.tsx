import {
  IconDeviceFloppy,
  IconFolderOpen,
  IconUpload,
} from "@tabler/icons-react";
import { useCallback, useEffect, useRef, useState } from "react";
import spinners, { type BrailleSpinnerName } from "unicode-animations";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocalStorage } from "@/hooks/use-local-storage";
import {
  type AutoBackupSnapshot,
  type BackupLocationStatus,
  type BackupStatus,
  backupNow,
  ensureDailyAutoBackup,
  loadBackupFromFilePicker,
  parseBackupFile,
  readBackupLocationStatus,
  readBackupTimelineState,
  restoreBackup,
  restoreBackupHistoryEntry,
  restoreMostRecentRestoreCheckpoint,
  selectBackupLocation,
} from "@/lib/backup-utils";

const DEFAULT_BACKUP_STATUS: BackupStatus = {
  state: "idle",
  updatedAt: "",
  source: "auto",
};

const DEFAULT_BACKUP_LOCATION_STATUS: BackupLocationStatus = {
  configured: false,
  permissionState: "unconfigured",
  needsReauthorization: false,
  consecutiveFailures: 0,
};

type BackupTabKey = "options" | "history";

function formatBackupAge(updatedAt: string): string {
  if (!updatedAt) {
    return "never";
  }

  const parsedTime = Date.parse(updatedAt);
  if (Number.isNaN(parsedTime)) {
    return "unknown";
  }

  const diffMs = Date.now() - parsedTime;
  if (diffMs < 60_000) {
    return "now";
  }

  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 60) {
    return `${diffMinutes}m`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
}

function getFooterBackupLabel(
  status: BackupStatus,
  isBackupLocationReady: boolean
): string {
  if (!isBackupLocationReady) {
    return "BLOCKED";
  }

  if (status.state === "saving") {
    return "SYNCING";
  }

  if (status.state === "error") {
    return "BLOCKED";
  }

  if (
    status.state === "saved" ||
    status.state === "auto-saved" ||
    status.state === "restored"
  ) {
    return "SUCCESS";
  }

  return "STANDBY";
}

function formatHistoryAge(updatedAt: string): string {
  const backupAge = formatBackupAge(updatedAt);

  if (backupAge === "now") {
    return "just now";
  }

  if (backupAge === "unknown") {
    return "recent";
  }

  if (backupAge === "never") {
    return "unknown";
  }

  return `${backupAge} ago`;
}

function getFooterLoaderName(
  state: BackupStatus["state"],
  isBackupLocationReady: boolean
): BrailleSpinnerName {
  if (!isBackupLocationReady || state === "error") {
    return "columns";
  }

  if (state === "saving") {
    return "checkerboard";
  }

  return "pulse";
}

function getBackupStatusTone(
  state: BackupStatus["state"],
  isBackupLocationReady: boolean
): string {
  if (!isBackupLocationReady || state === "error") {
    return "text-destructive";
  }

  if (state === "saving") {
    return "text-amber-500";
  }

  if (state === "saved" || state === "auto-saved" || state === "restored") {
    return "text-emerald-500";
  }

  return "text-muted-foreground";
}

function resolveFooterBackupState(
  status: BackupStatus,
  isBackupLocationReady: boolean
): BackupStatus["state"] {
  if (!isBackupLocationReady) {
    return "error";
  }

  return status.state;
}

function useUnicodeSpinnerFrame(name: BrailleSpinnerName, speed = 1): string {
  const spinner = spinners[name];
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    setFrameIndex(0);

    const frameInterval = Math.max(16, Math.round(spinner.interval / speed));
    const timer = window.setInterval(() => {
      setFrameIndex((previousFrame) => {
        return (previousFrame + 1) % spinner.frames.length;
      });
    }, frameInterval);

    return () => {
      window.clearInterval(timer);
    };
  }, [speed, spinner]);

  return spinner.frames[frameIndex] ?? spinner.frames[0] ?? "";
}

function useVisibleBackupStatus(
  status: BackupStatus,
  minimumSavingMs = 700
): BackupStatus {
  const [visibleStatus, setVisibleStatus] = useState(status);
  const savingStartedAtRef = useRef<number | null>(null);
  const pendingTransitionTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (pendingTransitionTimerRef.current !== null) {
      window.clearTimeout(pendingTransitionTimerRef.current);
      pendingTransitionTimerRef.current = null;
    }

    setVisibleStatus((previousStatus) => {
      if (status.state === "saving") {
        savingStartedAtRef.current = Date.now();
        return status;
      }

      if (
        previousStatus.state === "saving" &&
        savingStartedAtRef.current !== null
      ) {
        const elapsedMs = Date.now() - savingStartedAtRef.current;

        if (elapsedMs < minimumSavingMs) {
          const remainingMs = minimumSavingMs - elapsedMs;
          pendingTransitionTimerRef.current = window.setTimeout(() => {
            setVisibleStatus(status);
            pendingTransitionTimerRef.current = null;
          }, remainingMs);
          return previousStatus;
        }
      }

      return status;
    });

    return () => {
      if (pendingTransitionTimerRef.current !== null) {
        window.clearTimeout(pendingTransitionTimerRef.current);
        pendingTransitionTimerRef.current = null;
      }
    };
  }, [minimumSavingMs, status]);

  return visibleStatus;
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
  const [autoBackups, setAutoBackups] = useState<AutoBackupSnapshot[]>([]);
  const [latestSnapshot, setLatestSnapshot] =
    useState<AutoBackupSnapshot | null>(null);
  const [hasChangesSinceLatestSnapshot, setHasChangesSinceLatestSnapshot] =
    useState(false);
  const [canUndoLastRestore, setCanUndoLastRestore] = useState(false);
  const [isRestoringAutoBackupId, setIsRestoringAutoBackupId] = useState<
    string | null
  >(null);
  const [isUndoingLastRestore, setIsUndoingLastRestore] = useState(false);
  const [isSelectingBackupLocation, setIsSelectingBackupLocation] =
    useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const restoreFileInputRef = useRef<HTMLInputElement | null>(null);

  const visibleBackupStatus = useVisibleBackupStatus(backupStatus, 700);

  const refreshBackupSurface = useCallback(() => {
    Promise.all([readBackupTimelineState(12), readBackupLocationStatus()])
      .then(([timelineState, locationStatus]) => {
        const visibleSnapshots = timelineState.snapshots
          .filter((snapshot) => snapshot.reason !== "restore-checkpoint")
          .slice(0, 6);

        setAutoBackups(visibleSnapshots);
        setLatestSnapshot(timelineState.latestSnapshot ?? null);
        setHasChangesSinceLatestSnapshot(
          timelineState.hasChangesSinceLatestSnapshot
        );
        setCanUndoLastRestore(timelineState.canUndoLastRestore);
        setBackupLocationStatus(locationStatus);

        if (!locationStatus.configured || locationStatus.needsReauthorization) {
          setActiveBackupTab("options");
        }
      })
      .catch(() => {
        setAutoBackups([]);
        setLatestSnapshot(null);
        setHasChangesSinceLatestSnapshot(false);
        setCanUndoLastRestore(false);
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

  const handleRestoreSnapshot = async (snapshotId: string) => {
    setIsRestoringAutoBackupId(snapshotId);

    const restored = await restoreBackupHistoryEntry(snapshotId);
    setIsRestoringAutoBackupId(null);

    if (restored) {
      window.location.reload();
    }
  };

  const handleRestoreLatestSnapshot = async () => {
    if (!latestSnapshot) {
      return;
    }

    await handleRestoreSnapshot(latestSnapshot.id);
  };

  const handleUndoLastRestore = async () => {
    setIsUndoingLastRestore(true);

    const restored = await restoreMostRecentRestoreCheckpoint();
    setIsUndoingLastRestore(false);

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
  const previousSnapshots = autoBackups.filter((snapshot) => {
    return snapshot.id !== latestSnapshot?.id;
  });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          className="flex h-6 w-auto min-w-0 items-center justify-start gap-1 px-1"
          size="sm"
          type="button"
          variant="ghost"
        >
          <span
            aria-hidden="true"
            className={`inline-flex w-8 shrink-0 items-center justify-start text-center font-mono text-[14px] tabular-nums leading-none ${backupStatusTone}`}
          >
            {backupStatusGlyph}
          </span>
          <span className="min-w-[7ch] text-left font-mono font-semibold text-[11px]">
            {backupDisplayText}
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[24rem]" side="top">
        <PopoverHeader>
          <PopoverTitle>save & restore</PopoverTitle>
          <PopoverDescription>
            choose a folder & recover saved versions anytime
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
              saved versions
            </TabsTrigger>
          </TabsList>

          <TabsContent className="space-y-2" value="options">
            <div className="rounded-md border border-border/60 bg-muted/30 p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium text-[11px] text-foreground">
                  {backupLocationStatus.fileName ?? "no folder chosen"}
                </span>
                <span
                  className={`text-[10px] ${
                    isBackupLocationReady
                      ? "text-emerald-500"
                      : "text-destructive"
                  }`}
                >
                  {isBackupLocationReady ? "ready" : "not ready"}
                </span>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                last saved: {lastSuccessfulWriteAge}
              </p>
              {backupLocationStatus.lastWriteErrorMessage && (
                <p className="mt-1 truncate text-[10px] text-destructive">
                  {backupLocationStatus.lastWriteErrorMessage}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Button
                className="w-full"
                disabled={isSelectingBackupLocation}
                onClick={() => {
                  handleSelectBackupLocation().catch(() => null);
                }}
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
                  onClick={() => {
                    handleBackupNow().catch(() => null);
                  }}
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

          <TabsContent className="space-y-2" value="history">
            <div className="rounded-md border border-border/60 bg-muted/30 p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-[11px] text-foreground">
                  your data
                </span>
                <Button
                  className="h-5 px-2 text-[10px]"
                  disabled={
                    !(
                      isBackupLocationReady &&
                      latestSnapshot &&
                      hasChangesSinceLatestSnapshot
                    ) || isRestoringAutoBackupId !== null
                  }
                  onClick={() => {
                    handleRestoreLatestSnapshot().catch(() => null);
                  }}
                  size="xs"
                  type="button"
                  variant="outline"
                >
                  revert latest
                </Button>
              </div>

              <p className="mt-1 text-[10px] text-muted-foreground">
                {latestSnapshot
                  ? `latest ${formatHistoryAge(latestSnapshot.createdAt)}`
                  : "no saved version yet"}
              </p>

              <p
                className={`mt-1 text-[10px] ${
                  hasChangesSinceLatestSnapshot
                    ? "text-amber-500"
                    : "text-emerald-500"
                }`}
              >
                {hasChangesSinceLatestSnapshot
                  ? "changes not saved yet"
                  : "all changes saved"}
              </p>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-[11px] text-foreground">
                saved versions
              </span>
              <Button
                className="h-5 px-2 text-[10px]"
                disabled={!canUndoLastRestore || isUndoingLastRestore}
                onClick={() => {
                  handleUndoLastRestore().catch(() => null);
                }}
                size="xs"
                type="button"
                variant="outline"
              >
                {isUndoingLastRestore ? "undoing..." : "undo"}
              </Button>
            </div>

            <div className="space-y-1.5">
              {previousSnapshots.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  no saved versions yet
                </p>
              ) : (
                previousSnapshots.map((snapshot) => (
                  <div
                    className="flex items-center justify-between gap-2"
                    key={snapshot.id}
                  >
                    <span className="truncate text-[11px] text-muted-foreground">
                      {formatHistoryAge(snapshot.createdAt)}
                    </span>
                    <Button
                      disabled={isRestoringAutoBackupId === snapshot.id}
                      onClick={() => {
                        handleRestoreSnapshot(snapshot.id).catch(() => null);
                      }}
                      size="xs"
                      type="button"
                      variant="outline"
                    >
                      {isRestoringAutoBackupId === snapshot.id
                        ? "restoring..."
                        : "restore"}
                    </Button>
                  </div>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
