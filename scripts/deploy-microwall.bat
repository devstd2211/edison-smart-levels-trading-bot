@echo off
REM Deploy Scalping Micro-Wall Strategy to dedicated folder
REM Symbol: SUIUSDT
REM Strategy: ScalpingMicroWall (Phase 1)

echo ========================================
echo Deploying Micro-Wall Strategy (SUIUSDT)
echo ========================================

set SOURCE_DIR=D:\src\Edison
set DEPLOY_DIR=D:\src\Edison - microwall

echo.
echo [1/6] Compiling TypeScript...
call npm run build
if errorlevel 1 (
    echo ERROR: Build failed!
    pause
    exit /b 1
)

echo.
echo [2/6] Creating deployment directory...
if not exist "%DEPLOY_DIR%" mkdir "%DEPLOY_DIR%"

echo.
echo [3/6] Copying source files...
xcopy /E /I /Y "%SOURCE_DIR%\src" "%DEPLOY_DIR%\src"
xcopy /E /I /Y "%SOURCE_DIR%\dist" "%DEPLOY_DIR%\dist"
xcopy /E /I /Y "%SOURCE_DIR%\scripts" "%DEPLOY_DIR%\scripts"

echo.
echo [4/6] Copying configuration files...
copy /Y "%SOURCE_DIR%\package.json" "%DEPLOY_DIR%\"
copy /Y "%SOURCE_DIR%\tsconfig.json" "%DEPLOY_DIR%\"
copy /Y "%SOURCE_DIR%\.env" "%DEPLOY_DIR%\" 2>nul

REM Copy custom config for Micro-Wall
copy /Y "%SOURCE_DIR%\configs\config-microwall.json" "%DEPLOY_DIR%\config.json"

echo.
echo [5/6] Checking node_modules...
if not exist "%DEPLOY_DIR%\node_modules" (
    echo Installing dependencies...
    cd "%DEPLOY_DIR%"
    call npm install
    cd "%SOURCE_DIR%"
) else (
    echo Dependencies already installed.
)

echo.
echo [6/6] Creating data directory...
if not exist "%DEPLOY_DIR%\data" mkdir "%DEPLOY_DIR%\data"
if not exist "%DEPLOY_DIR%\logs" mkdir "%DEPLOY_DIR%\logs"

echo.
echo ========================================
echo Deployment complete!
echo ========================================
echo.
echo Strategy: Scalping Micro-Wall
echo Symbol: SUIUSDT
echo Location: %DEPLOY_DIR%
echo.
echo To start trading:
echo   cd "%DEPLOY_DIR%"
echo   npm run dev
echo.
pause
