import {
  readAppStorageRaw,
  removeAppStorageKeys,
  writeAppStorageRaw,
} from "@/lib/extension-storage";
import {
  SESSION_ACTION_JOURNAL_KEY,
  SESSION_CHECKPOINTS_KEY,
  SESSION_RESTORE_UNDO_KEY,
  USER_INTENT_STORAGE_KEYS,
} from "@/lib/storage-keys";

const ACTION_HISTORY_LIMIT = 50;
const SESSION_CHECKPOINT_LIMIT = 7;

type UserIntentStorageKey = (typeof USER_INTENT_STORAGE_KEYS)[number];
type UserIntentSnapshot = Partial<Record<UserIntentStorageKey, unknown>>;

interface SessionActionEntry {
  id: string;
  label: string;
  createdAt: string;
  before: UserIntentSnapshot;
  after: UserIntentSnapshot;
}

interface SessionActionJournal {
  sessionId: string;
  startedAt: string;
  updatedAt: string;
  cursor: number;
  actions: SessionActionEntry[];
}

interface SessionState {
  id: string;
  startedAt: string;
  baseline: UserIntentSnapshot;
  changedKeys: Set<UserIntentStorageKey>;
  actionCount: number;
  lastActionAt?: string;
  finalized: boolean;
}

interface ActiveActionContext {
  id: string;
  label: string;
  createdAt: string;
  before: UserIntentSnapshot;
  after: UserIntentSnapshot;
  touchedKeys: Set<UserIntentStorageKey>;
}

export interface SessionCheckpoint {
  id: string;
  sessionId: string;
  openedAt: string;
  closedAt: string;
  actionCount: number;
  changedKeys: UserIntentStorageKey[];
  before: UserIntentSnapshot;
  after: UserIntentSnapshot;
}

export interface SessionCheckpointSummary {
  id: string;
  closedAt: string;
  openedAt: string;
  actionCount: number;
  changedKeys: UserIntentStorageKey[];
}

interface SessionRestoreUndoState {
  checkpointClosedAt: string;
  checkpointId: string;
  restoredAt: string;
  snapshot: UserIntentSnapshot;
}

export interface SessionRestoreUndoHint {
  canUndo: boolean;
  details: string[];
  summary: string;
}

let trackingEnabled = false;
let suppressMutationCapture = false;
let activeSession: SessionState | null = null;
let activeAction: ActiveActionContext | null = null;
let actionJournal: SessionActionJournal | null = null;

const STORAGE_AREA_LABELS: Partial<Record<UserIntentStorageKey, string>> = {
  "better-home-widget-settings": "widgets",
  "better-home-todos": "todos",
  "better-home-todo-groups": "todo groups",
  "better-home-todo-sort": "todo sort",
  "better-home-todo-group-by": "todo grouping",
  "better-home-todo-collapsed-sections": "collapsed todo groups",
  "better-home-todo-filters": "todo filters",
  "better-home-quick-links": "quick links",
  "better-home-quick-links-sort": "quick links sort",
  "mood-calendar-2026-data": "mood calendar",
  "mood-calendar-show-numbers": "calendar numbers",
  "mood-calendar-first-day-of-week": "calendar first day",
  "vite-ui-theme": "theme",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function createUniqueId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}`;
}

function cloneValue<T>(value: T): T {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return value;
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalize(entry));
  }

  if (isRecord(value)) {
    const sortedEntries = Object.entries(value).sort(
      ([firstKey], [secondKey]) => {
        return firstKey.localeCompare(secondKey);
      }
    );

    return sortedEntries.reduce<Record<string, unknown>>(
      (result, [key, nextValue]) => {
        result[key] = canonicalize(nextValue);
        return result;
      },
      {}
    );
  }

  return value;
}

function createValueSignature(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function isUserIntentStorageKey(key: string): key is UserIntentStorageKey {
  return USER_INTENT_STORAGE_KEYS.includes(key as UserIntentStorageKey);
}

function parseRawStorageValue(
  key: UserIntentStorageKey,
  rawValue: string | null
): unknown {
  if (rawValue === null) {
    return undefined;
  }

  if (key === "vite-ui-theme") {
    try {
      return JSON.parse(rawValue) as unknown;
    } catch {
      return rawValue;
    }
  }

  try {
    return JSON.parse(rawValue) as unknown;
  } catch {
    return rawValue;
  }
}

function serializeStorageValue(
  key: UserIntentStorageKey,
  value: unknown
): string | null {
  if (value === undefined) {
    return null;
  }

  if (key === "vite-ui-theme") {
    if (typeof value === "string") {
      return value;
    }

    try {
      return JSON.stringify(value);
    } catch {
      return null;
    }
  }

  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

async function readUserIntentSnapshot(): Promise<UserIntentSnapshot> {
  const snapshot: UserIntentSnapshot = {};

  for (const key of USER_INTENT_STORAGE_KEYS) {
    const rawValue = await readAppStorageRaw(key);
    const parsedValue = parseRawStorageValue(key, rawValue);

    if (parsedValue === undefined) {
      continue;
    }

    snapshot[key] = parsedValue;
  }

  return snapshot;
}

async function applyUserIntentSnapshot(
  snapshot: UserIntentSnapshot
): Promise<void> {
  suppressMutationCapture = true;

  try {
    const snapshotKeys = Object.keys(snapshot) as UserIntentStorageKey[];

    for (const key of snapshotKeys) {
      if (!isUserIntentStorageKey(key)) {
        continue;
      }

      const value = snapshot[key];
      const serializedValue = serializeStorageValue(key, value);

      if (serializedValue === null) {
        await removeAppStorageKeys([key]);
        continue;
      }

      await writeAppStorageRaw(key, serializedValue);
    }
  } finally {
    suppressMutationCapture = false;
  }
}

function parseSessionCheckpoint(rawValue: unknown): SessionCheckpoint | null {
  if (!isRecord(rawValue)) {
    return null;
  }

  const {
    id,
    sessionId,
    openedAt,
    closedAt,
    actionCount,
    changedKeys,
    before,
    after,
  } = rawValue;

  if (
    typeof id !== "string" ||
    typeof sessionId !== "string" ||
    typeof openedAt !== "string" ||
    typeof closedAt !== "string" ||
    typeof actionCount !== "number" ||
    !Array.isArray(changedKeys) ||
    !isRecord(before) ||
    !isRecord(after)
  ) {
    return null;
  }

  const normalizedChangedKeys = changedKeys.filter(
    (key): key is UserIntentStorageKey => {
      return typeof key === "string" && isUserIntentStorageKey(key);
    }
  );

  return {
    id,
    sessionId,
    openedAt,
    closedAt,
    actionCount,
    changedKeys: normalizedChangedKeys,
    before: before as UserIntentSnapshot,
    after: after as UserIntentSnapshot,
  };
}

function parseSessionRestoreUndoState(
  rawValue: string | null
): SessionRestoreUndoState | null {
  if (!rawValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(rawValue) as unknown;

    if (!isRecord(parsedValue)) {
      return null;
    }

    const { checkpointClosedAt, checkpointId, restoredAt, snapshot } =
      parsedValue;

    if (
      typeof checkpointClosedAt !== "string" ||
      typeof checkpointId !== "string" ||
      typeof restoredAt !== "string" ||
      !isRecord(snapshot)
    ) {
      return null;
    }

    return {
      checkpointClosedAt,
      checkpointId,
      restoredAt,
      snapshot: snapshot as UserIntentSnapshot,
    };
  } catch {
    return null;
  }
}

async function readSessionActionJournal(): Promise<SessionActionJournal | null> {
  const rawValue = await readAppStorageRaw(SESSION_ACTION_JOURNAL_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(rawValue) as unknown;

    if (!isRecord(parsedValue)) {
      return null;
    }

    const { sessionId, startedAt, updatedAt, cursor, actions } = parsedValue;

    if (
      typeof sessionId !== "string" ||
      typeof startedAt !== "string" ||
      typeof updatedAt !== "string" ||
      typeof cursor !== "number" ||
      !Array.isArray(actions)
    ) {
      return null;
    }

    const validActions: SessionActionEntry[] = [];

    for (const item of actions) {
      if (!isRecord(item)) {
        continue;
      }

      const { id, label, createdAt, before, after } = item;

      if (
        typeof id !== "string" ||
        typeof label !== "string" ||
        typeof createdAt !== "string" ||
        !isRecord(before) ||
        !isRecord(after)
      ) {
        continue;
      }

      validActions.push({
        id,
        label,
        createdAt,
        before: before as UserIntentSnapshot,
        after: after as UserIntentSnapshot,
      });
    }

    return {
      sessionId,
      startedAt,
      updatedAt,
      cursor,
      actions: validActions,
    };
  } catch {
    return null;
  }
}

async function readSessionCheckpoints(): Promise<SessionCheckpoint[]> {
  const rawValue = await readAppStorageRaw(SESSION_CHECKPOINTS_KEY);

  if (!rawValue) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(rawValue) as unknown;

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    const checkpoints: SessionCheckpoint[] = [];

    for (const item of parsedValue) {
      const checkpoint = parseSessionCheckpoint(item);

      if (checkpoint) {
        checkpoints.push(checkpoint);
      }
    }

    return checkpoints;
  } catch {
    return [];
  }
}

async function readSessionRestoreUndoState(): Promise<SessionRestoreUndoState | null> {
  return parseSessionRestoreUndoState(
    await readAppStorageRaw(SESSION_RESTORE_UNDO_KEY)
  );
}

async function writeSessionRestoreUndoState(
  state: SessionRestoreUndoState | null
): Promise<void> {
  if (!state) {
    await writeAppStorageRaw(SESSION_RESTORE_UNDO_KEY, "{}");
    return;
  }

  await writeAppStorageRaw(SESSION_RESTORE_UNDO_KEY, JSON.stringify(state));
}

function getStorageAreaLabel(key: UserIntentStorageKey): string {
  return STORAGE_AREA_LABELS[key] ?? key;
}

function getChangedKeys(
  currentSnapshot: UserIntentSnapshot,
  targetSnapshot: UserIntentSnapshot
): UserIntentStorageKey[] {
  return USER_INTENT_STORAGE_KEYS.filter((key) => {
    return (
      createValueSignature(currentSnapshot[key]) !==
      createValueSignature(targetSnapshot[key])
    );
  });
}

function createEmptyJournal(
  sessionId: string,
  startedAt: string
): SessionActionJournal {
  return {
    sessionId,
    startedAt,
    updatedAt: startedAt,
    cursor: -1,
    actions: [],
  };
}

function persistActionJournal(): void {
  if (!actionJournal) {
    return;
  }

  writeAppStorageRaw(
    SESSION_ACTION_JOURNAL_KEY,
    JSON.stringify(actionJournal)
  ).catch(() => null);
}

function resetSessionState(): void {
  activeSession = null;
  activeAction = null;
  actionJournal = null;
}

function rebaseActiveSession(snapshot: UserIntentSnapshot): void {
  if (!trackingEnabled) {
    return;
  }

  const startedAt = new Date().toISOString();
  const sessionId = createUniqueId("session");

  activeSession = {
    id: sessionId,
    startedAt,
    baseline: cloneValue(snapshot),
    changedKeys: new Set<UserIntentStorageKey>(),
    actionCount: 0,
    finalized: false,
  };

  activeAction = null;
  actionJournal = createEmptyJournal(sessionId, startedAt);
  persistActionJournal();
}

export function setSessionActionTrackingEnabled(enabled: boolean): void {
  trackingEnabled = enabled;

  if (!enabled) {
    resetSessionState();
  }
}

export function isSessionActionTrackingEnabled(): boolean {
  return trackingEnabled;
}

export async function beginNewTabSession(): Promise<void> {
  if (!trackingEnabled) {
    return;
  }

  const startedAt = new Date().toISOString();
  const sessionId = createUniqueId("session");
  const baseline = await readUserIntentSnapshot();

  activeSession = {
    id: sessionId,
    startedAt,
    baseline,
    changedKeys: new Set<UserIntentStorageKey>(),
    actionCount: 0,
    finalized: false,
  };

  const existingJournal = await readSessionActionJournal();

  if (existingJournal && existingJournal.actions.length > 0) {
    actionJournal = {
      ...existingJournal,
      updatedAt: startedAt,
    };

    for (const action of existingJournal.actions) {
      for (const key of Object.keys(action.after)) {
        activeSession.changedKeys.add(key as UserIntentStorageKey);
      }
    }

    activeSession.actionCount = existingJournal.actions.length;
  } else {
    actionJournal = createEmptyJournal(sessionId, startedAt);
  }

  persistActionJournal();
}

export function runTrackedUserAction<T>(label: string, action: () => T): T {
  if (!(trackingEnabled && activeSession) || suppressMutationCapture) {
    return action();
  }

  if (activeAction) {
    return action();
  }

  activeAction = {
    id: createUniqueId("action"),
    label,
    createdAt: new Date().toISOString(),
    before: {},
    after: {},
    touchedKeys: new Set<UserIntentStorageKey>(),
  };

  let actionResult: T;

  try {
    actionResult = action();
  } finally {
    const finishedAction = activeAction;
    activeAction = null;

    if (
      finishedAction &&
      activeSession &&
      actionJournal &&
      finishedAction.touchedKeys.size > 0
    ) {
      if (actionJournal.cursor < actionJournal.actions.length - 1) {
        actionJournal.actions = actionJournal.actions.slice(
          0,
          actionJournal.cursor + 1
        );
      }

      const nextEntry: SessionActionEntry = {
        id: finishedAction.id,
        label: finishedAction.label,
        createdAt: finishedAction.createdAt,
        before: cloneValue(finishedAction.before),
        after: cloneValue(finishedAction.after),
      };

      actionJournal.actions.push(nextEntry);

      if (actionJournal.actions.length > ACTION_HISTORY_LIMIT) {
        actionJournal.actions.shift();
      }

      actionJournal.cursor = actionJournal.actions.length - 1;
      actionJournal.updatedAt = new Date().toISOString();

      for (const key of finishedAction.touchedKeys) {
        activeSession.changedKeys.add(key);
      }

      activeSession.actionCount = actionJournal.actions.length;
      activeSession.lastActionAt = actionJournal.updatedAt;

      persistActionJournal();
    }
  }

  return actionResult;
}

export function captureUserIntentMutation(
  key: string,
  beforeValue: unknown,
  afterValue: unknown
): void {
  if (
    !(trackingEnabled && activeSession && activeAction) ||
    suppressMutationCapture ||
    !isUserIntentStorageKey(key)
  ) {
    return;
  }

  const typedKey = key as UserIntentStorageKey;

  if (!(typedKey in activeAction.before)) {
    activeAction.before[typedKey] = cloneValue(beforeValue);
  }

  activeAction.after[typedKey] = cloneValue(afterValue);
  activeAction.touchedKeys.add(typedKey);
}

export function getUndoRedoState(): { canUndo: boolean; canRedo: boolean } {
  if (!actionJournal) {
    return {
      canUndo: false,
      canRedo: false,
    };
  }

  return {
    canUndo: actionJournal.cursor >= 0,
    canRedo: actionJournal.cursor < actionJournal.actions.length - 1,
  };
}

export async function undoTrackedUserAction(): Promise<boolean> {
  if (!(trackingEnabled && activeSession && actionJournal)) {
    return false;
  }

  if (actionJournal.cursor < 1) {
    return false;
  }

  const entry = actionJournal.actions[actionJournal.cursor];

  if (!entry) {
    return false;
  }

  await applyUserIntentSnapshot(entry.before);
  actionJournal.cursor -= 1;
  actionJournal.updatedAt = new Date().toISOString();
  persistActionJournal();

  return true;
}

export async function redoTrackedUserAction(): Promise<boolean> {
  if (!(trackingEnabled && activeSession && actionJournal)) {
    return false;
  }

  if (actionJournal.cursor < 0) {
    return false;
  }

  const nextCursor = actionJournal.cursor + 1;
  if (nextCursor >= actionJournal.actions.length) {
    return false;
  }

  const entry = actionJournal.actions[nextCursor];

  if (!entry) {
    return false;
  }

  await applyUserIntentSnapshot(entry.after);
  actionJournal.cursor = nextCursor;
  actionJournal.updatedAt = new Date().toISOString();
  persistActionJournal();

  return true;
}

export async function finalizeSessionCheckpointOnLeave(): Promise<boolean> {
  if (!(trackingEnabled && activeSession) || activeSession.finalized) {
    return false;
  }

  activeSession.finalized = true;

  const closedAt = new Date().toISOString();
  const currentSnapshot = await readUserIntentSnapshot();
  const netChangedKeys = getChangedKeys(
    currentSnapshot,
    activeSession.baseline
  );

  if (netChangedKeys.length === 0) {
    return false;
  }

  const checkpoint: SessionCheckpoint = {
    id: createUniqueId("checkpoint"),
    sessionId: activeSession.id,
    openedAt: activeSession.startedAt,
    closedAt,
    actionCount: activeSession.actionCount,
    changedKeys: netChangedKeys,
    before: cloneValue(activeSession.baseline),
    after: currentSnapshot,
  };

  const existingCheckpoints = await readSessionCheckpoints();
  const nextCheckpoints = [checkpoint, ...existingCheckpoints].slice(
    0,
    SESSION_CHECKPOINT_LIMIT
  );

  await writeAppStorageRaw(
    SESSION_CHECKPOINTS_KEY,
    JSON.stringify(nextCheckpoints)
  );

  return true;
}

export async function readLatestSessionCheckpointSummary(): Promise<SessionCheckpointSummary | null> {
  const [latestCheckpoint] = await readSessionCheckpointSummaries(1);

  if (!latestCheckpoint) {
    return null;
  }

  return latestCheckpoint;
}

export async function readSessionCheckpointSummaries(
  limit = SESSION_CHECKPOINT_LIMIT
): Promise<SessionCheckpointSummary[]> {
  const checkpoints = await readSessionCheckpoints();

  return checkpoints.slice(0, limit).map((checkpoint) => {
    return {
      id: checkpoint.id,
      closedAt: checkpoint.closedAt,
      openedAt: checkpoint.openedAt,
      actionCount: checkpoint.actionCount,
      changedKeys: checkpoint.changedKeys,
    };
  });
}

export async function restoreSessionCheckpoint(
  checkpointId: string
): Promise<boolean> {
  const checkpoints = await readSessionCheckpoints();
  const targetCheckpoint = checkpoints.find(
    (checkpoint) => checkpoint.id === checkpointId
  );

  if (!targetCheckpoint) {
    return false;
  }

  const currentSnapshot = await readUserIntentSnapshot();

  await writeSessionRestoreUndoState({
    checkpointClosedAt: targetCheckpoint.closedAt,
    checkpointId: targetCheckpoint.id,
    restoredAt: new Date().toISOString(),
    snapshot: currentSnapshot,
  });

  await applyUserIntentSnapshot(targetCheckpoint.before);
  const restoredSnapshot = await readUserIntentSnapshot();
  rebaseActiveSession(restoredSnapshot);

  return true;
}

export async function restoreLatestSessionCheckpoint(): Promise<boolean> {
  const [latestCheckpoint] = await readSessionCheckpointSummaries(1);

  if (!latestCheckpoint) {
    return false;
  }

  return restoreSessionCheckpoint(latestCheckpoint.id);
}

export async function readUndoSessionRestoreHint(): Promise<SessionRestoreUndoHint | null> {
  const undoState = await readSessionRestoreUndoState();

  if (!undoState) {
    return null;
  }

  const currentSnapshot = await readUserIntentSnapshot();
  const changedKeys = getChangedKeys(currentSnapshot, undoState.snapshot);

  if (changedKeys.length === 0) {
    return {
      canUndo: false,
      details: [
        "You are already at the state from before the last session restore.",
      ],
      summary: "Nothing to undo right now.",
    };
  }

  const detailLines = changedKeys.slice(0, 4).map((key) => {
    return getStorageAreaLabel(key);
  });

  if (changedKeys.length > detailLines.length) {
    const remaining = changedKeys.length - detailLines.length;
    detailLines.push(`+ ${remaining} more area${remaining === 1 ? "" : "s"}`);
  }

  return {
    canUndo: true,
    details: detailLines,
    summary: `Undo will restore data from before your last session restore (${undoState.restoredAt}).`,
  };
}

export async function undoLatestSessionRestore(): Promise<boolean> {
  const undoState = await readSessionRestoreUndoState();

  if (!undoState) {
    return false;
  }

  await applyUserIntentSnapshot(undoState.snapshot);
  const restoredSnapshot = await readUserIntentSnapshot();
  rebaseActiveSession(restoredSnapshot);
  await writeSessionRestoreUndoState(null);

  return true;
}
