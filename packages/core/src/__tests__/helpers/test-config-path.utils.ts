import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '../../../../..');

// config.json is gitignored (holds local secrets); fall back to the committed example
// so config-dependent tests also run on a fresh clone.
export function resolveTestConfigPath(): string {
  const localConfig = path.join(REPO_ROOT, 'config.json');
  return fs.existsSync(localConfig) ? localConfig : path.join(REPO_ROOT, 'config.example.json');
}
