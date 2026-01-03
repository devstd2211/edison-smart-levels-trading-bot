@echo off
REM ============================================================================
REM Deploy to Production
REM ============================================================================
REM Usage: npm run deploy
REM        npm run deploy:weight

echo.
echo ========================================================================
echo   SELECT DEPLOYMENT TARGET
echo ========================================================================
echo.
echo   1. Standard Production (D:\src\Edison - block)
echo      - No weights, current stable config
echo.
echo   2. Weight Testing (D:\src\Edison - weight)
echo      - For testing Weight System optimization
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
if "%1"=="weight" (
    set CHOICE=2
    goto SET_DIR
)

REM No argument - ask user
set /p CHOICE="Enter your choice (1 or 2): "

:SET_DIR
if "%CHOICE%"=="1" (
    set PROD_DIR=D:\src\Edison - block
    set DEPLOY_TYPE=STANDARD PRODUCTION
) else if "%CHOICE%"=="2" (
    set PROD_DIR=D:\src\Edison - weight
    set DEPLOY_TYPE=WEIGHT TESTING
) else (
    echo.
    echo ERROR: Invalid choice! Please enter 1 or 2.
    exit /b 1
)

echo.
echo ========================================================================
echo   DEPLOYING TO %DEPLOY_TYPE%: %PROD_DIR%
echo ========================================================================
echo.

set SOURCE_DIR=D:\src\Edison

REM 1. Build TypeScript
echo [1/6] Building TypeScript...
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Build failed!
    exit /b 1
)

REM 2. Copy source files
echo.
echo [2/6] Copying source files...
xcopy /E /I /Y "%SOURCE_DIR%\src" "%PROD_DIR%\src"
xcopy /E /I /Y "%SOURCE_DIR%\scripts" "%PROD_DIR%\scripts"

REM 3. Copy config
echo.
echo [3/6] Copying config.json...
if "%CHOICE%"=="1" (
    echo Copying block-specific config ^(standard production^)...
    copy /Y "%SOURCE_DIR%\configs\config-block.json" "%PROD_DIR%\config.json"
) else if "%CHOICE%"=="2" (
    echo Copying whale-specific config ^(whaleHunter enabled^)...
    copy /Y "%SOURCE_DIR%\configs\config-weight.json" "%PROD_DIR%\config.json"
) else (
    copy /Y "%SOURCE_DIR%\config.json" "%PROD_DIR%\config.json"
)

REM 4. Copy package files
echo.
echo [4/6] Copying package files...
copy /Y "%SOURCE_DIR%\package.json" "%PROD_DIR%\package.json"
copy /Y "%SOURCE_DIR%\tsconfig.json" "%PROD_DIR%\tsconfig.json"

REM 5. Copy data providers
echo.
echo [5/6] Copying data providers...
xcopy /E /I /Y "%SOURCE_DIR%\scripts\data-providers" "%PROD_DIR%\scripts\data-providers"

REM 6. Install dependencies (if needed)
echo.
echo [6/6] Checking dependencies...
cd "%PROD_DIR%"
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
) else (
    echo Dependencies already installed. Skipping npm install.
)

echo.
echo ========================================================================
echo   DEPLOYMENT COMPLETE!
echo ========================================================================
echo.
echo Production directory: %PROD_DIR%
echo.
echo To start the bot:
echo   cd "%PROD_DIR%"
echo   npm run dev
echo.
