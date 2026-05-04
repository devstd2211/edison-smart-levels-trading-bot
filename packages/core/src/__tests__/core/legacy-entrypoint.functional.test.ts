const mockMain = jest.fn();

jest.mock('../../cli', () => ({
  main: mockMain,
}));

import { main } from '../../index';

describe('legacy entrypoint wrapper', () => {
  beforeEach(() => {
    mockMain.mockReset();
  });

  test('importing the wrapper exports the CLI entrypoint without auto-starting it', () => {
    expect(main).toBe(mockMain);
    expect(mockMain).not.toHaveBeenCalled();
  });
});
