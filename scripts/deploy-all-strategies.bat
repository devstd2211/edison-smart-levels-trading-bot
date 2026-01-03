@echo off
REM ============================================================================
REM Deploy ALL 7 Strategies to Production
REM ============================================================================

echo.
echo ========================================================================
echo   DEPLOYING ALL 7 STRATEGIES TO PRODUCTION
echo ========================================================================
echo.

set SOURCE_DIR=%~dp0..

REM 1. Build TypeScript ONCE for all deployments
echo [Step 1/8] Building TypeScript...
cd "%SOURCE_DIR%"
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Build failed!
    exit /b 1
)

REM 2. Deploy Standard Production (config-block.json → block folder)
echo.
echo [Step 2/8] Deploying config-block ^(Standard Production: Level-Based^)...
call "%SOURCE_DIR%\scripts\deploy-to-prod.bat" 1
echo OK: config-block deployed to Edison - block

REM 3. Deploy Weight Testing (config-weight.json → weight folder)
echo.
echo [Step 3/8] Deploying config-weight ^(Whale Hunter^)...
call "%SOURCE_DIR%\scripts\deploy-to-prod.bat" 2
echo OK: config-weight deployed to Edison - weight

REM 4. Deploy Micro Wall
echo.
echo [Step 4/8] Deploying config-microwall ^(Scalping Micro Wall^)...
call "%SOURCE_DIR%\scripts\deploy-microwall.bat"
echo OK: config-microwall deployed

REM 5. Deploy XRP USDT
echo.
echo [Step 5/8] Deploying config-xrpusdt ^(Scalping Tick Delta^)...
call "%SOURCE_DIR%\scripts\deploy-xrpusdt.bat"
echo OK: config-xrpusdt deployed

REM 6. Deploy Ladder TP
echo.
echo [Step 6/8] Deploying config-laddertp ^(Scalping Ladder TP^)...
call "%SOURCE_DIR%\scripts\deploy-laddertp.bat"
echo OK: config-laddertp deployed

REM 7. Deploy Limit Order
echo.
echo [Step 7/8] Deploying config-limitorder ^(Scalping Limit Order^)...
call "%SOURCE_DIR%\scripts\deploy-limitorder.bat"
echo OK: config-limitorder deployed

REM 8. Deploy Order Flow
echo.
echo [Step 8/8] Deploying config-orderflow ^(Scalping Order Flow^)...
call "%SOURCE_DIR%\scripts\deploy-orderflow.bat"
echo OK: config-orderflow deployed

echo.
echo ========================================================================
echo   SUCCESS: ALL 7 STRATEGIES DEPLOYED!
echo ========================================================================
echo.
echo Deployed to:
echo   1. D:\src\Edison - block       ^(Level-Based^)
echo   2. D:\src\Edison - weight      ^(Whale Hunter^)
echo   3. D:\src\Edison - microwall   ^(Scalping Micro Wall^)
echo   4. D:\src\Edison - tickdelta   ^(Scalping Tick Delta^)
echo   5. D:\src\Edison - laddertp    ^(Scalping Ladder TP^)
echo   6. D:\src\Edison - limitorder  ^(Scalping Limit Order^)
echo   7. D:\src\Edison - orderflow   ^(Scalping Order Flow^)
echo.
echo Next: Test each strategy by running:
echo   cd "D:\src\Edison - weight"
echo   timeout 5 npm run dev
echo.
