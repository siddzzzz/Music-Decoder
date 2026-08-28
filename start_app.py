"""
One-click Runner for Music-Decoder (Starts Backend API & Frontend Studio)
"""
import os
import sys
import subprocess
import time
import webbrowser
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
VENV_PYTHON = ROOT_DIR / "venv" / "Scripts" / "python.exe"
FRONTEND_DIR = ROOT_DIR / "frontend"


def main():
    print("==================================================")
    print("🎵 Starting Music-Decoder AI Studio...")
    print("==================================================")

    # 1. Start FastAPI Backend
    print("[1/2] Launching AI Backend (FastAPI on http://127.0.0.1:8000)...")
    backend_cmd = [
        str(VENV_PYTHON),
        "-m",
        "uvicorn",
        "main:app",
        "--host",
        "127.0.0.1",
        "--port",
        "8000",
        "--reload"
    ]
    backend_proc = subprocess.Popen(
        backend_cmd,
        cwd=str(ROOT_DIR / "backend")
    )

    # Wait for backend to warm up
    time.sleep(2)

    # 2. Start Vite Frontend
    print("[2/2] Launching Frontend Web Studio (Vite on http://localhost:5173)...")
    frontend_proc = subprocess.Popen(
        ["cmd.exe", "/c", "npm run dev"],
        cwd=str(FRONTEND_DIR)
    )

    time.sleep(2)
    print("\n🚀 Music-Decoder is LIVE at: http://localhost:5173")
    print("API Documentation: http://127.0.0.1:8000/docs")
    print("Press Ctrl+C to terminate both servers.")

    try:
        webbrowser.open("http://localhost:5173")
        backend_proc.wait()
        frontend_proc.wait()
    except KeyboardInterrupt:
        print("\nStopping services...")
        backend_proc.terminate()
        frontend_proc.terminate()
        print("Music-Decoder stopped.")


if __name__ == "__main__":
    main()
