import * as fs from 'fs';
import * as path from 'path';

type PackageJson = {
  scripts?: Record<string, string>;
};

type TsConfigReferences = {
  references?: Array<{ path: string }>;
};

function readJsonFile<T>(relativePath: string): T {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  return JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as T;
}

describe('package script boundary', () => {
  test('root and core scripts delegate through the CLI composition root and workspace refs include all packages', () => {
    const rootPackage = readJsonFile<PackageJson>('package.json');
    const corePackage = readJsonFile<PackageJson>('packages/core/package.json');
    const tsconfigReferences = readJsonFile<TsConfigReferences>('tsconfig.references.json');

    expect(rootPackage.scripts).toMatchObject({
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
});
