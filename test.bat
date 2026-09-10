@echo off
echo ===================================================
echo 🚗 NEXUS: Running Model Verification Test...
echo ===================================================
set PYTHON_PATH=C:\Users\Sarthak\anaconda3\python.exe
if not exist "%PYTHON_PATH%" set PYTHON_PATH=python
%PYTHON_PATH% scripts/test_pipeline.py
pause
