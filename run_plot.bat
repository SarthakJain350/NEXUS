@echo off
echo ===================================================
echo 📈 NEXUS: Generating Training Graphs...
echo ===================================================
set PYTHON_PATH=C:\Users\Sarthak\anaconda3\python.exe
if not exist "%PYTHON_PATH%" set PYTHON_PATH=python
%PYTHON_PATH% scripts/plot_results.py
echo.
echo View your metrics at: docs\visualizations\training_metrics.png
echo ===================================================
pause
