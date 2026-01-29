export interface ItemToDelete {
  path: string;
  type: "file" | "folder";
}
export interface AppConfig {
  directoriesToScan: string[];
  filePatternToDelete: string[];
  folderToDeleteByName: string[];
  fileExclusions: string[];
  folderExclusions: string[];
}
export interface CleanerOptions {
  configPath: string;
  scanAll: boolean;
  verbose: boolean;
  force: boolean;
  signal?: AbortSignal;
}

export interface ScanResult {
  filesToDelete: ItemToDelete[];
}