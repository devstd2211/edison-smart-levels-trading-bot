import * as fs from 'fs';
import * as path from 'path';

describe('README entrypoint boundary', () => {
  test('documents the dedicated CLI entrypoint and treats src/index.ts as a legacy wrapper only', () => {
    const readmePath = path.resolve(process.cwd(), 'README.md');
    const readme = fs.readFileSync(readmePath, 'utf8');

    expect(readme).toContain('`@edison/core/cli`: CLI startup, config loading, bot startup, embedded web server startup.');
    expect(readme).toContain('Implementation lives in `packages/core/src/cli/index.ts`.');
    expect(readme).toContain('`@edison/core`: legacy wrapper that re-exports the dedicated entrypoints and only starts the CLI when executed directly.');
    expect(readme).toContain('Prefer `@edison/core/core`, `@edison/core/cli`, or `@edison/core/web` for new code.');
    expect(readme).not.toContain('This starts the CLI entrypoint from `packages/core/src/index.ts`.');
  });

  test('documents the config-aware programmatic helpers on the core entrypoint instead of deep imports', () => {
    const readmePath = path.resolve(process.cwd(), 'README.md');
    const readme = fs.readFileSync(readmePath, 'utf8');

    expect(readme).toContain('## Programmatic API');
    expect(readme).toContain('Use `@edison/core/core` for non-CLI callers.');
    expect(readme).toContain('| `createBot(config)` | caller provides validated config | no | tests, embedding, custom lifecycle control |');
    expect(readme).toContain('| `createBotRuntime(config)` | caller provides validated config | no | access to both `bot` and runtime adapters |');
    expect(readme).toContain('| `startConfiguredBot()` | ConfigPipeline | yes | one-shot startup with built-in config loading |');
    expect(readme).toContain("} from '@edison/core';");
    expect(readme).toContain('Avoid deep imports such as `@edison/core/config/config-pipeline` or `packages/core/src/config/config-pipeline` in consumers.');
  });

  test('documents focused contracts subpaths for consumer-facing DTO boundaries', () => {
    const readmePath = path.resolve(process.cwd(), 'README.md');
    const readme = fs.readFileSync(readmePath, 'utf8');

    expect(readme).toContain('`@edison/contracts`: shared runtime and web API contracts, with focused subpaths on `@edison/contracts/web-api` and `@edison/contracts/runtime-api`.');
  });
});
