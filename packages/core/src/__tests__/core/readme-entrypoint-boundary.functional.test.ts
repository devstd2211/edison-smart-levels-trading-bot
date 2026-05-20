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
    expect(readme).toContain('| `createConfiguredBotRuntime()` | ConfigPipeline | no | programmatic runtime bundle creation without auto-start |');
    expect(readme).toContain('| `startConfiguredBot()` | ConfigPipeline | yes | one-shot startup with built-in config loading |');
    expect(readme).toContain("} from '@edison/core/core';");
    expect(readme).toContain('For new programmatic consumers, import these helpers from `@edison/core/core`');
    expect(readme).toContain("type ConfigPipelineLoader,\n} from '@edison/core/core';");
    expect(readme).toContain('Avoid deep imports such as `@edison/core/config/config-pipeline` or `packages/core/src/config/config-pipeline` in consumers.');
    expect(readme).toContain('createConfiguredBotRuntime,');
    expect(readme).toContain('const runtimeWithCustomLoader = await createConfiguredBotRuntime({');
    expect(readme).toContain('const runtime = await createBotRuntime(config);');
    expect(readme).toContain('await runtime.bot.start();');
    expect(readme).toContain('`createConfiguredBotRuntime()` still leaves lifecycle control with the caller');
    expect(readme).toContain('returns the bot together with its runtime adapters without auto-starting lifecycle');
    expect(readme).toContain('Only `startBot()` and `startConfiguredBot()` auto-start the bot.');
    expect(readme).toContain('For programmatic web-server startup, keep the runtime pair explicit:');
    expect(readme).toContain("import { createWebServerRuntime, startWebServer } from '@edison/core/web';");
    expect(readme).toContain('`createWebServerRuntime(bot, webApiAdapter)`');
    expect(readme).toContain('`startWebServer(runtime, ports)`');
    expect(readme).toContain('const webServer = await startWebServer(');
  });

  test('documents focused contracts subpaths for consumer-facing DTO boundaries', () => {
    const readmePath = path.resolve(process.cwd(), 'README.md');
    const readme = fs.readFileSync(readmePath, 'utf8');

    expect(readme).toContain('`@edison/contracts`: shared runtime and web API contracts, with focused subpaths on `@edison/contracts/web-api` and `@edison/contracts/runtime-api`.');
    expect(readme).toContain('`trading-bot-web-client`: private workspace app package. Keep it on local workspace boundaries only; do not treat it as a published import surface.');
    expect(readme).toContain('Prefer `@edison/contracts/web-api` or `@edison/contracts/runtime-api` over the broad `@edison/contracts` barrel, and never reach into `packages/contracts/src`.');
  });
});
