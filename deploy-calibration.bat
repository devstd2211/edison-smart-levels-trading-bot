@echo off
REM ============================================================================
REM Deployment Script for Calibration Branch
REM ============================================================================
REM Usage: deploy-calibration.bat [STRATEGY_NAME] [DATA_DIR]
REM Examples:
REM   deploy-calibration.bat microwall
REM   deploy-calibration.bat tickdelta
REM   deploy-calibration.bat laddertp
REM   deploy-calibration.bat limitorder
REM   deploy-calibration.bat orderflow
REM   deploy-calibration.bat weight
REM ============================================================================

setlocal enabledelayedexpansion

REM Default values
set STRATEGY=%1
set DATA_SOURCE=%2

REM If no strategy provided, show usage
if "!STRATEGY!"=="" (
    echo.
    echo ============================================================================
    echo Calibration Deployment Script
    echo ============================================================================
    echo.
    echo Usage: deploy-calibration.bat [STRATEGY_NAME]
    echo.
    echo Available strategies:
    echo   - microwall     (Micro-Wall scalping)
    echo   - tickdelta     (Tick Delta scalping)
    echo   - laddertp      (Ladder TP scalping)
    echo   - limitorder    (Limit Order scalping)
    echo   - orderflow     (Order Flow scalping)
    echo   - weight        (Weight-based filtering)
    echo.
    echo Examples:
    echo   deploy-calibration.bat microwall
    echo   deploy-calibration.bat tickdelta
    echo.
    exit /b 1
)

REM Validate strategy name
set VALID_STRATEGY=0
if /i "!STRATEGY!"=="microwall" set VALID_STRATEGY=1
if /i "!STRATEGY!"=="tickdelta" set VALID_STRATEGY=1
if /i "!STRATEGY!"=="laddertp" set VALID_STRATEGY=1
if /i "!STRATEGY!"=="limitorder" set VALID_STRATEGY=1
if /i "!STRATEGY!"=="orderflow" set VALID_STRATEGY=1
if /i "!STRATEGY!"=="weight" set VALID_STRATEGY=1

if !VALID_STRATEGY! equ 0 (
    echo.
    echo ERROR: Unknown strategy "!STRATEGY!"
    echo.
    echo Available strategies: microwall, tickdelta, laddertp, limitorder, orderflow, weight
    echo.
    exit /b 1
)

REM Set paths
set PROJECT_ROOT=%~dp0
set CALIBRATION_ROOT=D:\src\Edison - calibration
set DATA_SOURCE_DIR=D:\src\Edison - data-collector\data
set CONFIG_SOURCE=%PROJECT_ROOT%configs\config-!STRATEGY!.json

echo.
echo ============================================================================
echo Deploying Calibration Environment for: !STRATEGY!
echo ============================================================================
echo.
echo Project Root:       %PROJECT_ROOT%
echo Calibration Root:   %CALIBRATION_ROOT%
echo Strategy:          !STRATEGY!
echo Config Source:      !CONFIG_SOURCE!
echo Data Source:        !DATA_SOURCE_DIR!
echo.

REM Check if config file exists
if not exist "!CONFIG_SOURCE!" (
    echo ERROR: Config file not found: !CONFIG_SOURCE!
    echo.
    exit /b 1
)

REM Check if data source exists
if not exist "!DATA_SOURCE_DIR!" (
    echo WARNING: Data source directory not found: !DATA_SOURCE_DIR!
    echo Continuing without data copy...
) else (
    echo Data source found - will copy data files
)

REM Create calibration root if doesn't exist
if not exist "%CALIBRATION_ROOT%" (
    echo Creating calibration root directory...
    mkdir "%CALIBRATION_ROOT%"
)

REM Create strategy-specific folder
set STRATEGY_CAL_DIR=%CALIBRATION_ROOT%\!STRATEGY!
if not exist "!STRATEGY_CAL_DIR!" (
    echo Creating strategy folder: !STRATEGY_CAL_DIR!
    mkdir "!STRATEGY_CAL_DIR!"
)

REM Create required subdirectories
if not exist "!STRATEGY_CAL_DIR!\data" (
    echo Creating data directory...
    mkdir "!STRATEGY_CAL_DIR!\data"
)

if not exist "!STRATEGY_CAL_DIR!\logs" (
    echo Creating logs directory...
    mkdir "!STRATEGY_CAL_DIR!\logs"
)

REM Copy source files using Node.js script
echo.
echo Copying files...
node "!PROJECT_ROOT!scripts\deploy-calibration.js" "!STRATEGY!" "!STRATEGY_CAL_DIR!" "!DATA_SOURCE_DIR!"

if !ERRORLEVEL! neq 0 (
    echo ERROR: Deployment failed!
    echo.
    exit /b 1
)

echo.
echo ============================================================================
echo Deployment Complete!
echo ============================================================================
echo.
echo Calibration environment ready at: !STRATEGY_CAL_DIR!
echo.
echo Next steps:
echo   1. cd "!STRATEGY_CAL_DIR!"
echo   2. npm install (if needed)
echo   3. run-calibration.bat
echo.
echo Or run directly:
echo   cd "!STRATEGY_CAL_DIR!" ^&^& run-calibration.bat
echo.

endlocal
exit /b 0
