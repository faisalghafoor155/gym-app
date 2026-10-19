/** What the desktop shell (electron/preload.cjs) exposes, when there is one. */
export interface BackupStatus {
  supported: boolean;
  /** Why backups are off, when `supported` is false. */
  reason?: string;
  /** Where the daily automatic copies are kept. */
  folder?: string;
  lastAutoAt?: string | null;
  autoCount?: number;
}

export interface BackupResult {
  ok: boolean;
  /** The user closed the file dialog or said no — not a failure. */
  canceled?: boolean;
  error?: string;
  path?: string;
  size?: number;
  /** Where a copy of the data from before a restore was put. */
  safetyCopy?: string;
}

export interface ElectronBackupApi {
  status(): Promise<BackupStatus>;
  create(): Promise<BackupResult>;
  restore(): Promise<BackupResult>;
  openFolder(): Promise<void>;
}

declare global {
  interface Window {
    electronAPI?: {
      isElectron?: boolean;
      backup?: ElectronBackupApi;
    };
  }
}
