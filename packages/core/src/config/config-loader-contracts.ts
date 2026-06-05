import type { Config } from '../types/legacy';

export type ConfigPipelineBaseConfigLoader = () => Config;
export type ConfigPipelineConfigValidator = (config: Config) => void;

export type ConfigPipelineLoader = Readonly<{
  loadBaseConfig: ConfigPipelineBaseConfigLoader;
  validate: ConfigPipelineConfigValidator;
}>;
