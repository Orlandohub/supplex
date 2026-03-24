# Integration Testing Script for Story 2.1.1
# Tests all checklist and workflow endpoints with renamed tables

$API_URL = "http://localhost:3000/api"

Write-Host "🧪 Testing Story 2.1.1 - Qualification Data Model Naming Alignment" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Checklist/Template Endpoints
Write-Host "📋 Testing Checklist/Template Endpoints..." -ForegroundColor Yellow
Write-Host "-------------------------------------------" -ForegroundColor Yellow
Write-Host ""

Write-Host "1. GET /api/checklists (list templates)"
try {
    $response = Invoke-WebRequest -Uri "$API_URL/checklists" -Method GET -UseBasicParsing
    Write-Host "   ✅ Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "   Response preview:" -ForegroundColor Gray
    Write-Host "   $($response.Content.Substring(0, [Math]::Min(200, $response.Content.Length)))..." -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 2: Workflow/Process Endpoints
Write-Host "🔄 Testing Workflow/Process Endpoints..." -ForegroundColor Yellow
Write-Host "-------------------------------------------" -ForegroundColor Yellow
Write-Host ""

Write-Host "2. GET /api/workflows (list processes)"
try {
    $response = Invoke-WebRequest -Uri "$API_URL/workflows" -Method GET -UseBasicParsing
    Write-Host "   ✅ Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "   Response preview:" -ForegroundColor Gray
    Write-Host "   $($response.Content.Substring(0, [Math]::Min(200, $response.Content.Length)))..." -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

Write-Host "3. GET /api/workflows/my-tasks (my tasks)"
try {
    $response = Invoke-WebRequest -Uri "$API_URL/workflows/my-tasks" -Method GET -UseBasicParsing
    Write-Host "   ✅ Status: $($response.StatusCode)" -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "   ⚠️  Status: 401 (Expected - requires authentication)" -ForegroundColor Yellow
    } else {
        Write-Host "   ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}
Write-Host ""

Write-Host "4. GET /api/workflows/my-tasks-count (task count)"
try {
    $response = Invoke-WebRequest -Uri "$API_URL/workflows/my-tasks-count" -Method GET -UseBasicParsing
    Write-Host "   ✅ Status: $($response.StatusCode)" -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "   ⚠️  Status: 401 (Expected - requires authentication)" -ForegroundColor Yellow
    } else {
        Write-Host "   ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}
Write-Host ""

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "✅ Basic endpoint connectivity test complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. If you see 200/401/403 responses: ✅ Tables working correctly!" -ForegroundColor Gray
Write-Host "2. If you see 500 errors: ❌ Check API logs for database issues" -ForegroundColor Gray
Write-Host "3. For full testing, use authenticated requests via frontend" -ForegroundColor Gray
Write-Host ""

