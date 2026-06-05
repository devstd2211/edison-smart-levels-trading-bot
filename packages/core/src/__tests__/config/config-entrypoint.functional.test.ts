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
      path.resolve(__dirname, '..', '..', 'config', 'index.ts'),
      'utf8',
    );
    const configLoaderContractsSource = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'config', 'config-loader-contracts.ts'),
      'utf8',
    );
    const configPipelineSource = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'config', 'config-pipeline.ts'),
      'utf8',
    );

    expect(Object.keys(configEntrypointModule)).not.toContain('ConfigPipelineBaseConfigLoader');
    expect(Object.keys(configEntrypointModule)).not.toContain('ConfigPipelineConfigValidator');
    expect(configLoaderContractsSource).toContain('export type ConfigPipelineBaseConfigLoader = () => Config;');
    expect(configLoaderContractsSource).toContain(
      'export type ConfigPipelineConfigValidator = (config: Config) => void;',
    );
    expect(configLoaderContractsSource).toContain('export type ConfigPipelineLoader = Readonly<{');
    expect(configEntrypointSource).toContain('ConfigPipelineBaseConfigLoader,');
    expect(configEntrypointSource).toContain('ConfigPipelineConfigValidator,');
    expect(configEntrypointSource).toContain("} from './config-loader-contracts';");
    expect(configEntrypointSource).toContain(
      'export type { ConfigPipelineBaseConfigLoader, ConfigPipelineConfigValidator, ConfigPipelineLoader };',
    );
    expect(configPipelineSource).not.toContain('export type ConfigPipelineBaseConfigLoader');
    expect(configPipelineSource).not.toContain('export type { ConfigPipelineLoader };');
  });
});
