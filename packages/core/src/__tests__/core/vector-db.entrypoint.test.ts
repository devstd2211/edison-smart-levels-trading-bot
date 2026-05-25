import * as path from 'path';
import {
  createVectorDbCommandRuntime,
  createVectorDbRuntimePaths,
  createVectorDbCliRuntime,
  executeVectorDbCommand,
  handleVectorDbCommand,
  parseVectorDbCommand,
  runVectorDbCli,
} from '../../vector-db/cli';
import { runVectorDbMain } from '../../vector-db';

describe('vector-db entrypoint helpers', () => {
  test('createVectorDbRuntimePaths resolves the db and index files from the project root', () => {
    expect(createVectorDbRuntimePaths('D:/repo')).toEqual({
      projectPath: 'D:/repo',
      dbPath: path.join('D:/repo', 'vector-db.sqlite'),
      indexPath: path.join('D:/repo', '.vector-db/index.json'),
    });
  });

  test('parseVectorDbCommand keeps keyword mode and explicit search limits separate from the query', () => {
    expect(parseVectorDbCommand(['search', 'ema', 'cross', '--keyword', '25'])).toEqual({
      kind: 'search',
      query: 'ema cross',
      limit: 25,
      strategy: 'keyword',
    });
  });

  test('parseVectorDbCommand rejects missing command arguments with explicit messages', () => {
    expect(() => parseVectorDbCommand(['search'])).toThrow('Missing search query');
    expect(() => parseVectorDbCommand(['category'])).toThrow('Missing category name');
    expect(() => parseVectorDbCommand(['get'])).toThrow('Missing document ID');
  });

  test('runVectorDbCli shows help without creating a runtime service when no args are provided', async () => {
    const output = {
      log: jest.fn(),
      error: jest.fn(),
    };
    const serviceFactory = jest.fn();

    await runVectorDbCli([], { console: output, serviceFactory });

    expect(serviceFactory).not.toHaveBeenCalled();
    expect(output.log).toHaveBeenCalled();
    expect(output.error).not.toHaveBeenCalled();
  });

  test('runVectorDbCli routes search commands through the injected service', async () => {
    const output = {
      log: jest.fn(),
      error: jest.fn(),
    };
    const service = {
      init: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue({
        documents: [],
        executionTimeMs: 3,
      }),
      keywordSearch: jest.fn(),
      searchByCategory: jest.fn(),
      getStats: jest.fn(),
      findRelated: jest.fn(),
      autocomplete: jest.fn(),
      reindex: jest.fn(),
      getDocument: jest.fn(),
      exportIndex: jest.fn(),
    };

    await runVectorDbCli(['search', 'momentum', 'scan'], { console: output, service });

    expect(service.init).toHaveBeenCalledTimes(1);
    expect(service.query).toHaveBeenCalledWith('momentum scan', 10);
    expect(service.keywordSearch).not.toHaveBeenCalled();
  });

  test('runVectorDbCli writes export output with a deterministic fallback filename', async () => {
    const output = {
      log: jest.fn(),
      error: jest.fn(),
    };
    const fileSystem = {
      writeFileSync: jest.fn(),
    };
    const service = {
      init: jest.fn().mockResolvedValue(undefined),
      query: jest.fn(),
      keywordSearch: jest.fn(),
      searchByCategory: jest.fn(),
      getStats: jest.fn(),
      findRelated: jest.fn(),
      autocomplete: jest.fn(),
      reindex: jest.fn(),
      getDocument: jest.fn(),
      exportIndex: jest.fn().mockResolvedValue('{"ok":true}'),
    };

    await runVectorDbCli(['export'], {
      console: output,
      fileSystem,
      now: () => 42,
      service,
    });

    expect(fileSystem.writeFileSync).toHaveBeenCalledWith(
      'vector-db-export-42.json',
      '{"ok":true}',
    );
  });

  test('createVectorDbCliRuntime creates the service from the resolved runtime paths', () => {
    const output = {
      log: jest.fn(),
      error: jest.fn(),
    };
    const service = {
      init: jest.fn(),
      query: jest.fn(),
      keywordSearch: jest.fn(),
      searchByCategory: jest.fn(),
      getStats: jest.fn(),
      findRelated: jest.fn(),
      autocomplete: jest.fn(),
      reindex: jest.fn(),
      getDocument: jest.fn(),
      exportIndex: jest.fn(),
    };
    const serviceFactory = jest.fn().mockReturnValue(service);

    const runtime = createVectorDbCliRuntime({
      console: output,
      projectPath: 'D:/repo',
      serviceFactory,
    });

    expect(serviceFactory).toHaveBeenCalledWith({
      projectPath: 'D:/repo',
      dbPath: path.join('D:/repo', 'vector-db.sqlite'),
      indexPath: path.join('D:/repo', '.vector-db/index.json'),
    });
    expect(runtime.output).toBe(output);
    expect(runtime.service).toBe(service);
  });

  test('createVectorDbCommandRuntime keeps command parsing and cli construction in one explicit runtime step', () => {
    const output = {
      log: jest.fn(),
      error: jest.fn(),
    };
    const service = {
      init: jest.fn(),
      query: jest.fn(),
      keywordSearch: jest.fn(),
      searchByCategory: jest.fn(),
      getStats: jest.fn(),
      findRelated: jest.fn(),
      autocomplete: jest.fn(),
      reindex: jest.fn(),
      getDocument: jest.fn(),
      exportIndex: jest.fn(),
    };

    const runtime = createVectorDbCommandRuntime(['stats'], {
      console: output,
      service,
    });

    expect(runtime.command).toEqual({ kind: 'stats' });
    expect(runtime.cli).toBeDefined();
    expect(runtime.output).toBe(output);
    expect(runtime.processRef).toBe(process);
  });

  test('executeVectorDbCommand dispatches the parsed command to the matching cli method', async () => {
    const cli = {
      autocomplete: jest.fn(),
      category: jest.fn(),
      export: jest.fn(),
      getDocument: jest.fn(),
      init: jest.fn(),
      related: jest.fn(),
      reindex: jest.fn(),
      search: jest.fn(),
      stats: jest.fn().mockResolvedValue(undefined),
    };

    await executeVectorDbCommand({ kind: 'stats' }, cli as never);

    expect(cli.stats).toHaveBeenCalledTimes(1);
  });

  test('runVectorDbCli exits with help for unknown commands', async () => {
    const output = {
      log: jest.fn(),
      error: jest.fn(),
    };
    const processRef = {
      exit: jest.fn(),
    };

    await runVectorDbCli(['wat'], { console: output, process: processRef });

    expect(output.error).toHaveBeenCalledWith(expect.stringContaining('Unknown command: wat'));
    expect(processRef.exit).toHaveBeenCalledWith(1);
  });

  test('handleVectorDbCommand routes help and unknown commands without building runtime services twice', async () => {
    const output = {
      log: jest.fn(),
      error: jest.fn(),
    };
    const processRef = {
      exit: jest.fn(),
    };
    const helpRenderer = jest.fn();
    const cli = {
      autocomplete: jest.fn(),
      category: jest.fn(),
      export: jest.fn(),
      getDocument: jest.fn(),
      init: jest.fn(),
      related: jest.fn(),
      reindex: jest.fn(),
      search: jest.fn(),
      stats: jest.fn(),
    };

    await handleVectorDbCommand(
      {
        command: { kind: 'help' },
        cli: cli as never,
        output,
        processRef,
      },
      helpRenderer,
    );
    await handleVectorDbCommand(
      {
        command: { kind: 'unknown', command: 'wat' },
        cli: cli as never,
        output,
        processRef,
      },
      helpRenderer,
    );

    expect(helpRenderer).toHaveBeenCalledTimes(2);
    expect(output.error).toHaveBeenCalledWith(expect.stringContaining('Unknown command: wat'));
    expect(processRef.exit).toHaveBeenCalledWith(1);
  });

  test('runVectorDbMain forwards argv slices to the shared cli runner', async () => {
    const cliRunner = jest.fn().mockResolvedValue(undefined);

    await runVectorDbMain(['search', 'btc'], cliRunner);

    expect(cliRunner).toHaveBeenCalledWith(['search', 'btc']);
  });
});
