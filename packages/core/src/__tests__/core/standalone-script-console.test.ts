import {
  createStandaloneBannerLines,
  createStandaloneFooterLine,
  printStandaloneScriptBanner,
  printStandaloneScriptFooter,
  printStandaloneScriptLines,
} from '../../standalone-script-console';

describe('standalone-script console helpers', () => {
  test('createStandaloneBannerLines keeps the shared standalone divider format stable', () => {
    expect(createStandaloneBannerLines('Runtime Check', '[ok]')).toEqual([
      '\n========================================',
      '[ok] Runtime Check',
      '========================================\n',
    ]);
  });

  test('createStandaloneFooterLine appends the trailing newline once', () => {
    expect(createStandaloneFooterLine('Finished successfully')).toBe(
      'Finished successfully\n',
    );
  });

  test('printStandaloneScriptLines preserves line order across banner/footer helpers', () => {
    const output = {
      log: jest.fn(),
      error: jest.fn(),
    };

    printStandaloneScriptLines(output, ['first', 'second']);
    printStandaloneScriptBanner(output, 'Runtime Check', '[ok]');
    printStandaloneScriptFooter(output, 'Finished successfully');

    expect(output.log.mock.calls).toEqual([
      ['first'],
      ['second'],
      ['\n========================================'],
      ['[ok] Runtime Check'],
      ['========================================\n'],
      ['Finished successfully\n'],
    ]);
  });
});
