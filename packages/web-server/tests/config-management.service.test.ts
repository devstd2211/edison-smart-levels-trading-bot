import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { ConfigManagementService } from '../src/services/config-management.service';

describe('ConfigManagementService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('creates distinct backup files for writes that share the same timestamp', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'edison-config-service-'));
    const configPath = path.join(tempDir, 'config.json');
    const firstConfig = {
      trading: { leverage: 5 },
      risk: { maxLeverage: 5 },
    };
    const secondConfig = {
      trading: { leverage: 4 },
      risk: { maxLeverage: 4 },
    };
    const thirdConfig = {
      trading: { leverage: 3 },
      risk: { maxLeverage: 3 },
    };
    const fixedIsoTimestamp = '2026-06-04T12:00:00.000Z';

    await fs.writeFile(configPath, JSON.stringify(firstConfig, null, 2), 'utf-8');

    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(fixedIsoTimestamp);

    const service = new ConfigManagementService(configPath);
    const firstWrite = await service.write(secondConfig);
    const secondWrite = await service.write(thirdConfig);
    const backups = await service.getBackups();

    expect(firstWrite.backupPath).not.toBe(secondWrite.backupPath);
    await expect(fs.readFile(firstWrite.backupPath, 'utf-8')).resolves.toBe(
      JSON.stringify(firstConfig, null, 2),
    );
    await expect(fs.readFile(secondWrite.backupPath, 'utf-8')).resolves.toBe(
      JSON.stringify(secondConfig, null, 2),
    );
    expect(backups).toHaveLength(2);
  });

  test('writes backups from the same config snapshot used for preview and validation', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'edison-config-service-'));
    const configPath = path.join(tempDir, 'config.json');
    const currentConfig = {
      trading: { leverage: 5 },
      risk: { maxLeverage: 5 },
    };
    const externallyChangedConfig = {
      trading: { leverage: 9 },
      risk: { maxLeverage: 9 },
    };
    const nextConfig = {
      trading: { leverage: 3 },
      risk: { maxLeverage: 3 },
    };
    const originalReadFile = fs.readFile.bind(fs);
    let currentConfigReads = 0;

    await fs.writeFile(configPath, JSON.stringify(currentConfig, null, 2), 'utf-8');

    jest.spyOn(fs, 'readFile').mockImplementation(async (filePath, encoding) => {
      if (filePath === configPath) {
        currentConfigReads += 1;

        if (currentConfigReads === 1) {
          return JSON.stringify(currentConfig, null, 2);
        }

        return JSON.stringify(externallyChangedConfig, null, 2);
      }

      return originalReadFile(filePath, encoding as BufferEncoding);
    });

    const service = new ConfigManagementService(configPath);
    const result = await service.write(nextConfig);

    await expect(fs.readFile(result.backupPath, 'utf-8')).resolves.toBe(
      JSON.stringify(currentConfig, null, 2),
    );
    expect(result.preview.changes).toEqual([
      {
        path: 'risk.maxLeverage',
        kind: 'updated',
        previousValue: '5',
        nextValue: '3',
      },
      {
        path: 'trading.leverage',
        kind: 'updated',
        previousValue: '5',
        nextValue: '3',
      },
    ]);
  });
});
