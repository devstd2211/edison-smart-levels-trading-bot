jest.mock('../../config', () => ({
  getConfig: jest.fn(),
}));

jest.mock('../../services/config-validator.service', () => ({
  ConfigValidatorService: {
    validateAtStartup: jest.fn(),
  },
}));

import { getConfig } from '../../config';
import { ConfigValidatorService } from '../../services/config-validator.service';
import { loadRuntimeConfig } from '../../config/config-pipeline';
import { createMinimalLifecycleConfig } from '../helpers/service-lifecycle-test.utils';

describe('config pipeline composition root', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('loadRuntimeConfig loads base config, applies the pipeline, and validates the result', async () => {
    const config = createMinimalLifecycleConfig();
    (getConfig as jest.Mock).mockReturnValue(config);

    const result = await loadRuntimeConfig();

    expect(getConfig).toHaveBeenCalledTimes(1);
    expect(ConfigValidatorService.validateAtStartup).toHaveBeenCalledWith(result);
    expect(result).toBe(config);
  });
});
