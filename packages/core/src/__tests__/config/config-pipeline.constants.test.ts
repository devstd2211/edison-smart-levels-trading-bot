import {
  CONFIG_PIPELINE_ANALYZER_PREVIEW_LIMIT,
  CONFIG_PIPELINE_ANALYZER_PREVIEW_WEIGHT_PRECISION,
  CONFIG_PIPELINE_ANALYZER_WEIGHT_GROUP_PRECISION,
  CONFIG_PIPELINE_SEPARATOR_LENGTH,
} from '../../config/config-pipeline.constants';

describe('config pipeline constants', () => {
  test('separator length matches the expected display width', () => {
    expect(CONFIG_PIPELINE_SEPARATOR_LENGTH).toBe(80);
  });

  test('analyzer weight group precision formats to one decimal place', () => {
    expect(CONFIG_PIPELINE_ANALYZER_WEIGHT_GROUP_PRECISION).toBe(1);
  });

  test('analyzer preview limit caps the top-N list at five entries', () => {
    expect(CONFIG_PIPELINE_ANALYZER_PREVIEW_LIMIT).toBe(5);
  });

  test('analyzer preview weight precision formats to two decimal places', () => {
    expect(CONFIG_PIPELINE_ANALYZER_PREVIEW_WEIGHT_PRECISION).toBe(2);
  });
});
