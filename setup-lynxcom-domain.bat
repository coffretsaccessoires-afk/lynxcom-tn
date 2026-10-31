@echo off
:: Batch script to configure www.lynxcom.tn on Windows
echo ========================================================
echo Configuration du nom de domaine www.lynxcom.tn en local
echo ========================================================
echo.

findstr /C:"www.lynxcom.tn" %WINDIR%\System32\drivers\etc\hosts >nul
if %errorlevel% equ 0 (
    echo [OK] Le domaine www.lynxcom.tn est deja configure dans votre fichier hosts.
) else (
    echo Ajout de 127.0.0.1 www.lynxcom.tn lynxcom.tn dans le fichier hosts...
    echo 127.0.0.1 www.lynxcom.tn lynxcom.tn >> %WINDIR%\System32\drivers\etc\hosts
    if %errorlevel% equ 0 (
        echo [SUCCES] www.lynxcom.tn a ete ajoute avec succes !
    ) else (
        echo [ERREUR] Veuillez executer ce fichier en tant qu'administrateur (Clic-droit ^> Executer en tant qu'administrateur).
    )
)

echo.
echo Vous pouvez maintenant ouvrir votre site a l'adresse :
echo http://www.lynxcom.tn:3000/
echo.
pause

