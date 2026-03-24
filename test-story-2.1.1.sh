#!/bin/bash
# Integration Testing Script for Story 2.1.1
# Tests all checklist and workflow endpoints with renamed tables

API_URL="http://localhost:3000/api"
echo "🧪 Testing Story 2.1.1 - Qualification Data Model Naming Alignment"
echo "=================================================================="
echo ""

# Test 1: Checklist/Template Endpoints
echo "📋 Testing Checklist/Template Endpoints..."
echo "-------------------------------------------"

echo "1. GET /api/checklists (list templates)"
curl -s -w "\nStatus: %{http_code}\n" "$API_URL/checklists" | head -20
echo ""

echo "2. GET /api/checklists/:id (get template details)"
# You'll need to replace with an actual ID from your database
echo "   (Requires valid template ID - check response above)"
echo ""

# Test 2: Workflow/Process Endpoints
echo "🔄 Testing Workflow/Process Endpoints..."
echo "-------------------------------------------"

echo "3. GET /api/workflows (list processes)"
curl -s -w "\nStatus: %{http_code}\n" "$API_URL/workflows" | head -20
echo ""

echo "4. GET /api/workflows/my-tasks (my tasks)"
curl -s -w "\nStatus: %{http_code}\n" "$API_URL/workflows/my-tasks"
echo ""

echo "5. GET /api/workflows/my-tasks-count (task count)"
curl -s -w "\nStatus: %{http_code}\n" "$API_URL/workflows/my-tasks-count"
echo ""

echo "=================================================================="
echo "✅ Basic endpoint connectivity test complete!"
echo ""
echo "Next steps:"
echo "1. Verify all endpoints returned 200/401/403 (not 500 errors)"
echo "2. If you see database errors, the table rename may have issues"
echo "3. Test POST/PUT/DELETE operations manually with valid auth tokens"
echo ""

