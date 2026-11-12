import { dataFileDownloadName, type DataFile } from "../domain/dataFile";
import { downloadJsonFile } from "./json-download";

export function downloadDataFile(file: DataFile) {
  downloadJsonFile(dataFileDownloadName(), `${JSON.stringify(file, null, 2)}\n`);
}
