@echo off
echo Starting HueSTD Backend...
start cmd /k "cd HueSTD_Backend\HueSTD.API && dotnet run"

echo Starting HueSTD Frontend...
start cmd /k "cd HueSTD_Frontend && npm run dev"

echo Done! Backend: http://localhost:5136/swagger, Frontend: http://localhost:3000
pause
