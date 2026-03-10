import * as fs from 'fs';
import * as path from 'path';
import { promises as fsPromises } from 'fs';

export type JsonLinePayload = object;

export async function ensureParentDirectoryExists(filePath: string): Promise<void> {
  const dataDir = path.dirname(filePath);
  if (!fs.existsSync(dataDir)) {
    await fsPromises.mkdir(dataDir, { recursive: true });
  }
}

export async function appendJsonLine<TPayload extends JsonLinePayload>(
  filePath: string,
  payload: TPayload,
): Promise<void> {
  const line = JSON.stringify(payload) + '\n';
  await fsPromises.appendFile(filePath, line);
}
