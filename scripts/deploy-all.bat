@echo off
echo ================================================================================
echo DEPLOYING ALL 7 STRATEGIES
echo ================================================================================

REM Build first
echo.
echo [1/8] Building TypeScript...
call npm run build
if errorlevel 1 (
    echo ERROR: Build failed!
    exit /b 1
)

REM Deploy config-block (Level-Based)
echo.
echo [2/8] Deploying config-block (Level-Based)...
copy "configs\config-block.json" "D:\src\Edison - block\config.json" /Y
echo OK: config-block deployed

REM Deploy config-weight (Whale Hunter)
echo.
echo [3/8] Deploying config-weight (Whale Hunter)...
copy "configs\config-weight.json" "D:\src\Edison - weight\config.json" /Y
echo OK: config-weight deployed

REM Deploy config-microwall (Scalping Micro Wall)
echo.
echo [4/8] Deploying config-microwall (Scalping Micro Wall)...
copy "configs\config-microwall.json" "D:\src\Edison - microwall\config.json" /Y
echo OK: config-microwall deployed

REM Deploy config-xrpusdt (Scalping Tick Delta)
echo.
echo [5/8] Deploying config-xrpusdt (Scalping Tick Delta)...
copy "configs\config-xrpusdt.json" "D:\src\Edison - tickdelta\config.json" /Y
echo OK: config-xrpusdt deployed

REM Deploy config-laddertp (Scalping Ladder TP)
echo.
echo [6/8] Deploying config-laddertp (Scalping Ladder TP)...
copy "configs\config-laddertp.json" "D:\src\Edison - laddertp\config.json" /Y
echo OK: config-laddertp deployed

REM Deploy config-limitorder (Scalping Limit Order)
echo.
echo [7/8] Deploying config-limitorder (Scalping Limit Order)...
copy "configs\config-limitorder.json" "D:\src\Edison - limitorder\config.json" /Y
echo OK: config-limitorder deployed

REM Deploy config-orderflow (Scalping Order Flow)
echo.
echo [8/8] Deploying config-orderflow (Scalping Order Flow)...
copy "configs\config-orderflow.json" "D:\src\Edison - orderflow\config.json" /Y
echo OK: config-orderflow deployed

echo.
echo ================================================================================
echo SUCCESS: All 7 strategies deployed!
echo ================================================================================
echo.
echo Deployed to:
echo   1. D:\src\Edison - block       (Level-Based)
echo   2. D:\src\Edison - weight      (Whale Hunter)
echo   3. D:\src\Edison - microwall   (Scalping Micro Wall)
echo   4. D:\src\Edison - tickdelta   (Scalping Tick Delta)
echo   5. D:\src\Edison - laddertp    (Scalping Ladder TP)
echo   6. D:\src\Edison - limitorder  (Scalping Limit Order)
echo   7. D:\src\Edison - orderflow   (Scalping Order Flow)
echo.
