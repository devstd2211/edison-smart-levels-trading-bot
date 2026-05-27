import * as configEntrypointModule from '../../config/index';
import {
  CONFIG_ENTRYPOINT_EXPORT_NAMES,
  applyStrategyConfig,
  getConfig,
  loadConfigPipeline,
  loadOptionalRuntimeConfig,
  loadRuntimeConfig,
  loadValidatedConfig,
} from '../../config/index';
import * as fs from 'fs';
import * as path from 'path';

describe('config entrypoint boundary', () => {
  test('keeps the dedicated config entrypoint focused on runtime-config helpers', () => {
    expect(Object.keys(configEntrypointModule).sort()).toEqual(
      [...CONFIG_ENTRYPOINT_EXPORT_NAMES].sort(),
    );
    expect([...CONFIG_ENTRYPOINT_EXPORT_NAMES]).toEqual([
      'CONFIG_ENTRYPOINT_EXPORT_NAMES',
      'applyStrategyConfig',
      'getConfig',
      'loadConfigPipeline',
      'loadOptionalRuntimeConfig',
      'loadRuntimeConfig',
      'loadValidatedConfig',
    ]);
    expect(Object.keys(configEntrypointModule)).not.toContain('ConfigPipelineLoader');
  });

  test('re-exports the public runtime-config helper functions from one dedicated barrel', () => {
    expect(typeof getConfig).toBe('function');
    expect(typeof applyStrategyConfig).toBe('function');
    expect(typeof loadConfigPipeline).toBe('function');
    expect(typeof loadRuntimeConfig).toBe('function');
    expect(typeof loadOptionalRuntimeConfig).toBe('function');
    expect(typeof loadValidatedConfig).toBe('function');
  });

  test('keeps loader contract aliases type-only on the dedicated config barrel', () => {
    const configEntrypointSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src', 'config', 'index.ts'),
      'utf8',
    );

    expect(Object.keys(configEntrypointModule)).not.toContain('ConfigPipelineBaseConfigLoader');
    expect(Object.keys(configEntrypointModule)).not.toContain('ConfigPipelineConfigValidator');
    expect(configEntrypointSource).toContain('ConfigPipelineBaseConfigLoader,');
    expect(configEntrypointSource).toContain('ConfigPipelineConfigValidator,');
    expect(configEntrypointSource).toContain("} from './config-pipeline';");
    expect(configEntrypointSource).toContain(
      'export type { ConfigPipelineBaseConfigLoader, ConfigPipelineConfigValidator, ConfigPipelineLoader };',
    );
    expect(configEntrypointSource).not.toContain("from '../core'");
  });
});
