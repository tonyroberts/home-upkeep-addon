# Backend (Python)

## Setup

```bash
# make sure you already have python and python3-dev installed to begin with

pip install uv # if you don't already have uv installed
cd backend
uv sync
uv run uvicorn app.main:app --reload
```