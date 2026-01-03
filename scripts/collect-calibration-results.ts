#!/usr/bin/env node

/**
 * Collect Calibration Results
 *
 * Automatically collects calibration results from all strategy folders
 * and updates CALIBRATION_RESULTS.md with top recommendations
 */

import * as fs from 'fs';
import * as path from 'path';

const STRATEGIES = [
  { name: 'microwall', symbol: 'SUIUSDT' },
  { name: 'tickdelta', symbol: 'STRKUSDT' },
  { name: 'laddertp', symbol: 'HYPEUSDT' },
  { name: 'limitorder', symbol: 'ADAUSDT' },
  { name: 'orderflow', symbol: 'XLMUSDT' },
  { name: 'weight', symbol: 'APEXUSDT' },
];

const CALIBRATION_ROOT = path.join(__dirname, '..', '..', 'Edison - calibration');
const RESULTS_FILE = path.join(__dirname, '..', 'CALIBRATION_RESULTS.md');

interface CalibrationData {
  strategy: string;
  symbol: string;
  status: 'completed' | 'running' | 'pending';
  timestamp?: string;
  topResults?: Array<{
    rank: number;
    rrRatio: number;
    winRate: number;
    totalTrades: number;
    params: Record<string, any>;
  }>;
  jsonPath?: string;
}

function getLatestJsonFile(strategyFolder: string): string | null {
  try {
    // Check root folder first (where calibration results are saved)
    const files = fs.readdirSync(strategyFolder)
      .filter(f => f.startsWith('calibration-') && f.endsWith('.json'))
      .sort()
      .reverse();

    if (files.length > 0) {
      return path.join(strategyFolder, files[0]);
    }

    // Fallback to logs folder
    const logsDir = path.join(strategyFolder, 'logs');
    if (!fs.existsSync(logsDir)) {
      return null;
    }

    const logFiles = fs.readdirSync(logsDir)
      .filter(f => f.startsWith('calibration-') && f.endsWith('.json'))
      .sort()
      .reverse();

    return logFiles.length > 0 ? path.join(logsDir, logFiles[0]) : null;
  } catch (e) {
    return null;
  }
}

function parseJsonResults(jsonPath: string): any {
  try {
    const content = fs.readFileSync(jsonPath, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    return null;
  }
}

function getStrategyStatus(strategyFolder: string): CalibrationData['status'] {
  try {
    // Check if .json file exists in root folder (completed)
    const files = fs.readdirSync(strategyFolder)
      .filter(f => f.startsWith('calibration-') && f.endsWith('.json'));

    if (files.length > 0) {
      const jsonFile = path.join(strategyFolder, files[0]);
      const data = parseJsonResults(jsonFile);
      if (data && data.length > 0) {
        return 'completed';
      }
    }

    // Check if any log files exist (running)
    const logsDir = path.join(strategyFolder, 'logs');
    if (fs.existsSync(logsDir)) {
      const logFiles = fs.readdirSync(logsDir);
      if (logFiles.length > 0) {
        return 'running';
      }
    }

    return 'pending';
  } catch (e) {
    return 'pending';
  }
}

function collectResults(): CalibrationData[] {
  const results: CalibrationData[] = [];

  for (const strategy of STRATEGIES) {
    const strategyFolder = path.join(CALIBRATION_ROOT, strategy.name);

    if (!fs.existsSync(strategyFolder)) {
      results.push({
        strategy: strategy.name,
        symbol: strategy.symbol,
        status: 'pending',
      });
      continue;
    }

    const status = getStrategyStatus(strategyFolder);
    const jsonPath = getLatestJsonFile(strategyFolder);

    const data: CalibrationData = {
      strategy: strategy.name,
      symbol: strategy.symbol,
      status,
      jsonPath: jsonPath || undefined,
    };

    if (jsonPath && status === 'completed') {
      const jsonData = parseJsonResults(jsonPath);
      if (jsonData && Array.isArray(jsonData)) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        data.timestamp = timestamp;

        // Extract top 3 results sorted by R/R ratio (already sorted by collection script)
        data.topResults = jsonData
          .slice(0, 3)
          .map((result, index) => ({
            rank: index + 1,
            rrRatio: result.metrics?.rrRatio || 0,
            winRate: (result.metrics?.winRate || 0) / 100, // Convert % to decimal
            totalTrades: result.metrics?.totalTrades || 0,
            params: result.params || {},
          }));
      }
    }

    results.push(data);
  }

  return results;
}

function formatResults(results: CalibrationData[]): string {
  console.log('\n📊 Calibration Results Summary\n');
  console.log('═'.repeat(80));

  for (const result of results) {
    const statusEmoji = {
      'completed': '✅',
      'running': '🔄',
      'pending': '⏳',
    }[result.status];

    console.log(`\n${statusEmoji} ${result.strategy.toUpperCase()} (${result.symbol})`);
    console.log(`   Status: ${result.status}`);

    if (result.topResults && result.topResults.length > 0) {
      console.log(`   Top Results:`);
      for (const top of result.topResults) {
        console.log(`     ${top.rank}. R/R ${top.rrRatio.toFixed(2)}x | WR ${(top.winRate * 100).toFixed(1)}% | ${top.totalTrades} trades`);
      }
    }
  }

  console.log('\n' + '═'.repeat(80));
  console.log('Run: npm run collect-calibration-results -- --update');
  console.log('     to update CALIBRATION_RESULTS.md with these results\n');

  return formatMarkdown(results);
}

function formatMarkdown(results: CalibrationData[]): string {
  let markdown = `# 📊 Calibration Results & Recommendations\n\n`;
  markdown += `**Last Updated**: ${new Date().toISOString().split('T')[0]}\n`;

  const completedCount = results.filter(r => r.status === 'completed').length;
  const totalCount = results.length;
  markdown += `**Status**: ${completedCount}/${totalCount} completed\n\n`;

  markdown += `---\n\n## 🎯 Calibration Results\n\n`;

  for (const result of results) {
    const statusEmoji = {
      'completed': '✅',
      'running': '🔄',
      'pending': '⏳',
    }[result.status];

    markdown += `### ${result.strategy.charAt(0).toUpperCase() + result.strategy.slice(1)} (${result.symbol}) ${statusEmoji}\n\n`;
    markdown += `**Status**: ${result.status}\n\n`;

    if (result.topResults && result.topResults.length > 0) {
      markdown += `**Top Recommendations**:\n\n`;

      for (const top of result.topResults) {
        markdown += `#### #${top.rank} - R/R ${top.rrRatio.toFixed(2)}x | WR ${(top.winRate * 100).toFixed(1)}%\n\n`;
        markdown += `- Total Trades: ${top.totalTrades}\n`;
        markdown += `- Parameters:\n`;
        markdown += '```json\n';
        markdown += JSON.stringify(top.params, null, 2);
        markdown += '\n```\n\n';
      }
    } else {
      markdown += `**Top Recommendations**: Waiting for results...\n\n`;
    }

    markdown += `---\n\n`;
  }

  markdown += `## 📈 Summary\n\n`;
  markdown += `- Completed: ${completedCount}/${totalCount}\n`;
  markdown += `- Running: ${results.filter(r => r.status === 'running').length}\n`;
  markdown += `- Pending: ${results.filter(r => r.status === 'pending').length}\n`;

  return markdown;
}

function main() {
  const args = process.argv.slice(2);
  const shouldUpdate = args.includes('--update');

  console.log('🔍 Collecting calibration results...\n');

  const results = collectResults();
  const markdown = formatResults(results);

  if (shouldUpdate) {
    fs.writeFileSync(RESULTS_FILE, markdown);
    console.log(`✅ Updated ${RESULTS_FILE}`);
  }
}

main();
