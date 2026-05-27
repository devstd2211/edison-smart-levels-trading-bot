import * as fs from 'fs';
import * as path from 'path';

describe('architecture quick start entrypoint boundary', () => {
  const workspaceRoot = findWorkspaceRoot(__dirname);

  function findWorkspaceRoot(startPath: string): string {
    let currentPath = startPath;

    while (true) {
      const packageJsonPath = path.resolve(currentPath, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
          workspaces?: string[];
        };
        if (packageJson.workspaces) {
          return currentPath;
        }
      }

      const parentPath = path.dirname(currentPath);
      if (parentPath === currentPath) {
        throw new Error('Workspace root not found');
      }
      currentPath = parentPath;
    }
  }

  function readArchitectureQuickStart(): string {
    return fs.readFileSync(
      path.resolve(workspaceRoot, 'ARCHITECTURE_QUICK_START.md'),
      'utf8',
    );
  }

  test('documents the dedicated core entrypoints and treats the root package as a compatibility wrapper', () => {
    const architectureQuickStart = readArchitectureQuickStart();

    expect(architectureQuickStart).toContain('@edison/core       Legacy wrapper (compatibility only)');
    expect(architectureQuickStart).toContain('@edison/core/cli   CLI startup');
    expect(architectureQuickStart).toContain('@edison/core/core  Programmatic bot creation');
    expect(architectureQuickStart).toContain('@edison/core/config  Runtime-config helpers');
    expect(architectureQuickStart).toContain('@edison/core/web   Web adapter bootstrap');
    expect(architectureQuickStart).toContain('`@edison/core` stays on `packages/core/src/index.ts` as a compatibility wrapper only.');
    expect(architectureQuickStart).toContain('`packages/core/src/legacy-entrypoint-runtime.ts`');
    expect(architectureQuickStart).toContain('`packages/core/src/standalone-entrypoint-runtime.ts`');
    expect(architectureQuickStart).toContain('Existing `@edison/core` imports can stay on that compatibility wrapper during migration, but new examples should stay on the dedicated core, cli, and web entrypoints.');
    expect(architectureQuickStart).toContain('New consumers should prefer `@edison/core/core`, `@edison/core/cli`, or `@edison/core/web` over the legacy root wrapper.');
  });

  test('documents the helper split behind the programmatic and web entrypoints', () => {
    const architectureQuickStart = readArchitectureQuickStart();

    expect(architectureQuickStart).toContain('`@edison/core/core` stays on `packages/core/src/core/index.ts`; it is the stable non-CLI helper surface, while config-aware helper orchestration lives in `packages/core/src/core/core-entrypoint-runtime.ts` and receives config loading through the public `loadBotRuntimeConfig(loader?)` seam.');
    expect(architectureQuickStart).toContain('`@edison/core/config` stays on `packages/core/src/config/index.ts`; it is the dedicated config-only surface for runtime-config helpers plus the publishable `ConfigPipelineLoader`, `ConfigPipelineBaseConfigLoader`, and `ConfigPipelineConfigValidator` type aliases.');
    expect(architectureQuickStart).toContain('`@edison/core/web` stays on `packages/core/src/web/index.ts`; bot/web-server orchestration lives in `packages/core/src/web/web-entrypoint-runtime.ts`, where callers hand off an explicit `{ botAdapter, webApiAdapter }` pair.');
    expect(architectureQuickStart).toContain('The CLI path builds that same explicit pair through `createCliWebRuntimeHandoff(...)` before it calls the web starter, so CLI startup owns orchestration without giving the web adapter a broad bot surface.');
    expect(architectureQuickStart).toContain('Runtime flow keeps this order: load config, create the core bot runtime, materialize the web runtime pair through `createCliWebRuntimeHandoff(...)`, hand that pair to `startWebServer(...)`, then start the bot lifecycle.');
    expect(architectureQuickStart).toContain('Standalone workflow wrappers such as `packages/core/src/collect-data.ts`, `packages/core/src/test-balance.ts`, and `packages/core/src/vector-db.ts` also reuse `packages/core/src/standalone-entrypoint-runtime.ts` so imports stay side-effect free and direct execution remains explicit.');
    expect(architectureQuickStart).toContain('The shared standalone runner resolves `require.main` in one place through `resolveStandaloneEntrypointMainModule()`, so wrapper call sites can rely on the default main-module guard instead of threading `require.main` manually.');
    expect(architectureQuickStart).toContain('Standalone workflow presentation lives in `packages/core/src/standalone-script-console.ts`, which keeps banner/footer formatting separate from workflow orchestration.');
    expect(architectureQuickStart).toContain('Callers import bot creation helpers from `@edison/core/core`.');
    expect(architectureQuickStart).toContain('Config-only consumers can stay on `@edison/core/config`, where the full loader contract aliases live, while `@edison/core/core` keeps a type-only convenience re-export for the composed `ConfigPipelineLoader` only.');
    expect(architectureQuickStart).toContain('Config-aware helpers can load validated runtime config without going through the legacy root wrapper, and `loadBotRuntimeConfig(loader?)` stays as the shared public config-loader seam injected into `createConfiguredBot()`, `createConfiguredBotRuntime()`, and `startConfiguredBot()`');
    expect(architectureQuickStart).toContain('`createWebServerRuntime(bot, webApiAdapter)`');
    expect(architectureQuickStart).toContain('`startWebServer(runtime, ports)`');
    expect(architectureQuickStart).toContain('The lower-level web runtime helper keeps construction and lifecycle separate: `createWebServerInstance(runtime, ports, WebServerCtor)` constructs from the explicit pair, and `startWebServerRuntime(...)` starts it.');
    expect(architectureQuickStart).toContain('`createWebServerInstance(...)` stays construction-only; `startWebServerRuntime(...)` is the lower-level lifecycle start helper.');
  });
});
