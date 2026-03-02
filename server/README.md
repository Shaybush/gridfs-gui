# FastAPI Template

Minimal FastAPI project template with structured layout.

## Setup

1. Copy `.env.example` to `.env`
2. Install dependencies: `uv sync`
3. Run: `uv run python main.py`

## Structure

```
app/
  main.py          # FastAPI app
  config.py        # Settings (pydantic-settings)
  api/
    routes.py      # API routes
  models/          # Pydantic models
  services/        # Business logic
docs-claude/       # LLM agent docs
```

## Requirements

- Python 3.10+
- uv package manager
