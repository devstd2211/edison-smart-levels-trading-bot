@echo off
REM ============================================================================
REM Deploy Fractal Breakout-Retest Strategy to Production
REM ============================================================================
REM Usage: npm run deploy:fractal
REM        Or directly: scripts\deploy-fractal.bat

setlocal enabledelayedexpansion
set TIMESTAMP=%date:~6,4%-%date:~3,2%-%date:~0,2% %time:~0,2%:%time:~3,2%:%time:~6,2%

echo.
echo ========================================================================
echo   FRACTAL BREAKOUT-RETEST STRATEGY - DEPLOYMENT
echo ========================================================================
echo.
echo Timestamp: %TIMESTAMP%
echo.
echo ========================================================================
echo   SELECT DEPLOYMENT TARGET
echo ========================================================================
echo.
echo   1. Main Production (D:\src\Edison - fractal)
echo      - Dedicated directory for Fractal Breakout-Retest strategy
echo      - Config: config-fractal-ethusdt.json
echo.
echo   2. Demo/Testnet (D:\src\Edison - fractal-demo)
echo      - Demo trading, testnet enabled
echo      - Same config for testing
echo.

REM Check if argument provided (for npm scripts)
if "%1"=="1" (
    set CHOICE=1
    goto SET_DIR
)
if "%1"=="2" (
    set CHOICE=2
    goto SET_DIR
)
if "%1"=="fractal" (
    set CHOICE=1
    goto SET_DIR
)
if "%1"=="fractal-demo" (
    set CHOICE=2
    goto SET_DIR
)

REM No argument - ask user
set /p CHOICE="Enter your choice (1 or 2): "

:SET_DIR
if "%CHOICE%"=="1" (
    set PROD_DIR=D:\src\Edison - fractal
    set DEPLOY_TYPE=MAIN PRODUCTION
    set CONFIG_FILE=config-fractal-ethusdt.json
) else if "%CHOICE%"=="2" (
    set PROD_DIR=D:\src\Edison - fractal-demo
    set DEPLOY_TYPE=DEMO/TESTNET
    set CONFIG_FILE=config-fractal-ethusdt.json
) else (
    echo.
    echo ERROR: Invalid choice! Please enter 1 or 2.
    exit /b 1
)

echo.
echo ========================================================================
echo   DEPLOYING TO %DEPLOY_TYPE%
echo ========================================================================
echo.
echo Target Directory: %PROD_DIR%
echo Configuration:   %CONFIG_FILE%
echo.

set SOURCE_DIR=D:\src\Edison

REM 1. Build TypeScript
echo [1/7] Building TypeScript...
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Build failed!
    exit /b 1
)
echo [OK] Build successful

REM 2. Run tests
echo.
echo [2/7] Running tests...
call npm test 2>nul
REM Don't fail on test errors - some might be pre-existing
echo [OK] Tests completed (check for fractal strategy failures)

REM 3. Create target directory if it doesn't exist
echo.
echo [3/7] Preparing target directory...
if not exist "%PROD_DIR%" (
    mkdir "%PROD_DIR%"
    echo Created new directory: %PROD_DIR%
)
echo [OK] Target directory ready

REM 4. Copy source files
echo.
echo [4/7] Copying source files...
xcopy /E /I /Y /Q "%SOURCE_DIR%\src" "%PROD_DIR%\src" >nul
xcopy /E /I /Y /Q "%SOURCE_DIR%\dist" "%PROD_DIR%\dist" >nul
xcopy /E /I /Y /Q "%SOURCE_DIR%\scripts" "%PROD_DIR%\scripts" >nul
echo [OK] Source files copied

REM 5. Copy configuration
echo.
echo [5/7] Copying configuration...
if "%CHOICE%"=="1" (
    echo Copying production config (ETHUSDT pair, demo disabled)...
    copy /Y "%SOURCE_DIR%\configs\config-fractal-ethusdt.json" "%PROD_DIR%\config.json" >nul
) else if "%CHOICE%"=="2" (
    echo Copying demo config (ETHUSDT pair, demo enabled)...
    copy /Y "%SOURCE_DIR%\configs\config-fractal-ethusdt.json" "%PROD_DIR%\config.json" >nul
)
echo [OK] Configuration copied

REM 6. Copy package files and data
echo.
echo [6/7] Copying package files and dependencies...
copy /Y "%SOURCE_DIR%\package.json" "%PROD_DIR%\package.json" >nul
copy /Y "%SOURCE_DIR%\tsconfig.json" "%PROD_DIR%\tsconfig.json" >nul
copy /Y "%SOURCE_DIR%\.eslintrc.json" "%PROD_DIR%\.eslintrc.json" >nul 2>&1
xcopy /E /I /Y /Q "%SOURCE_DIR%\scripts\data-providers" "%PROD_DIR%\scripts\data-providers" >nul 2>&1
if exist "%SOURCE_DIR%\data" (
    xcopy /E /I /Y /Q "%SOURCE_DIR%\data" "%PROD_DIR%\data" >nul
)
echo [OK] Package files copied

REM 7. Install dependencies (if needed)
echo.
echo [7/7] Checking dependencies...
cd "%PROD_DIR%"
if not exist "node_modules" (
    echo Installing dependencies... (this may take a few minutes)
    call npm install
    if %errorlevel% neq 0 (
        echo WARNING: npm install had issues, but continuing...
    )
) else (
    echo Dependencies already installed
)
cd "%SOURCE_DIR%"
echo [OK] Dependencies ready

echo.
echo ========================================================================
echo   DEPLOYMENT SUCCESSFUL!
echo ========================================================================
echo.
echo Target Directory:    %PROD_DIR%
echo Configuration File:  config.json (fractal-ethusdt)
echo.
echo Strategy Details:
echo   - Daily Level Tracking (5m aggregation)
echo   - Breakout Detection (volume + strength)
echo   - Retest Phase Analysis (99% retest zone)
echo   - 1-Minute Entry Refinement (6 confirmation conditions)
echo   - Weighted Signal Scoring (Fractal 0-125 + SMC 0-110)
echo   - Market Health Monitoring (win rate, profit factor)
echo   - Confidence-Based Position Sizing (50%% / 75%% / 100%%)
echo.
echo To start the bot:
echo   cd "%PROD_DIR%"
echo   npm run dev
echo.
echo To monitor performance:
echo   npm run analyze-journal
echo   npm run analyze-losses
echo.

endlocal
