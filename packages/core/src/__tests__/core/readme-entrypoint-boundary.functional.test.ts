import * as fs from 'fs';
import * as path from 'path';

describe('README entrypoint boundary', () => {
  test('documents the dedicated CLI entrypoint and treats src/index.ts as a legacy wrapper only', () => {
    const readmePath = path.resolve(process.cwd(), 'README.md');
    const readme = fs.readFileSync(readmePath, 'utf8');

    expect(readme).toContain('`packages/core/src/cli/index.ts`: CLI startup, config loading, bot startup, embedded web server startup.');
    expect(readme).toContain('`packages/core/src/index.ts`: legacy wrapper that re-exports CLI/core and only starts the CLI when executed directly.');
    expect(readme).not.toContain('This starts the CLI entrypoint from `packages/core/src/index.ts`.');
  });
});
