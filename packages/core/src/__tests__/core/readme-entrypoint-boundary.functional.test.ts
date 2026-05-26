import * as fs from 'fs';
import * as path from 'path';

describe('README entrypoint boundary', () => {
  const workspaceRoot = path.resolve(process.cwd(), '..', '..');

  function readWorkspaceFile(relativePath: string): string {
    return fs.readFileSync(path.resolve(workspaceRoot, relativePath), 'utf8');
  }

  test('documents the dedicated CLI entrypoint and treats src/index.ts as a legacy wrapper only', () => {
    const readme = readWorkspaceFile('README.md');

    expect(readme).toContain('`@edison/core/cli`: CLI startup, config loading, bot startup, embedded web server startup.');
    expect(readme).toContain('Implementation lives in `packages/core/src/cli/index.ts`.');
    expect(readme).toContain('`@edison/core`: legacy wrapper that re-exports the dedicated entrypoints and only starts the CLI when executed directly.');
    expect(readme).toContain('Existing `@edison/core` consumers can keep that compatibility wrapper while migrating, but new examples should stay on the dedicated `@edison/core/core`, `@edison/core/cli`, and `@edison/core/web` surfaces.');
    expect(readme).toContain('Prefer `@edison/core/core`, `@edison/core/cli`, or `@edison/core/web` for new code.');
    expect(readme).toContain('The CLI entrypoint keeps its public surface on `main()`, `runCliMain()`, and `runCliMainIfMain()` so embedded callers and direct execution stay explicit.');
    expect(readme).toContain('Both the dedicated CLI entrypoint and the legacy wrapper reuse the shared standalone runner contract in `packages/core/src/standalone-entrypoint-runtime.ts` so package imports stay side-effect free.');
    expect(readme).toContain('That shared runner resolves the default main-module guard in one place, so wrapper call sites do not need to thread `require.main` manually.');
    expect(readme).toContain('runtime orchestration lives in `packages/core/src/core/core-entrypoint-runtime.ts`.');
    expect(readme).toContain('bot/web-server adapter orchestration lives in `packages/core/src/web/web-entrypoint-runtime.ts`, where callers hand off an explicit `{ botAdapter, webApiAdapter }` pair.');
    expect(readme).not.toContain('This starts the CLI entrypoint from `packages/core/src/index.ts`.');
  });

  test('documents the config-aware programmatic helpers on the core entrypoint instead of deep imports', () => {
    const readme = readWorkspaceFile('README.md');

    expect(readme).toContain('## Programmatic API');
    expect(readme).toContain('Use `@edison/core/core` for non-CLI callers.');
    expect(readme).toContain('That package surface intentionally keeps raw runtime creation helpers and config-aware loader helpers together so consumers do not need deep imports.');
    expect(readme).toContain('| `createBot(config)` | caller provides validated config | no | tests, embedding, custom lifecycle control |');
    expect(readme).toContain('| `createBotRuntime(config)` | caller provides validated config | no | access to both `bot` and runtime adapters |');
    expect(readme).toContain('| `createConfiguredBotRuntime()` | ConfigPipeline | no | programmatic runtime bundle creation without auto-start |');
    expect(readme).toContain('| `startConfiguredBot()` | ConfigPipeline | yes | one-shot startup with built-in config loading |');
    expect(readme).toContain('`loadBotRuntimeConfig(loader?)` is the shared public config-loader seam for those config-aware helper paths.');
    expect(readme).toContain("} from '@edison/core/core';");
    expect(readme).toContain('For new programmatic consumers, import these helpers from `@edison/core/core`');
    expect(readme).toContain('Keep compatibility imports from `@edison/core` limited to existing callers that have not migrated to the dedicated entrypoints yet.');
    expect(readme).toContain('type ConfigPipelineLoader,');
    expect(readme).toContain("} from '@edison/core/core';");
    expect(readme).toContain('Avoid deep imports such as `@edison/core/config/config-pipeline` or `packages/core/src/config/config-pipeline` in consumers.');
    expect(readme).toContain('createConfiguredBotRuntime,');
    expect(readme).toContain('const runtimeWithCustomLoader = await createConfiguredBotRuntime({');
    expect(readme).toContain('const runtime = await createBotRuntime(config);');
    expect(readme).toContain('await runtime.bot.start();');
    expect(readme).toContain('`createConfiguredBotRuntime()` still leaves lifecycle control with the caller');
    expect(readme).toContain('returns the bot together with its runtime adapters without auto-starting lifecycle');
    expect(readme).toContain('Only `startBot()` and `startConfiguredBot()` auto-start the bot.');
    expect(readme).toContain('Treat `@edison/core` as a compatibility wrapper for existing consumers, and keep new programmatic examples on `@edison/core/core`.');
    expect(readme).toContain('For programmatic web-server startup, keep the runtime pair explicit:');
    expect(readme).toContain("import { createWebServerRuntime, startWebServer } from '@edison/core/web';");
    expect(readme).toContain('`createWebServerRuntime(bot, webApiAdapter)`');
    expect(readme).toContain('`startWebServer(runtime, ports)`');
    expect(readme).toContain('read-only web API adapter visible at the boundary instead of rediscovering adapters through bot internals.');
    expect(readme).toContain('The `@edison/core/web` surface stays intentionally narrow: build the runtime pair first, then hand that pair to the starter without rediscovering adapters through bot internals.');
    expect(readme).toContain('const webServer = await startWebServer(');
  });

  test('documents focused contracts subpaths for consumer-facing DTO boundaries', () => {
    const readme = readWorkspaceFile('README.md');

    expect(readme).toContain('`@edison/contracts`: shared runtime and web API contracts, with focused subpaths on `@edison/contracts/web-api` and `@edison/contracts/runtime-api`.');
    expect(readme).toContain('`trading-bot-web-client`: private workspace app package. Keep it on local workspace boundaries only; do not treat it as a published import surface.');
    expect(readme).toContain('Prefer `@edison/contracts/web-api` or `@edison/contracts/runtime-api` over the broad `@edison/contracts` barrel, and never reach into `packages/contracts/src`.');
  });

  test('documents the workspace build/test graph instead of implying a single-package root flow', () => {
    const readme = readWorkspaceFile('README.md');

    expect(readme).toContain('Root build is workspace-based and currently builds `packages/contracts`, `packages/web-server`, `packages/core`, and `packages/web-client`.');
    expect(readme).toContain('Root test delegation is workspace-based too: use `npm run test:contracts`, `npm run test:web-server`, `npm run test:core`, `npm run test:web-client`, or the ordered aggregate `npm run test:packages`.');
    expect(readme).toContain('## Workspace Build And Test Graph');
    expect(readme).toContain('`npm run build` builds workspace packages in dependency order: `contracts -> web-server -> core -> web-client`.');
    expect(readme).toContain('`npm run test:contracts` typechecks the shared contracts package without emitting build artifacts.');
    expect(readme).toContain('`npm run test:packages` runs the package-level verification chain in the same workspace order used by the root build/test boundary.');
  });

  test('entrypoint source wording stays aligned with the documented helper boundaries', () => {
    const cliEntrypoint = readWorkspaceFile('packages/core/src/cli/index.ts');
    const legacyEntrypoint = readWorkspaceFile('packages/core/src/index.ts');
    const webEntrypoint = readWorkspaceFile('packages/core/src/web/index.ts');

    expect(cliEntrypoint).toContain('CLI entrypoint runtime boundary');
    expect(cliEntrypoint).toContain('Shared standalone if-main guard');
    expect(legacyEntrypoint).toContain('Legacy compatibility wrapper');
    expect(legacyEntrypoint).toContain('shared standalone if-main helper');
    expect(webEntrypoint).toContain('Explicit web entrypoint boundary');
    expect(webEntrypoint).toContain('runtime pair');
  });
});
