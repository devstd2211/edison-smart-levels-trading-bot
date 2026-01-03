@echo off
REM ============================================================================
REM Calibration Runner - Template
REM
REM This file will be customized per-strategy during deployment
REM ============================================================================

setlocal enabledelayedexpansion

REM Get the parent directory name (strategy name)
for %%I in ("%CD%") do set "STRATEGY=%%~nI"

echo.
echo ============================================================================
echo Running Calibration for: !STRATEGY!
echo ============================================================================
echo.
echo Working Directory: %CD%
echo.

REM Check if config.json exists
if not exist "config.json" (
    echo ERROR: config.json not found in current directory
    echo.
    exit /b 1
)

REM Check if node_modules exists, install if not
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    if !ERRORLEVEL! neq 0 (
        echo ERROR: npm install failed
        exit /b 1
    )
)

REM Run calibration based on strategy
echo Starting calibration...
echo.

if /i "!STRATEGY!"=="block" (
    call npm run calibrate-rr
) else if /i "!STRATEGY!"=="microwall" (
    call npm run calibrate:microwall
) else if /i "!STRATEGY!"=="tickdelta" (
    call npm run calibrate:tickdelta
) else if /i "!STRATEGY!"=="laddertp" (
    call npm run calibrate:laddertp
) else if /i "!STRATEGY!"=="limitorder" (
    call npm run calibrate:limitorder
) else if /i "!STRATEGY!"=="orderflow" (
    call npm run calibrate:orderflow
) else if /i "!STRATEGY!"=="weight" (
    call npm run calibrate-whale
) else (
    echo ERROR: Unknown strategy "!STRATEGY!"
    echo.
    echo Valid strategies: block, microwall, tickdelta, laddertp, limitorder, orderflow, weight
    echo.
    exit /b 1
)

if !ERRORLEVEL! neq 0 (
    echo.
    echo ERROR: Calibration failed!
    echo.
    exit /b 1
)

echo.
echo ============================================================================
echo Calibration Complete!
echo ============================================================================
echo.
echo Results have been saved to the logs directory.
echo.

endlocal
exit /b 0
