@echo off
REM Calibrate all 5 scalping strategies
REM This will take 5-10 hours total!

echo ========================================
echo Calibrating ALL 5 Scalping Strategies
echo ========================================
echo.
echo WARNING: This will take 5-10 hours!
echo Press Ctrl+C to cancel...
timeout /t 5
echo.

REM Get start time
set START_TIME=%TIME%
echo Started at: %START_TIME%
echo.

REM Strategy 1: Micro-Wall
echo ========================================
echo [1/5] Calibrating Micro-Wall (SUIUSDT)
echo ========================================
call npm run calibrate:microwall
if errorlevel 1 (
    echo ERROR: Micro-Wall calibration failed!
    pause
    exit /b 1
)
echo.
echo [1/5] Micro-Wall calibration complete!
echo.

REM Strategy 2: Tick Delta
echo ========================================
echo [2/5] Calibrating Tick Delta (STRKUSDT)
echo ========================================
call npm run calibrate:tickdelta
if errorlevel 1 (
    echo ERROR: Tick Delta calibration failed!
    pause
    exit /b 1
)
echo.
echo [2/5] Tick Delta calibration complete!
echo.

REM Strategy 3: Ladder TP
echo ========================================
echo [3/5] Calibrating Ladder TP (HYPEUSDT)
echo ========================================
call npm run calibrate:laddertp
if errorlevel 1 (
    echo ERROR: Ladder TP calibration failed!
    pause
    exit /b 1
)
echo.
echo [3/5] Ladder TP calibration complete!
echo.

REM Strategy 4: Limit Order
echo ========================================
echo [4/5] Calibrating Limit Order (ADAUSDT)
echo ========================================
call npm run calibrate:limitorder
if errorlevel 1 (
    echo ERROR: Limit Order calibration failed!
    pause
    exit /b 1
)
echo.
echo [4/5] Limit Order calibration complete!
echo.

REM Strategy 5: Order Flow
echo ========================================
echo [5/5] Calibrating Order Flow (XLMUSDT)
echo ========================================
call npm run calibrate:orderflow
if errorlevel 1 (
    echo ERROR: Order Flow calibration failed!
    pause
    exit /b 1
)
echo.
echo [5/5] Order Flow calibration complete!
echo.

REM Get end time
set END_TIME=%TIME%

echo ========================================
echo ALL CALIBRATIONS COMPLETE!
echo ========================================
echo.
echo Start time: %START_TIME%
echo End time:   %END_TIME%
echo.
echo Results saved:
echo   - calibration-microwall-*.json
echo   - calibration-tickdelta-*.json
echo   - calibration-laddertp-*.json
echo   - calibration-limitorder-*.json
echo   - calibration-orderflow-*.json
echo.
echo Next steps:
echo   1. Review results in each JSON file
echo   2. Apply best configs to each deployment folder
echo   3. Start trading!
echo.
pause
