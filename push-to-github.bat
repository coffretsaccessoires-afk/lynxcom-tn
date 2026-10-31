@echo off
echo ===================================================
echo     LynxCom - Synchronisation GitHub vers Render
echo ===================================================
echo.
set /p REPO_URL="Collez l'URL de votre repository GitHub (ex: https://github.com/marketing545/lynxcom.git) : "

if "%REPO_URL%"=="" (
    echo [ERREUR] Aucune URL fournie. Operation annulee.
    pause
    exit /b
)

echo.
echo [1/3] Configuration du remote GitHub...
git remote remove origin 2>nul
git remote add origin %REPO_URL%

echo [2/3] Verification de la branche main...
git branch -M main

echo [3/3] Envoi des fichiers vers GitHub...
git push -u origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ===================================================
    echo [SUCCES] Vos fichiers sont en ligne sur GitHub !
    echo Rendez-vous sur https://dashboard.render.com/ 
    echo Cliquez sur "New + -> Web Service" et selectionnez votre depot !
    echo ===================================================
) else (
    echo.
    echo [NOTE] Si GitHub vous demande une authentification, utilisez votre Token Personnel GitHub (PAT).
)

pause

