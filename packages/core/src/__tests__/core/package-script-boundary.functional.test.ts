import * as fs from 'fs';
import { createRequire } from 'module';
import * as path from 'path';

type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  exports?: Record<string, unknown>;
  files?: string[];
  private?: boolean;
  scripts?: Record<string, string>;
};

type TsConfigReferences = {
  references?: Array<{ path: string }>;
};

function readJsonFile<T>(relativePath: string): T {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  return JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as T;
}

function readTextFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

function collectFiles(relativePath: string, extensions: string[]): string[] {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  const entries = fs.readdirSync(absolutePath, { withFileTypes: true });

  return entries.flatMap((entry) => {
    const entryRelativePath = path.join(relativePath, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'dist') {
        return [];
      }
      return collectFiles(entryRelativePath, extensions);
    }

    return extensions.includes(path.extname(entry.name)) ? [entryRelativePath] : [];
  });
}

function assertNoContractsBoundaryViolations(files: string[]): void {
  for (const guardrailFile of files) {
    const content = readTextFile(guardrailFile);
    expect(content).not.toContain('../contracts/src');
    expect(content).not.toContain('packages/contracts/src');
    expect(content).not.toContain("from '@edison/contracts';");
    expect(content).not.toContain('from "@edison/contracts";');
  }
}

function assertNoGeneratedSourceArtifacts(relativePath: string): void {
  const generatedArtifacts = collectFiles(relativePath, ['.js', '.d.ts', '.map']);
  expect(generatedArtifacts).toEqual([]);
}

describe('package script boundary', () => {
  test('root build scripts delegate through workspace packages and tsconfig refs preserve the same dependency order', () => {
    const rootPackage = readJsonFile<PackageJson>('package.json');
    const corePackage = readJsonFile<PackageJson>('packages/core/package.json');
    const tsconfigReferences = readJsonFile<TsConfigReferences>('tsconfig.references.json');

    expect(rootPackage.scripts).toMatchObject({
      'build:contracts': 'npm --prefix packages/contracts run build',
      'build:web-server': 'npm --prefix packages/web-server run build',
      'build:core': 'npm --prefix packages/core run build',
      'build:web-client': 'npm --prefix packages/web-client run build',
      build: 'npm --prefix packages/contracts run build && npm --prefix packages/web-server run build && npm --prefix packages/core run build && npm --prefix packages/web-client run build',
      'build:refs': 'tsc -b tsconfig.references.json',
      start: 'npm --prefix packages/core run start',
      dev: 'npm --prefix packages/core run dev',
      'dev:cli': 'npm --prefix packages/core run dev:cli',
    });
    expect(rootPackage.scripts?.['dev:full']).toBe(
      'concurrently "npm --prefix packages/core run dev" "npm --prefix packages/web-server run dev" "npm --prefix packages/web-client run dev"',
    );

    expect(corePackage.scripts).toMatchObject({
      dev: 'npm run dev:cli',
      'dev:cli': 'ts-node src/cli/index.ts',
      start: 'npm run start:cli',
      'start:cli': 'node dist/cli/index.js',
    });

    expect(JSON.stringify(rootPackage.scripts)).not.toContain('packages/core/src/index.ts');

    expect(tsconfigReferences.references).toEqual([
      { path: './packages/contracts' },
      { path: './packages/web-server' },
      { path: './packages/core' },
      { path: './packages/web-client' },
    ]);
  });

  test('workspace packages expose stable export maps instead of source-path entrypoints', () => {
    const corePackage = readJsonFile<PackageJson>('packages/core/package.json');
    const contractsPackage = readJsonFile<PackageJson>('packages/contracts/package.json');
    const webServerPackage = readJsonFile<PackageJson>('packages/web-server/package.json');
    const webClientPackage = readJsonFile<PackageJson>('packages/web-client/package.json');

    expect(corePackage.files).toEqual(['dist']);
    expect(corePackage.exports).toEqual({
      '.': {
        types: './dist/index.d.ts',
        require: './dist/index.js',
        default: './dist/index.js',
      },
      './core': {
        types: './dist/core/index.d.ts',
        require: './dist/core/index.js',
        default: './dist/core/index.js',
      },
      './cli': {
        types: './dist/cli/index.d.ts',
        require: './dist/cli/index.js',
        default: './dist/cli/index.js',
      },
      './web': {
        types: './dist/web/index.d.ts',
        require: './dist/web/index.js',
        default: './dist/web/index.js',
      },
    });

    expect(contractsPackage.files).toEqual(['dist']);
    expect(contractsPackage.exports).toEqual({
      '.': {
        types: './dist/index.d.ts',
        require: './dist/index.js',
        default: './dist/index.js',
      },
      './web-api': {
        types: './dist/web-api.d.ts',
        require: './dist/web-api.js',
        default: './dist/web-api.js',
      },
      './runtime-api': {
        types: './dist/runtime-api.d.ts',
        require: './dist/runtime-api.js',
        default: './dist/runtime-api.js',
      },
    });

    expect(webServerPackage.files).toEqual(['dist']);
    expect(webServerPackage.exports).toEqual({
      '.': {
        types: './dist/index.d.ts',
        require: './dist/index.js',
        default: './dist/index.js',
      },
    });

    expect(webClientPackage.private).toBe(true);
    expect(webClientPackage.files).toEqual(['dist']);
    expect(webClientPackage).not.toHaveProperty('main');
    expect(webClientPackage).not.toHaveProperty('types');
    expect(webClientPackage).not.toHaveProperty('exports');
  });

  test('workspace package exports resolve through built package entrypoints in node', () => {
    const workspaceRequires = {
      root: createRequire(path.resolve(process.cwd(), 'package.json')),
      core: createRequire(path.resolve(process.cwd(), 'packages/core/package.json')),
      webServer: createRequire(path.resolve(process.cwd(), 'packages/web-server/package.json')),
      webClient: createRequire(path.resolve(process.cwd(), 'packages/web-client/package.json')),
    };

    expect(workspaceRequires.root.resolve('@edison/core')).toMatch(/packages[\\/]core[\\/]dist[\\/]index\.js$/);
    expect(workspaceRequires.root.resolve('@edison/core/core')).toMatch(/packages[\\/]core[\\/]dist[\\/]core[\\/]index\.js$/);
    expect(workspaceRequires.root.resolve('@edison/core/web')).toMatch(/packages[\\/]core[\\/]dist[\\/]web[\\/]index\.js$/);
    expect(workspaceRequires.root.resolve('trading-bot-web-server')).toMatch(/packages[\\/]web-server[\\/]dist[\\/]index\.js$/);

    for (const workspaceRequire of Object.values(workspaceRequires)) {
      expect(workspaceRequire.resolve('@edison/contracts')).toMatch(/packages[\\/]contracts[\\/]dist[\\/]index\.js$/);
      expect(workspaceRequire.resolve('@edison/contracts/web-api')).toMatch(/packages[\\/]contracts[\\/]dist[\\/]web-api\.js$/);
      expect(workspaceRequire.resolve('@edison/contracts/runtime-api')).toMatch(/packages[\\/]contracts[\\/]dist[\\/]runtime-api\.js$/);
    }
  });

  test('contracts keeps the root barrel as a compatibility surface while consumer guidance points to focused subpaths', () => {
    const contractsRootEntry = readTextFile('packages/contracts/src/index.ts');
    const contractsRootTypes = readTextFile('packages/contracts/dist/index.d.ts');
    const runtimeApiTypes = readTextFile('packages/contracts/dist/runtime-api.d.ts');
    const readme = readTextFile('README.md');
    const architectureQuickStart = readTextFile('ARCHITECTURE_QUICK_START.md');

    expect(contractsRootEntry).toContain('Compatibility root barrel.');
    expect(contractsRootEntry).toContain('@deprecated');
    expect(contractsRootEntry).toContain('@edison/contracts/web-api');
    expect(contractsRootEntry).toContain('@edison/contracts/runtime-api');
    expect(contractsRootTypes).toContain("export * from './web-api';");
    expect(contractsRootTypes).toContain("export * from './runtime-api';");
    expect(runtimeApiTypes).toContain('export declare const CONFIG_SCHEMA_SECTION_KEYS');
    expect(runtimeApiTypes).toContain('export type ConfigBackupsResponsePayload = ConfigBackupCollectionPayload;');
    expect(runtimeApiTypes).toContain('export type ConfigHistoryResponsePayload = ConfigBackupCollectionPayload;');
    expect(runtimeApiTypes).toContain('export interface ConfigMutationRequestPayload');
    expect(runtimeApiTypes).toContain('export type ConfigValidationRequestPayload = ConfigMutationRequestPayload;');
    expect(runtimeApiTypes).toContain('export interface ConfigValidationIssuePayload');
    expect(runtimeApiTypes).toContain('export interface ConfigValidationSummaryPayload');
    expect(runtimeApiTypes).toContain('export interface ConfigMutationPreviewEntryPayload');
    expect(runtimeApiTypes).toContain('export interface ConfigMutationPreviewSummaryPayload');
    expect(runtimeApiTypes).toContain('export interface ConfigMutationPreviewPayload');
    expect(runtimeApiTypes).toContain('restoredBackup: ConfigBackupPayload;');
    expect(runtimeApiTypes).toContain('remainingBackups: number;');
    expect(runtimeApiTypes).toContain('preview: ConfigMutationPreviewPayload;');
    expect(runtimeApiTypes).toContain('validation: ConfigValidationResponsePayload;');
    expect(createRequire(path.resolve(process.cwd(), 'package.json')).resolve('@edison/contracts')).toMatch(
      /packages[\\/]contracts[\\/]dist[\\/]index\.js$/,
    );
    expect(readme).toContain('Prefer `@edison/contracts/web-api` or `@edison/contracts/runtime-api` over the broad `@edison/contracts` barrel');
    expect(architectureQuickStart).toContain('Consumers should never import from `packages/contracts/src`');
  });

  test('core package consumers use publishable contract subpaths instead of source aliases or the broad root barrel', () => {
    const guardrailFiles = [
      ...collectFiles('packages/core/src/api', ['.ts']),
      ...collectFiles('packages/core/src/factories', ['.ts']),
      ...collectFiles('packages/core/src/interfaces', ['.ts']),
      ...collectFiles('packages/core/src/web', ['.ts']),
      ...collectFiles('packages/core/src/types/web-api', ['.ts']),
    ];

    assertNoContractsBoundaryViolations(guardrailFiles);
  });

  test('web-server consumers use publishable contract subpaths and keep generated artifacts out of src', () => {
    const guardrailFiles = [
      ...collectFiles('packages/web-server/src', ['.ts']),
      ...collectFiles('packages/web-server/tests', ['.ts']),
    ];

    assertNoContractsBoundaryViolations(guardrailFiles);
    assertNoGeneratedSourceArtifacts('packages/web-server/src');
  });

  test('web-client consumers use publishable contract subpaths and keep strategy types on the shared contract surface', () => {
    const webClientTsconfig = readTextFile('packages/web-client/tsconfig.json');
    const webClientViteConfig = readTextFile('packages/web-client/vite.config.ts');
    const guardrailFiles = [
      ...collectFiles('packages/web-client/src', ['.ts', '.tsx']),
      ...collectFiles('packages/web-client/src/__tests__', ['.ts', '.tsx']),
    ];
    const strategyToggles = readTextFile('packages/web-client/src/components/control/StrategyToggles.tsx');

    expect(webClientTsconfig).not.toContain('../contracts/src');
    expect(webClientTsconfig).not.toContain('"paths"');
    expect(webClientViteConfig).not.toContain('../contracts/src');
    expect(fs.existsSync(path.resolve(process.cwd(), 'packages/web-client/src/types/index.ts'))).toBe(false);
    expect(fs.existsSync(path.resolve(process.cwd(), 'packages/web-client/src/types/strategy.ts'))).toBe(false);
    expect(strategyToggles).toContain('StrategyConfigSummary');
    assertNoContractsBoundaryViolations(guardrailFiles);
  });

  test('workspace package source trees stay free of generated js and declaration artifacts', () => {
    assertNoGeneratedSourceArtifacts('packages/contracts/src');
    assertNoGeneratedSourceArtifacts('packages/core/src');
    assertNoGeneratedSourceArtifacts('packages/web-server/src');
    assertNoGeneratedSourceArtifacts('packages/web-client/src');
  });

  test('workspace package manifests depend on package names instead of sibling source or dist paths', () => {
    const rootPackage = readJsonFile<PackageJson>('package.json');
    const contractsPackage = readJsonFile<PackageJson>('packages/contracts/package.json');
    const corePackage = readJsonFile<PackageJson>('packages/core/package.json');
    const webServerPackage = readJsonFile<PackageJson>('packages/web-server/package.json');
    const webClientPackage = readJsonFile<PackageJson>('packages/web-client/package.json');
    const manifestPayloads = [rootPackage, contractsPackage, corePackage, webServerPackage, webClientPackage];

    expect(corePackage.dependencies?.['@edison/contracts']).toBe('*');
    expect(webServerPackage.dependencies?.['@edison/contracts']).toBe('*');
    expect(webClientPackage.dependencies?.['@edison/contracts']).toBe('*');
    expect(rootPackage.dependencies?.['@edison/contracts']).toBe('*');
    expect(rootPackage.dependencies?.['trading-bot-web-server']).toBe('*');

    for (const manifest of manifestPayloads) {
      const serializedDependencies = JSON.stringify({
        dependencies: manifest.dependencies ?? {},
        devDependencies: manifest.devDependencies ?? {},
      });

      expect(serializedDependencies).not.toContain('packages/contracts/src');
      expect(serializedDependencies).not.toContain('packages/contracts/dist');
      expect(serializedDependencies).not.toContain('packages/core/src');
      expect(serializedDependencies).not.toContain('packages/web-server/src');
      expect(serializedDependencies).not.toContain('file:packages/');
    }

    expect(contractsPackage.dependencies ?? {}).not.toHaveProperty('@edison/core');
    expect(contractsPackage.dependencies ?? {}).not.toHaveProperty('trading-bot-web-server');
    expect(contractsPackage.dependencies ?? {}).not.toHaveProperty('trading-bot-web-client');
  });

  test('web-server consumes shared contract types directly instead of a local api.types barrel', () => {
    const botBridgeService = readTextFile('packages/web-server/src/services/bot-bridge.service.ts');
    const configRoutes = readTextFile('packages/web-server/src/routes/config.routes.ts');
    const configRouteContracts = readTextFile('packages/web-server/src/routes/config-route-contracts.ts');
    const configService = readTextFile('packages/web-server/src/services/config-management.service.ts');
    const dataRoutes = readTextFile('packages/web-server/src/routes/data.routes.ts');
    const swaggerConfig = readTextFile('packages/web-server/src/swagger.config.ts');
    const websocketServer = readTextFile('packages/web-server/src/websocket/ws-server.ts');

    expect(fs.existsSync(path.resolve(process.cwd(), 'packages/web-server/src/types/api.types.ts'))).toBe(false);
    expect(botBridgeService).toContain("@edison/contracts/runtime-api");
    expect(botBridgeService).not.toContain('../types/api.types.js');
    expect(configRoutes).toContain("./config-route-contracts");
    expect(configRoutes).toContain('createConfigBackupCollection');
    expect(configRoutes).toContain('createConfigMutationPreviewResponse');
    expect(configRoutes).toContain('createConfigUpdateResponse');
    expect(configRoutes).toContain('createConfigValidationResponse');
    expect(configRoutes).toContain('parseConfigMutationRequest');
    expect(configRouteContracts).toContain('ConfigBackupCollectionPayload');
    expect(configRouteContracts).toContain('ConfigMutationRequestPayload');
    expect(configRouteContracts).toContain('parseValidationConfigRequest');
    expect(configRouteContracts).toContain('ConfigMutationPreviewPayload');
    expect(configRouteContracts).toContain('ConfigValidationResponsePayload');
    expect(configService).toContain('CONFIG_SCHEMA_METADATA');
    expect(dataRoutes).toContain("@edison/contracts/runtime-api");
    expect(dataRoutes).not.toContain('../types/api.types.js');
    expect(swaggerConfig).toContain('createConfigRouteSuccessResponse');
    expect(swaggerConfig).toContain('createConfigBackupCollectionSchema');
    expect(swaggerConfig).toContain('createConfigMutationRequestPayloadSchema');
    expect(swaggerConfig).toContain('createConfigMutationRequestAliasSchema');
    expect(swaggerConfig).toContain('createConfigMutationPreviewPayloadSchema');
    expect(swaggerConfig).toContain('createConfigValidationPayloadSchema');
    expect(websocketServer).toContain("@edison/contracts/runtime-api");
    expect(websocketServer).not.toContain('../types/api.types.js');
  });

  test('web-client consumes shared contract types directly instead of local proxy barrels', () => {
    const apiService = readTextFile('packages/web-client/src/services/api.service.ts');
    const controlBootstrap = readTextFile('packages/web-client/src/services/control-config-bootstrap.ts');
    const websocketService = readTextFile('packages/web-client/src/services/websocket.service.ts');
    const controlPage = readTextFile('packages/web-client/src/pages/Control.tsx');
    const dashboardPage = readTextFile('packages/web-client/src/pages/Dashboard.tsx');
    const positionCard = readTextFile('packages/web-client/src/components/dashboard/PositionCard.tsx');
    const priceChart = readTextFile('packages/web-client/src/components/charts/PriceChart.tsx');
    const strategyToggles = readTextFile('packages/web-client/src/components/control/StrategyToggles.tsx');

    expect(fs.existsSync(path.resolve(process.cwd(), 'packages/web-client/src/types/api.ts'))).toBe(false);
    expect(fs.existsSync(path.resolve(process.cwd(), 'packages/web-client/src/types/websocket.ts'))).toBe(false);
    expect(apiService).toContain("@edison/contracts/runtime-api");
    expect(controlBootstrap).toContain("@edison/contracts/runtime-api");
    expect(controlBootstrap).toContain('configApi.getConfigSchema()');
    expect(controlBootstrap).toContain('configApi.getConfigBackups()');
    expect(controlBootstrap).toContain('configApi.getConfigHistory()');
    expect(controlBootstrap).toContain('restoreLatestControlBackup');
    expect(controlBootstrap).toContain('cleanupControlBackups');
    expect(controlBootstrap).not.toContain('import * as runtimeApiContracts');
    expect(apiService).not.toContain("from '../types'");
    expect(apiService).toContain('createConfigMutationRequest');
    expect(websocketService).toContain("@edison/contracts/runtime-api");
    expect(websocketService).not.toContain("from '../types'");
    expect(controlPage).toContain("from '../services/control-config-bootstrap'");
    expect(controlPage).toContain('refreshControlData');
    expect(readTextFile('packages/web-client/src/components/control/ConfigEditor.tsx')).toContain('configApi.validateConfig');
    expect(readTextFile('packages/web-client/src/components/control/ConfigEditor.tsx')).toContain('configApi.previewConfig');
    expect(readTextFile('packages/web-client/src/components/control/ConfigEditor.tsx')).toContain('ConfigMutationPreviewPayload');
    expect(readTextFile('packages/web-client/src/components/control/ConfigEditor.tsx')).toContain('ConfigValidationResponsePayload');
    expect(readTextFile('packages/web-client/src/components/control/ConfigEditor.tsx')).toContain('lastSavedConfigRef');
    expect(controlPage).toContain('buildRiskSummaryRows');
    expect(controlPage).toContain('ControlConfigPayload');
    expect(controlPage).toContain('Restore Latest Backup');
    expect(controlPage).toContain('Cleanup Old Backups');
    expect(controlPage).not.toContain('FALLBACK_CONTROL_CONFIG');
    expect(dashboardPage).toContain("@edison/contracts/runtime-api");
    expect(positionCard).toContain("@edison/contracts/runtime-api");
    expect(priceChart).toContain("@edison/contracts/runtime-api");
    expect(strategyToggles).toContain('StrategyConfigSummary');
  });
});
