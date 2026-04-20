export const USER_STORAGE_KEYS = [
  "better-home-widget-settings",
  "better-home-todos",
  "better-home-todo-groups",
  "better-home-todo-sort",
  "better-home-todo-group-by",
  "better-home-todo-collapsed-sections",
  "better-home-todo-filters",
  "better-home-quick-links",
  "better-home-quick-links-previews",
  "better-home-quick-links-sort",
  "mood-calendar-2026-data",
  "mood-calendar-show-numbers",
  "vite-ui-theme",
] as const;

export const SESSION_ACTION_JOURNAL_KEY = "better-home-session-action-journal";
export const SESSION_CHECKPOINTS_KEY = "better-home-session-checkpoints";
export const SESSION_RESTORE_UNDO_KEY = "better-home-session-restore-undo";

export const USER_INTENT_STORAGE_KEYS = [
  "better-home-widget-settings",
  "better-home-todos",
  "better-home-todo-groups",
  "better-home-todo-sort",
  "better-home-todo-group-by",
  "better-home-todo-collapsed-sections",
  "better-home-todo-filters",
  "better-home-quick-links",
  "better-home-quick-links-sort",
  "mood-calendar-2026-data",
  "mood-calendar-show-numbers",
  "vite-ui-theme",
] as const;

export const STORAGE_MIGRATION_KEY = "better-home-storage-migration";
export const CHANGELOG_LAST_SEEN_VERSION_KEY =
  "better-home-changelog-last-seen-version";
export const FEEDBACK_PROMPT_STATE_KEY = "better-home-feedback-prompt-state";

export const STORAGE_KEY_PREFIXES = ["better-home-", "mood-calendar-"] as const;

export const BACKUP_STORAGE_KEYS = [
  "better-home-backup-status",
  "better-home-auto-backups",
  "better-home-auto-backup-meta",
  "better-home-backup-file-config",
] as const;

export const KNOWN_APP_STORAGE_KEYS = [
  ...USER_STORAGE_KEYS,
  ...BACKUP_STORAGE_KEYS,
  SESSION_ACTION_JOURNAL_KEY,
  SESSION_CHECKPOINTS_KEY,
  SESSION_RESTORE_UNDO_KEY,
  STORAGE_MIGRATION_KEY,
  CHANGELOG_LAST_SEEN_VERSION_KEY,
  FEEDBACK_PROMPT_STATE_KEY,
] as const;

export const CLEARABLE_CACHE_STORAGE_KEYS = [
  "better-home-quick-links-previews",
  "better-home-quick-links-preview-image-data",
  "better-home-quick-links-preview-existing-links-hydration",
] as const;
