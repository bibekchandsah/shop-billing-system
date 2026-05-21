@echo off
echo ========================================
echo Shop Billing System - Setup Script
echo ========================================
echo.

echo [1/5] Checking Node.js installation...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)
echo Node.js is installed: 
node --version
echo.

echo [2/5] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install dependencies!
    pause
    exit /b 1
)
echo Dependencies installed successfully!
echo.

echo [3/5] Checking Firebase configuration...
if not exist "src\firebase\config.ts" (
    echo ERROR: Firebase config file not found!
    echo Please create src\firebase\config.ts with your Firebase credentials
    pause
    exit /b 1
)
echo Firebase config file found!
echo.

echo [4/5] Creating environment file...
if not exist ".env" (
    if exist ".env.example" (
        copy .env.example .env
        echo .env file created from .env.example
        echo Please update .env with your Firebase credentials
    ) else (
        echo .env.example not found, skipping...
    )
) else (
    echo .env file already exists
)
echo.

echo [5/5] Setup complete!
echo.
echo ========================================
echo Next Steps:
echo ========================================
echo 1. Update src\firebase\config.ts with your Firebase credentials
echo 2. Update .env file (if created) with your configuration
echo 3. Run 'npm run dev' to start the development server
echo 4. Open http://localhost:5173 in your browser
echo.
echo For detailed setup instructions, see:
echo - README.md
echo - FIREBASE_SETUP.md
echo ========================================
echo.
pause
