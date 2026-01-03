@echo off
REM ============================================================================
REM Build Fractal Breakout-Retest Strategy
REM ============================================================================
REM Usage: npm run build:fractal
REM        Or directly: scripts\build-fractal.bat

setlocal enabledelayedexpansion
set TIMESTAMP=%date:~6,4%-%date:~3,2%-%date:~0,2% %time:~0,2%:%time:~3,2%:%time:~6,2%

echo.
echo ========================================================================
echo   FRACTAL BREAKOUT-RETEST STRATEGY - BUILD
echo ========================================================================
echo.
echo Timestamp: %TIMESTAMP%
echo Source:    D:\src\Edison
echo.

REM 1. TypeScript Build
echo [1/3] Compiling TypeScript...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo ERROR: TypeScript compilation failed!
    echo Please fix the errors above and try again.
    exit /b 1
)
echo [OK] TypeScript compiled successfully

REM 2. Verify fractal files exist
echo.
echo [2/3] Verifying fractal strategy files...
if not exist "dist\analyzers\daily-level.tracker.js" (
    echo ERROR: daily-level.tracker.js not found!
    exit /b 1
)
if not exist "dist\analyzers\breakout.detector.js" (
    echo ERROR: breakout.detector.js not found!
    exit /b 1
)
if not exist "dist\analyzers\retest-phase.analyzer.js" (
    echo ERROR: retest-phase.analyzer.js not found!
    exit /b 1
)
if not exist "dist\analyzers\entry-refinement.analyzer.js" (
    echo ERROR: entry-refinement.analyzer.js not found!
    exit /b 1
)
if not exist "dist\services\fractal-smc-weighting.service.js" (
    echo ERROR: fractal-smc-weighting.service.js not found!
    exit /b 1
)
if not exist "dist\services\market-health.monitor.js" (
    echo ERROR: market-health.monitor.js not found!
    exit /b 1
)
if not exist "dist\strategies\fractal-breakout-retest.strategy.js" (
    echo ERROR: fractal-breakout-retest.strategy.js not found!
    exit /b 1
)
echo [OK] All fractal strategy files compiled

REM 3. Verify config exists
echo.
echo [3/3] Verifying configuration files...
if not exist "configs\config-fractal-ethusdt.json" (
    echo ERROR: config-fractal-ethusdt.json not found!
    exit /b 1
)
echo [OK] Configuration files present

echo.
echo ========================================================================
echo   BUILD SUCCESSFUL!
echo ========================================================================
echo.
echo Compiled files are in: dist\
echo Configuration file:    configs\config-fractal-ethusdt.json
echo.
echo Next steps:
echo   1. Run tests:     scripts\test-fractal.bat
echo   2. Deploy:        scripts\deploy-fractal.bat
echo   3. Start bot:     npm run dev
echo.

endlocal
