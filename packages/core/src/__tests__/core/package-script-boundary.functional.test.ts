import * as fs from 'fs';
import { createRequire } from 'module';
import * as path from 'path';

type PackageJson = {
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
    const workspaceRequire = createRequire(path.resolve(process.cwd(), 'package.json'));

    expect(workspaceRequire.resolve('@edison/contracts')).toMatch(/packages[\\/]contracts[\\/]dist[\\/]index\.js$/);
    expect(workspaceRequire.resolve('@edison/contracts/web-api')).toMatch(/packages[\\/]contracts[\\/]dist[\\/]web-api\.js$/);
    expect(workspaceRequire.resolve('@edison/contracts/runtime-api')).toMatch(/packages[\\/]contracts[\\/]dist[\\/]runtime-api\.js$/);
    expect(workspaceRequire.resolve('@edison/core')).toMatch(/packages[\\/]core[\\/]dist[\\/]index\.js$/);
    expect(workspaceRequire.resolve('@edison/core/core')).toMatch(/packages[\\/]core[\\/]dist[\\/]core[\\/]index\.js$/);
    expect(workspaceRequire.resolve('@edison/core/web')).toMatch(/packages[\\/]core[\\/]dist[\\/]web[\\/]index\.js$/);
    expect(workspaceRequire.resolve('trading-bot-web-server')).toMatch(/packages[\\/]web-server[\\/]dist[\\/]index\.js$/);
  });

  test('workspace consumers use publishable package surfaces instead of source aliases or broad contracts barrels', () => {
    const webClientTsconfig = readTextFile('packages/web-client/tsconfig.json');
    const webClientViteConfig = readTextFile('packages/web-client/vite.config.ts');
    const guardrailFiles = [
      ...collectFiles('packages/core/src/api', ['.ts']),
      ...collectFiles('packages/core/src/factories', ['.ts']),
      ...collectFiles('packages/core/src/interfaces', ['.ts']),
      ...collectFiles('packages/core/src/web', ['.ts']),
      ...collectFiles('packages/core/src/types/web-api', ['.ts']),
      ...collectFiles('packages/web-server/src', ['.ts']),
      ...collectFiles('packages/web-client/src', ['.ts', '.tsx']),
    ];
    const readme = readTextFile('README.md');
    const architectureQuickStart = readTextFile('ARCHITECTURE_QUICK_START.md');

    expect(webClientTsconfig).not.toContain('../contracts/src');
    expect(webClientTsconfig).not.toContain('"paths"');
    expect(webClientViteConfig).not.toContain('../contracts/src');

    for (const guardrailFile of guardrailFiles) {
      const content = readTextFile(guardrailFile);
      expect(content).not.toContain('../contracts/src');
      expect(content).not.toContain('packages/contracts/src');
      expect(content).not.toContain("from '@edison/contracts';");
      expect(content).not.toContain('from "@edison/contracts";');
    }

    expect(readme).toContain('never reach into `packages/contracts/src`');
    expect(architectureQuickStart).toContain('Consumers should never import from `packages/contracts/src`');
  });

  test('web-server consumes shared contract types directly instead of a local api.types barrel', () => {
    const botBridgeService = readTextFile('packages/web-server/src/services/bot-bridge.service.ts');
    const dataRoutes = readTextFile('packages/web-server/src/routes/data.routes.ts');
    const websocketServer = readTextFile('packages/web-server/src/websocket/ws-server.ts');

    expect(fs.existsSync(path.resolve(process.cwd(), 'packages/web-server/src/types/api.types.ts'))).toBe(false);
    expect(botBridgeService).toContain("@edison/contracts/runtime-api");
    expect(botBridgeService).not.toContain('../types/api.types.js');
    expect(dataRoutes).toContain("@edison/contracts/runtime-api");
    expect(dataRoutes).not.toContain('../types/api.types.js');
    expect(websocketServer).toContain("@edison/contracts/runtime-api");
    expect(websocketServer).not.toContain('../types/api.types.js');
  });
});
