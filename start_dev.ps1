# Start Supply Chain Analytics — Dev Mode
# Run: .\start_dev.ps1

Write-Host ""
Write-Host "Supply Chain Analytics — Starting services..." -ForegroundColor Cyan
Write-Host ""

# Check if Gold data exists
if (-not (Test-Path "data\gold\fact_sales.parquet")) {
    Write-Host "[1/3] Running ETL pipeline first (no Gold data found)..." -ForegroundColor Yellow
    python run_pipeline.py --no-db
} else {
    Write-Host "[1/3] Gold data found — skipping pipeline run." -ForegroundColor Green
}

Write-Host ""
Write-Host "[2/3] Starting FastAPI on http://localhost:8000" -ForegroundColor Cyan
Write-Host "      API docs: http://localhost:8000/docs"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; python -m uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload"

Start-Sleep -Seconds 2

Write-Host ""
Write-Host "[3/3] Starting React dashboard on http://localhost:5173" -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\frontend'; npm run dev"

Write-Host ""
Write-Host "Both services starting. Open http://localhost:5173 in your browser." -ForegroundColor Green
Write-Host ""
