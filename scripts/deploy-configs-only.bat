@echo off
REM ============================================================================
REM Deploy ONLY Config Files (No Code)
REM ============================================================================
REM
REM This script deploys ONLY configuration files to production directories
REM without touching any source code or npm modules
REM
REM ============================================================================

echo.
echo ========================================================================
echo   Deploy ONLY Configs - No Code Changes
echo ========================================================================
echo.

REM ============================================================================
REM ORDER FLOW (XLMUSDT)
REM ============================================================================
echo [1/2] Deploying Order Flow config...
set ORDERFLOW_DIR=D:\src\Edison - orderflow
if not exist "%ORDERFLOW_DIR%" (
    echo ERROR: Order Flow directory not found: %ORDERFLOW_DIR%
    pause
    exit /b 1
)

REM Backup existing config
if exist "%ORDERFLOW_DIR%\config.json" (
    copy "%ORDERFLOW_DIR%\config.json" "%ORDERFLOW_DIR%\config.json.backup" >nul 2>&1
    echo   - Backed up existing config
)

REM Deploy new config
copy "configs\config-orderflow.json" "%ORDERFLOW_DIR%\config.json" /Y >nul
if errorlevel 1 (
    echo ERROR: Failed to copy config-orderflow.json
    pause
    exit /b 1
)
echo   - Order Flow config deployed: %ORDERFLOW_DIR%\config.json
echo   - Changes: SL 0.08%% -^> 0.20%%, TP 0.15%% -^> 0.25%%, minConf 70%% -^> 85%%
echo.

REM ============================================================================
REM WHALE HUNTER (APEXUSDT)
REM ============================================================================
echo [2/2] Deploying Whale Hunter config...
set WHALE_DIR=D:\src\Edison - weight
if not exist "%WHALE_DIR%" (
    echo ERROR: Whale Hunter directory not found: %WHALE_DIR%
    pause
    exit /b 1
)

REM Backup existing config
if exist "%WHALE_DIR%\config.json" (
    copy "%WHALE_DIR%\config.json" "%WHALE_DIR%\config.json.backup" >nul 2>&1
    echo   - Backed up existing config
)

REM Deploy new config
copy "configs\config-weight.json" "%WHALE_DIR%\config.json" /Y >nul
if errorlevel 1 (
    echo ERROR: Failed to copy config-weight.json
    pause
    exit /b 1
)
echo   - Whale Hunter config deployed: %WHALE_DIR%\config.json
echo   - Changes: SL ATR 1.0x -^> 1.5x, minConf 75%% -^> 80%%, minConfLong 90%% -^> 85%%
echo.

REM ============================================================================
REM SUMMARY
REM ============================================================================
echo ========================================================================
echo   DEPLOYMENT SUMMARY
echo ========================================================================
echo.
echo   Configs Deployed: 2/2
echo.
echo   Order Flow (XLMUSDT):
echo     - Stop Loss:      0.08%% -^> 0.20%% (2.5x increase)
echo     - Take Profit:    0.15%% -^> 0.25%% (1.67x increase)
echo     - Min Confidence: 70%% -^> 85%% (filter weak signals)
echo     - Max Hold Time:  30s -^> 60s (more breathing room)
echo.
echo   Whale Hunter (APEXUSDT):
echo     - SL ATR Mult:    1.0x -^> 1.5x (50%% more room)
echo     - Min Confidence: 75%% -^> 80%% (filter 62-72%% signals)
echo     - Min Conf LONG:  90%% -^> 85%% (allow more LONG entries)
echo     - Min Conf SHORT: 70%% -^> 75%%
echo.
echo   Expected Results:
echo     - Order Flow: Stop-out rate 60.2%% -^> ~35-40%%
echo     - Whale Hunter: W/L Ratio 0.59:1 -^> 1.5:1+
echo.
echo ========================================================================
echo.
echo   NEXT STEPS:
echo     1. Restart Order Flow bot:
echo        cd "D:\src\Edison - orderflow" ^&^& npm run dev
echo.
echo     2. Restart Whale Hunter bot:
echo        cd "D:\src\Edison - weight" ^&^& npm run dev
echo.
echo     3. Monitor for 6-12 hours and check:
echo        npm run analyze-journal
echo.
echo ========================================================================
echo.
pause
