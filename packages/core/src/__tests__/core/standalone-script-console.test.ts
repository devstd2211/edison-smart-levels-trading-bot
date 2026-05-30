import {
  printStandaloneScriptBanner,
  printStandaloneScriptFooter,
  printStandaloneScriptMessageBlock,
  printStandaloneScriptLines,
} from '../../standalone-script-console';

describe('standalone-script console helpers', () => {
  test('printStandaloneScriptBanner keeps the shared standalone divider format stable', () => {
    const output = {
      log: jest.fn(),
    };

    printStandaloneScriptBanner(output, 'Runtime Check', '[ok]');

    expect(output.log.mock.calls).toEqual([
      ['\n========================================'],
      ['[ok] Runtime Check'],
      ['========================================\n'],
    ]);
  });

  test('printStandaloneScriptLines preserves line order across banner/footer helpers', () => {
    const output = {
      log: jest.fn(),
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

  test('printStandaloneScriptFooter reuses the shared footer line builder', () => {
    const output = {
      log: jest.fn(),
    };

    printStandaloneScriptFooter(output, 'Finished successfully');

    expect(output.log.mock.calls).toEqual([
      ['Finished successfully\n'],
    ]);
  });

  test('printStandaloneScriptMessageBlock reuses the shared bounded section format for highlighted values', () => {
    const output = {
      log: jest.fn(),
    };

    printStandaloneScriptMessageBlock(output, 'USDT Balance: 123.45', '[money]');

    expect(output.log.mock.calls).toEqual([
      ['\n========================================'],
      ['[money] USDT Balance: 123.45'],
      ['========================================\n'],
    ]);
  });
});
