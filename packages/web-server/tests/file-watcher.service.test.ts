import { FileWatcherService } from '../src/services/file-watcher.service';

describe('FileWatcherService', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('routes change events through the configured watcher targets instead of hard-coded filenames', async () => {
    jest.useFakeTimers();

    const fileWatcher = new FileWatcherService(
      './data/custom-journal.json',
      './data/custom-sessions.json',
    );
    const journalListener = jest.fn();
    const sessionListener = jest.fn();

    jest.spyOn(fileWatcher, 'readJournal').mockResolvedValue([{ id: 'trade-1' }] as never);
    jest.spyOn(fileWatcher, 'readSessions').mockResolvedValue([{ sessionId: 'session-1' }] as never);
    fileWatcher.on('journal:updated', journalListener);
    fileWatcher.on('session:updated', sessionListener);

    (fileWatcher as unknown as { handleFileChange: (filePath: string) => void })
      .handleFileChange('/tmp/runtime/custom-journal.json');
    await jest.runOnlyPendingTimersAsync();

    expect(journalListener).toHaveBeenCalledWith([{ id: 'trade-1' }]);

    (fileWatcher as unknown as { handleFileChange: (filePath: string) => void })
      .handleFileChange('/tmp/runtime/custom-sessions.json');
    await jest.runOnlyPendingTimersAsync();

    expect(sessionListener).toHaveBeenCalledWith([{ sessionId: 'session-1' }]);
  });
});
