import * as fs from 'fs';
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
  });

  test('workspace consumers use publishable package surfaces instead of contracts source aliases', () => {
    const webClientTsconfig = readTextFile('packages/web-client/tsconfig.json');
    const webClientViteConfig = readTextFile('packages/web-client/vite.config.ts');
    const webClientApiService = readTextFile('packages/web-client/src/services/api.service.ts');
    const webServerDataRoutes = readTextFile('packages/web-server/src/routes/data.routes.ts');
    const coreWebEntrypoint = readTextFile('packages/core/src/web/index.ts');

    expect(webClientTsconfig).not.toContain('../contracts/src');
    expect(webClientTsconfig).not.toContain('"paths"');
    expect(webClientViteConfig).not.toContain('../contracts/src');

    expect(webClientApiService).toContain("@edison/contracts/runtime-api");
    expect(webClientApiService).toContain("@edison/contracts/web-api");
    expect(webClientApiService).not.toContain("from '@edison/contracts';");

    expect(webServerDataRoutes).toContain("@edison/contracts/runtime-api");
    expect(webServerDataRoutes).toContain("@edison/contracts/web-api");
    expect(webServerDataRoutes).not.toContain("from '@edison/contracts';");

    expect(coreWebEntrypoint).toContain("@edison/contracts/web-api");
    expect(coreWebEntrypoint).not.toContain("from '@edison/contracts';");
  });
});
