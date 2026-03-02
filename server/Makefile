.PHONY: help dev start debug test test-v test-vv test-s test-vs test-x test-lf test-ff test-k test-cov test-cov-html test-api test-service test-watch test-quick install clean

# Default target
help:
	@echo "Available commands:"
	@echo ""
	@echo "Development:"
	@echo "  make dev      - Run FastAPI with uvicorn in reload mode (supports breakpoints)"
	@echo "  make start    - Run FastAPI with uvicorn"
	@echo "  make debug    - Alias for dev"
	@echo ""
	@echo "Testing - Basic:"
	@echo "  make test        - Run all tests"
	@echo "  make test-v      - Run tests with verbose output"
	@echo "  make test-vv     - Run tests with very verbose output"
	@echo "  make test-s      - Run tests showing print statements"
	@echo "  make test-vs     - Run tests verbose + show prints"
	@echo ""
	@echo "Testing - Failure Handling:"
	@echo "  make test-x      - Stop on first failure"
	@echo "  make test-lf     - Run only last failed tests"
	@echo "  make test-ff     - Run failed tests first, then rest"
	@echo "  make test-quick  - Quick run (verbose + stop on first failure)"
	@echo ""
	@echo "Testing - Filtered:"
	@echo "  make test-k PATTERN=name  - Run tests matching pattern"
	@echo "  make test-api             - Run only API/route tests"
	@echo "  make test-service         - Run only service tests"
	@echo ""
	@echo "Testing - Coverage:"
	@echo "  make test-cov      - Run tests with coverage report"
	@echo "  make test-cov-html - Run tests with HTML coverage report"
	@echo ""
	@echo "Testing - Watch Mode:"
	@echo "  make test-watch    - Run tests in watch mode (requires pytest-watch)"
	@echo ""
	@echo "Utilities:"
	@echo "  make install  - Install dependencies"
	@echo "  make clean    - Clean cache files"

# Development: Run FastAPI with uvicorn in reload mode (supports breakpoints)
dev:
	@echo "Starting FastAPI in dev mode..."
	uv run python main.py

# Start: Run FastAPI with uvicorn
start:
	@echo "Starting FastAPI..."
	uv run uvicorn main:app --host 0.0.0.0 --port 8000

# Debug: Alias for dev
debug: dev

# Test: Run all tests
test:
	@echo "Running tests..."
	uv run pytest

# Test with verbose output
test-v:
	@echo "Running tests (verbose)..."
	uv run pytest -v

# Test with very verbose output
test-vv:
	@echo "Running tests (very verbose)..."
	uv run pytest -vv

# Test with print statements shown
test-s:
	@echo "Running tests (show prints)..."
	uv run pytest -s

# Test verbose + show prints
test-vs:
	@echo "Running tests (verbose + show prints)..."
	uv run pytest -v -s

# Test: Stop on first failure
test-x:
	@echo "Running tests (stop on first failure)..."
	uv run pytest -x

# Test: Run only last failed tests
test-lf:
	@echo "Running last failed tests..."
	uv run pytest --lf

# Test: Run failed tests first
test-ff:
	@echo "Running failed tests first..."
	uv run pytest --ff

# Test: Run tests matching pattern (use: make test-k PATTERN=calendar)
test-k:
	@echo "Running tests matching pattern: $(PATTERN)..."
	uv run pytest -k "$(PATTERN)"

# Test: Run with coverage report
test-cov:
	@echo "Running tests with coverage..."
	uv run pytest --cov=app --cov-report=term-missing

# Test: Run with HTML coverage report
test-cov-html:
	@echo "Running tests with HTML coverage..."
	uv run pytest --cov=app --cov-report=html
	@echo "Coverage report generated at htmlcov/index.html"

# Test: Run only API/route tests
test-api:
	@echo "Running API tests..."
	uv run pytest tests/api/ -v

# Test: Run only service tests
test-service:
	@echo "Running service tests..."
	uv run pytest tests/services/ -v

# Test: Watch mode (re-run on file changes)
test-watch:
	@echo "Running tests in watch mode..."
	@echo "Note: Requires pytest-watch (install: uv add --dev pytest-watch)"
	uv run ptw -- -v

# Test: Quick test run (verbose + stop on first failure)
test-quick:
	@echo "Running quick test (verbose + stop on first failure)..."
	uv run pytest -vv -x

# Install: Install dependencies
install:
	@echo "Installing dependencies..."
	uv sync

# Clean: Remove cache files
clean:
	@echo "Cleaning cache files..."
	find . -type d -name __pycache__ -exec rm -r {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true
	find . -type f -name "*.pyo" -delete 2>/dev/null || true
	find . -type d -name "*.egg-info" -exec rm -r {} + 2>/dev/null || true
