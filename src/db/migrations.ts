export type BundledMigration = {
  sql: string[];
  folderMillis: number;
  hash: string;
  bps: boolean;
};
