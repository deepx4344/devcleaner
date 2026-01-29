import { AppConfig } from "../types/index.js";
import fs from "fs/promises";

const readConfigFile = async (path: string): Promise<AppConfig | undefined> => {
  try {
    const content = await fs.readFile(path, "utf8");
    const configurationFile = JSON.parse(content);

    if (configurationFile && typeof configurationFile === 'object') {
      const config = configurationFile as AppConfig;
      if (!Array.isArray(config.filePatternToDelete)) config.filePatternToDelete = [];
      if (!Array.isArray(config.folderToDeleteByName)) config.folderToDeleteByName = [];
      if (!Array.isArray(config.fileExclusions)) config.fileExclusions = [];
      if (!Array.isArray(config.folderExclusions)) config.folderExclusions = [];
      if (!Array.isArray(config.directoriesToScan)) config.directoriesToScan = ["."];
      return config;
    }

    return undefined;
  } catch (err) {
    if (err instanceof Error)
      console.error(`Failed to read configuration File: ${err.message || err}`);
    else {
      console.error(err);
    }
  }
};


export default readConfigFile
