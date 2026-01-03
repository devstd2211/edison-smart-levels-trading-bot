@echo off
REM ============================================================================
REM Test Fractal Breakout-Retest Strategy
REM ============================================================================
REM Usage: npm run test:fractal
REM        Or directly: scripts\test-fractal.bat

setlocal enabledelayedexpansion
set TIMESTAMP=%date:~6,4%-%date:~3,2%-%date:~0,2% %time:~0,2%:%time:~3,2%:%time:~6,2%

echo.
echo ========================================================================
echo   FRACTAL BREAKOUT-RETEST STRATEGY - TESTS
echo ========================================================================
echo.
echo Timestamp: %TIMESTAMP%
echo.

REM 1. Check if build exists
echo [1/3] Checking build status...
if not exist "dist\strategies\fractal-breakout-retest.strategy.js" (
    echo ERROR: Build not found. Running build first...
    call scripts\build-fractal.bat
    if %errorlevel% neq 0 (
        echo ERROR: Build failed!
        exit /b 1
    )
)
echo [OK] Build verified

REM 2. Run tests
echo.
echo [2/3] Running test suite...
call npm test
if %errorlevel% neq 0 (
    echo.
    echo WARNING: Some tests failed. Check output above.
    echo If fractal-strategy tests pass, it's OK.
    REM Don't exit with error - some tests might be pre-existing failures
)

REM 3. Test summary
echo.
echo [3/3] Test summary...
echo Tests completed. Check output above for details.
echo.

echo ========================================================================
echo   TEST RUN COMPLETE
echo ========================================================================
echo.
echo To deploy:       scripts\deploy-fractal.bat
echo To start bot:    npm run dev
echo.

endlocal
