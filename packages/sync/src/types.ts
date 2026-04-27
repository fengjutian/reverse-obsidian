export type SyncStatus = "synced" | "syncing" | "conflict" | "offline";

export interface SyncOperation {
  opId: string;
  path: string;
  type: "create" | "update" | "delete";
  timestamp: number;
}
