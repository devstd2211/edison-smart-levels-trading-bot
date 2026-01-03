#!/usr/bin/env node

/**
 * Calibration Deployment Helper
 *
 * Handles file copying for calibration environment setup:
 * - Copies strategy-specific config
 * - Copies market data (SQLite database, orderbook snapshots, ticks)
 *
 * Usage: node deploy-calibration.js <STRATEGY> <CALIBRATION_DIR> <DATA_SOURCE_DIR>
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// CONSTANTS
// ============================================================================

const STRATEGIES = ['block', 'microwall', 'tickdelta', 'laddertp', 'limitorder', 'orderflow', 'weight'];
const CONFIG_SOURCE_DIR = path.join(__dirname, '..', 'configs');

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Log with timestamp
 */
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: '[INFO]',
    warn: '[WARN]',
    error: '[ERROR]',
    success: '[SUCCESS]',
  }[type] || '[LOG]';
  console.log(`${prefix} ${message}`);
}

/**
 * Copy file with error handling
 */
function copyFile(src, dest) {
  try {
    fs.copyFileSync(src, dest);
    return true;
  } catch (error) {
    log(`Failed to copy ${src} to ${dest}: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Copy directory recursively
 */
function copyDirRecursive(src, dest) {
  try {
    // Create destination directory if doesn't exist
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        copyDirRecursive(srcPath, destPath);
      } else {
        copyFile(srcPath, destPath);
      }
    }

    return true;
  } catch (error) {
    log(`Failed to copy directory ${src} to ${dest}: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Validate arguments
 */
function validateArgs(strategy, calibrationDir, dataSourceDir) {
  if (!strategy) {
    log('Error: STRATEGY parameter is required', 'error');
    return false;
  }

  if (!STRATEGIES.includes(strategy.toLowerCase())) {
    log(`Error: Unknown strategy "${strategy}". Valid: ${STRATEGIES.join(', ')}`, 'error');
    return false;
  }

  if (!calibrationDir) {
    log('Error: CALIBRATION_DIR parameter is required', 'error');
    return false;
  }

  if (!fs.existsSync(calibrationDir)) {
    log(`Error: Calibration directory does not exist: ${calibrationDir}`, 'error');
    return false;
  }

  if (!dataSourceDir) {
    log('Warning: DATA_SOURCE_DIR parameter is empty, skipping data copy', 'warn');
    return true;
  }

  if (!fs.existsSync(dataSourceDir)) {
    log(`Warning: Data source directory does not exist: ${dataSourceDir}`, 'warn');
    return true;
  }

  return true;
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

function main() {
  const [node, script, strategy, calibrationDir, dataSourceDir] = process.argv;

  log(`Calibration Deployment Started`);
  log(`Strategy: ${strategy}`);
  log(`Calibration Dir: ${calibrationDir}`);
  log(`Data Source Dir: ${dataSourceDir || '(none)'}`);
  log('');

  // Validate arguments
  if (!validateArgs(strategy, calibrationDir, dataSourceDir)) {
    process.exit(1);
  }

  let errorOccurred = false;

  // ============================================================================
  // 1. Copy Strategy Config
  // ============================================================================

  log('Copying config...');
  const configSource = path.join(CONFIG_SOURCE_DIR, `config-${strategy}.json`);
  const configDest = path.join(calibrationDir, 'config.json');

  if (!fs.existsSync(configSource)) {
    log(`Error: Config file not found: ${configSource}`, 'error');
    errorOccurred = true;
  } else {
    if (copyFile(configSource, configDest)) {
      log(`Config copied: ${configSource} → ${configDest}`, 'success');
    } else {
      errorOccurred = true;
    }
  }

  // ============================================================================
  // 2. Copy Market Data (SQLite database and related files)
  // ============================================================================

  if (dataSourceDir && fs.existsSync(dataSourceDir)) {
    log('Copying market data...');
    const dataDest = path.join(calibrationDir, 'data');

    // Create data directory
    if (!fs.existsSync(dataDest)) {
      fs.mkdirSync(dataDest, { recursive: true });
    }

    // Copy market-data-multi.db (from data-collector)
    const multiDbSource = path.join(dataSourceDir, 'market-data-multi.db');
    const multiDbDest = path.join(dataDest, 'market-data-multi.db');

    if (fs.existsSync(multiDbSource)) {
      if (copyFile(multiDbSource, multiDbDest)) {
        log(`SQLite database copied: ${multiDbSource} → ${multiDbDest}`, 'success');
      } else {
        errorOccurred = true;
      }
    } else {
      // Try market-data.db if multi doesn't exist
      const singleDbSource = path.join(dataSourceDir, 'market-data.db');
      if (fs.existsSync(singleDbSource)) {
        if (copyFile(singleDbSource, multiDbDest)) {
          log(`SQLite database copied: ${singleDbSource} → ${multiDbDest}`, 'success');
        } else {
          errorOccurred = true;
        }
      } else {
        log(`Warning: No market-data database found in ${dataSourceDir}`, 'warn');
      }
    }
  } else if (dataSourceDir) {
    log(`Warning: Data source directory not found: ${dataSourceDir}`, 'warn');
  }

  // ============================================================================
  // 3. Copy package.json if doesn't exist
  // ============================================================================

  const packageJsonDest = path.join(calibrationDir, 'package.json');
  if (!fs.existsSync(packageJsonDest)) {
    log('Creating package.json...');
    const packageJsonSource = path.join(__dirname, '..', 'package.json');
    if (fs.existsSync(packageJsonSource)) {
      if (copyFile(packageJsonSource, packageJsonDest)) {
        log(`package.json created`, 'success');
      } else {
        errorOccurred = true;
      }
    }
  }

  // ============================================================================
  // 4. Copy tsconfig.json if doesn't exist
  // ============================================================================

  const tsconfigDest = path.join(calibrationDir, 'tsconfig.json');
  if (!fs.existsSync(tsconfigDest)) {
    log('Creating tsconfig.json...');
    const tsconfigSource = path.join(__dirname, '..', 'tsconfig.json');
    if (fs.existsSync(tsconfigSource)) {
      if (copyFile(tsconfigSource, tsconfigDest)) {
        log(`tsconfig.json created`, 'success');
      } else {
        errorOccurred = true;
      }
    }
  }

  // ============================================================================
  // 5. Copy source files - ALWAYS UPDATE
  // ============================================================================

  const srcDest = path.join(calibrationDir, 'src');
  log('Updating source files...');
  const srcSource = path.join(__dirname, '..', 'src');
  if (fs.existsSync(srcSource)) {
    if (copyDirRecursive(srcSource, srcDest)) {
      log(`Source files updated`, 'success');
    } else {
      errorOccurred = true;
    }
  }

  // ============================================================================
  // 6. Copy dist (compiled src) if exists
  // ============================================================================

  const distDest = path.join(calibrationDir, 'dist');
  const distSource = path.join(__dirname, '..', 'dist');

  if (fs.existsSync(distSource)) {
    log('Copying compiled dist...');
    if (copyDirRecursive(distSource, distDest)) {
      log(`Compiled dist copied`, 'success');
    } else {
      errorOccurred = true;
    }
  }

  // ============================================================================
  // 7. Copy scripts (TypeScript sources for npm scripts) - ALWAYS UPDATE
  // ============================================================================

  const scriptsDest = path.join(calibrationDir, 'scripts');
  log('Updating scripts (TypeScript sources)...');
  const scriptsSource = path.join(__dirname, '..', 'scripts');
  if (fs.existsSync(scriptsSource)) {
    if (copyDirRecursive(scriptsSource, scriptsDest)) {
      log(`Scripts updated`, 'success');
    } else {
      errorOccurred = true;
    }
  }

  // ============================================================================
  // 8. Copy run-calibration.bat template
  // ============================================================================

  log('Creating run-calibration.bat...');
  const runCalibrationSource = path.join(__dirname, 'run-calibration-template.bat');
  const runCalibrationDest = path.join(calibrationDir, 'run-calibration.bat');

  if (fs.existsSync(runCalibrationSource)) {
    if (copyFile(runCalibrationSource, runCalibrationDest)) {
      log(`run-calibration.bat created`, 'success');
    } else {
      errorOccurred = true;
    }
  } else {
    log(`Warning: Template not found: ${runCalibrationSource}`, 'warn');
  }

  log('');
  if (errorOccurred) {
    log('Deployment completed with errors', 'warn');
    process.exit(1);
  } else {
    log('Deployment completed successfully', 'success');
    process.exit(0);
  }
}

main();
