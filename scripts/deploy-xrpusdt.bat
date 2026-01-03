@echo off
REM Deploy XRP USDT Strategy to dedicated folder
REM Symbol: XRPUSDT
REM Strategy: LevelBased with Structure-Aware Exit

echo ========================================
echo Deploying XRP USDT Strategy (XRPUSDT)
echo ========================================

set SOURCE_DIR=D:\src\Edison
set DEPLOY_DIR=D:\src\Edison - xrpusdt

echo.
echo [1/8] Compiling TypeScript...
call npm run build
if errorlevel 1 (
    echo ERROR: Build failed!
    pause
    exit /b 1
)

echo.
echo [2/8] Creating deployment directory...
if not exist "%DEPLOY_DIR%" mkdir "%DEPLOY_DIR%"

echo.
echo [3/8] Copying source files...
xcopy /E /I /Y "%SOURCE_DIR%\src" "%DEPLOY_DIR%\src"
xcopy /E /I /Y "%SOURCE_DIR%\dist" "%DEPLOY_DIR%\dist"
xcopy /E /I /Y "%SOURCE_DIR%\scripts" "%DEPLOY_DIR%\scripts"
xcopy /E /I /Y "%SOURCE_DIR%\web-server" "%DEPLOY_DIR%\web-server"
xcopy /E /I /Y "%SOURCE_DIR%\web-client" "%DEPLOY_DIR%\web-client"

echo.
echo [4/8] Copying configuration files...
copy /Y "%SOURCE_DIR%\package.json" "%DEPLOY_DIR%\"
copy /Y "%SOURCE_DIR%\tsconfig.json" "%DEPLOY_DIR%\"
copy /Y "%SOURCE_DIR%\.env" "%DEPLOY_DIR%\" 2>nul

REM Copy custom config for XRPUSDT
copy /Y "%SOURCE_DIR%\configs\config-xrpusdt.json" "%DEPLOY_DIR%\config.json"

echo.
echo [5/8] Checking node_modules...
if not exist "%DEPLOY_DIR%\node_modules" (
    echo Installing dependencies...
    cd "%DEPLOY_DIR%"
    call npm install
    cd "%SOURCE_DIR%"
) else (
    echo Dependencies already installed.
)

echo.
echo [6/8] Checking web-server dependencies...
if not exist "%DEPLOY_DIR%\web-server\node_modules" (
    echo Installing web-server dependencies...
    cd "%DEPLOY_DIR%\web-server"
    call npm install
    cd "%SOURCE_DIR%"
) else (
    echo Web-server dependencies already installed.
)

echo.
echo [7/8] Building web-server...
cd "%DEPLOY_DIR%"
call npm run build
if errorlevel 1 (
    echo WARNING: Web-server build had issues
)
cd "%SOURCE_DIR%"

echo.
echo [8/8] Creating data directory...
if not exist "%DEPLOY_DIR%\data" mkdir "%DEPLOY_DIR%\data"
if not exist "%DEPLOY_DIR%\logs" mkdir "%DEPLOY_DIR%\logs"

echo.
echo ========================================
echo Deployment complete!
echo ========================================
echo.
echo Strategy: LevelBased with Structure-Aware Exit
echo Symbol: XRPUSDT
echo Location: %DEPLOY_DIR%
echo.
echo To start trading:
echo   cd "%DEPLOY_DIR%"
echo   npm run dev
echo.
pause
