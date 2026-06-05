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
    expect(architectureQuickStart).toContain('If embedded web startup fails, the CLI records that degradation before bot startup, registers shutdown with no web server instance, and continues the bot lifecycle.');
    expect(architectureQuickStart).toContain('CLI default API/WS ports are static runtime constants in `packages/core/src/cli/cli-runtime.ts`; `API_PORT` and `WS_PORT` override only those embedded defaults, while the web-client dev-server port/command stays in a separate CLI guidance constant.');
    expect(architectureQuickStart).toContain('CLI banner, configuration summary, web-server success, test-mode, fatal startup, endpoint, and warning output stay behind exported `cli-entrypoint-runtime.ts` constants; grouped banner/configuration/startup/failure rows are materialized by helper functions, and embedded port parsing stays behind the named `parseCliPort(...)` helper in `cli-runtime.ts`.');
    expect(architectureQuickStart).toContain('CLI startup phase orchestration stays in `packages/core/src/cli/index.ts`: `loadCliStartupConfigPhase(...)` owns config loading plus config-summary logging before runtime and web-server phase helpers run.');
    expect(architectureQuickStart).toContain('CLI output icon usage stays traceable through the `CLI_OUTPUT_ICON_KEYS` table in `cli-runtime.ts`, so banner, endpoint, and exchange-mode glyphs come from shared `ICONS` entries.');
    expect(architectureQuickStart).toContain('Standalone workflow wrappers such as `packages/core/src/collect-data.ts`, `packages/core/src/test-balance.ts`, and `packages/core/src/vector-db.ts` also reuse `packages/core/src/standalone-entrypoint-runtime.ts` so imports stay side-effect free and direct execution remains explicit.');
    expect(architectureQuickStart).toContain('The shared standalone runner resolves `require.main` in one place through `resolveStandaloneEntrypointMainModule()`, so wrapper call sites can rely on the default main-module guard instead of threading `require.main` manually.');
    expect(architectureQuickStart).toContain('Standalone workflow presentation lives in `packages/core/src/standalone-script-console.ts`, which keeps banner/footer formatting separate from workflow orchestration.');
    expect(architectureQuickStart).toContain('Callers import bot creation helpers from `@edison/core/core`.');
    expect(architectureQuickStart).toContain('Config-only consumers can stay on `@edison/core/config`, where the full loader contract aliases live, while `@edison/core/core` keeps a type-only convenience re-export for the composed `ConfigPipelineLoader` only.');
    expect(architectureQuickStart).toContain('Config-aware helpers can load validated runtime config without going through the legacy root wrapper, and `loadBotRuntimeConfig(loader?)` stays as the shared public config-loader seam injected into `createConfiguredBot()`, `createConfiguredBotRuntime()`, and `startConfiguredBot()`');
    expect(architectureQuickStart).toContain('The programmatic runtime handoff stays on the explicit `{ bot, webApiAdapter }` pair rather than exposing the broader factory runtime source.');
    expect(architectureQuickStart).toContain('That explicit pair is published on `@edison/core/core` as the named `CoreEntrypointRuntime` handoff type, so programmatic consumers can depend on one stable runtime contract instead of recreating the pair shape locally.');
    expect(architectureQuickStart).toContain('`createWebServerRuntime(bot, webApiAdapter)`');
    expect(architectureQuickStart).toContain('`startWebServer(runtime, ports)`');
    expect(architectureQuickStart).toContain('The lower-level web runtime helper keeps construction and lifecycle separate: `createWebServerInstance(runtime, ports, WebServerCtor)` constructs from the explicit pair, and `startWebServerRuntime(...)` starts it.');
    expect(architectureQuickStart).toContain('`createWebServerInstance(...)` stays construction-only; `startWebServerRuntime(...)` is the lower-level lifecycle start helper.');
    expect(architectureQuickStart).toContain('The web entrypoint publishes that runtime pair on `@edison/core/web` as the named `TradingBotWebServerRuntime` contract, keeping web-server embedding on one explicit adapter handoff type.');
  });
});
