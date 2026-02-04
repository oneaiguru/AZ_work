# ai_flow_web

Server-rendered web UI for running ai_flow commands with validation and double confirmation.

## Stack
- FastAPI + Jinja2 for SSR
- Bulma CSS for components

## Setup
```powershell
cd C:\work\oneaiguru\AZ_work\ai_flow\ai_flow_web
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Run
```powershell
cd C:\work\oneaiguru\AZ_work\ai_flow\ai_flow_web
python -m uvicorn app:app --reload --port 8000
```

Open `http://127.0.0.1:8000`.

## Configuration
- `AI_FLOW_WEB_ROOT` sets the base root for project paths.
  - Defaults to the repo root (`C:\work\oneaiguru\AZ_work\ai_flow` when running from this checkout).
  - All project paths must resolve inside the base root.
