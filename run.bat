@echo off
echo ===================================================
echo 🚗 NEXUS: Starting Dashboard...
echo ===================================================
set PYTHON_PATH=C:\Users\Sarthak\anaconda3\python.exe
if not exist "%PYTHON_PATH%" set PYTHON_PATH=python
%PYTHON_PATH% -m streamlit run app.py
pause
