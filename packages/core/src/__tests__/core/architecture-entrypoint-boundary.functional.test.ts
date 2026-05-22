import * as fs from 'fs';
import * as path from 'path';

describe('architecture quick start entrypoint boundary', () => {
  function readArchitectureQuickStart(): string {
    return fs.readFileSync(
      path.resolve(process.cwd(), 'ARCHITECTURE_QUICK_START.md'),
      'utf8',
    );
  }

  test('documents the dedicated core entrypoints and treats the root package as a compatibility wrapper', () => {
    const architectureQuickStart = readArchitectureQuickStart();

    expect(architectureQuickStart).toContain('@edison/core       Legacy wrapper (compatibility only)');
    expect(architectureQuickStart).toContain('@edison/core/cli   CLI startup');
    expect(architectureQuickStart).toContain('@edison/core/core  Programmatic bot creation');
    expect(architectureQuickStart).toContain('@edison/core/web   Web adapter bootstrap');
    expect(architectureQuickStart).toContain('`@edison/core` stays on `packages/core/src/index.ts` as a compatibility wrapper only.');
    expect(architectureQuickStart).toContain('`packages/core/src/legacy-entrypoint-runtime.ts`');
    expect(architectureQuickStart).toContain('`packages/core/src/standalone-entrypoint-runtime.ts`');
    expect(architectureQuickStart).toContain('New consumers should prefer `@edison/core/core`, `@edison/core/cli`, or `@edison/core/web` over the legacy root wrapper.');
  });

  test('documents the helper split behind the programmatic and web entrypoints', () => {
    const architectureQuickStart = readArchitectureQuickStart();

    expect(architectureQuickStart).toContain('`@edison/core/core` stays on `packages/core/src/core/index.ts`; config-aware runtime orchestration lives in `packages/core/src/core/core-entrypoint-runtime.ts`.');
    expect(architectureQuickStart).toContain('`@edison/core/web` stays on `packages/core/src/web/index.ts`; bot/web-server orchestration lives in `packages/core/src/web/web-entrypoint-runtime.ts`.');
    expect(architectureQuickStart).toContain('Callers import bot creation helpers from `@edison/core/core`.');
    expect(architectureQuickStart).toContain('Config-aware helpers can load validated runtime config without going through the legacy root wrapper.');
    expect(architectureQuickStart).toContain('`createWebServerRuntime(bot, webApiAdapter)`');
    expect(architectureQuickStart).toContain('`startWebServer(runtime, ports)`');
  });
});
