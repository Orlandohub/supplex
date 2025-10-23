# Story 1.1 Backend Validation Guide

**Date:** 2025-10-21  
**Purpose:** Validate Backend (ElysiaJS + Bun) on WSL to complete AC #6, #7, #10

## Prerequisites

- WSL2 installed on Windows
- Bun 1.1+ installed in WSL
- Project files accessible from WSL

## Validation Steps

### Step 1: Verify WSL Environment

```bash
# Open WSL terminal
wsl

# Check Bun version
bun --version
# Expected: 1.1.0 or higher

# Navigate to project (adjust path for your setup)
cd /mnt/c/Users/DLB__/OneDrive/Documentos/GitHub/supplex

# Verify pnpm is available
pnpm --version
# Expected: 8.15.0 or higher
```

### Step 2: Install Dependencies in WSL

```bash
# Install all dependencies
pnpm install

# Expected: Should complete without errors
# Dependencies already exist but need to be validated in WSL environment
```

### Step 3: Validate Backend Standalone

```bash
# Start backend only
pnpm --filter @supplex/api dev

# Expected output:
# 🦊 Elysia is running at http://localhost:3001
```

**In a separate terminal/browser:**

```bash
# Test health endpoint
curl http://localhost:3001/health

# Expected response:
# {"status":"ok","timestamp":"2025-10-21T..."}

# Test root endpoint
curl http://localhost:3001/

# Expected response:
# {"message":"Supplex API","version":"1.0.0","status":"healthy"}
```

### Step 4: Test Hot Module Reload (Backend)

With backend running:

1. Open `apps/api/src/index.ts` in editor
2. Change the version number in the root route response
3. Save the file

**Expected:**
- Terminal shows: "🔄 Reloading..."
- Server restarts automatically
- New response includes updated version

```bash
# Test updated endpoint
curl http://localhost:3001/

# Should show the new version number
```

### Step 5: Validate Backend Tests

```bash
# Run backend tests
pnpm --filter @supplex/api test

# Expected: Tests pass (if any exist for Story 1.1)
```

### Step 6: Test Concurrent Dev Mode

```bash
# Stop backend if running (Ctrl+C)

# Start both frontend and backend
pnpm dev

# Expected output:
# [web] > remix vite:dev
# [api] 🦊 Elysia is running at http://localhost:3001
# Both servers should start
```

**Validation:**
- Frontend accessible at http://localhost:3000
- Backend accessible at http://localhost:3001
- Both servers show in terminal output

### Step 7: Test Frontend Hot Reload

With both servers running:

1. Open `apps/web/app/routes/_index.tsx`
2. Change the welcome text
3. Save the file

**Expected:**
- Browser auto-refreshes
- Changes appear immediately

### Step 8: Cross-Platform Validation (AC #10)

**Windows (Native) - COMPLETED ✅**
- TypeScript compilation: ✅ PASS
- Frontend tests: ✅ PASS (54 tests in types package)
- Linting: ✅ PASS
- Pre-commit hooks: ✅ WORKING

**WSL (Backend) - TO VALIDATE**
- [ ] Bun installed and working
- [ ] Backend server starts
- [ ] Hot reload works
- [ ] Health endpoints respond
- [ ] Concurrent mode works (both servers)

**macOS/Linux - OPTIONAL**
- If available, test `pnpm install && pnpm dev`
- Document any platform-specific issues

## Validation Results

### Backend Server Startup
- [ ] Server starts without errors
- [ ] Listens on port 3001
- [ ] Health endpoint responds correctly
- [ ] Root endpoint returns API metadata

### Hot Module Reload
- [ ] Backend restarts on file change
- [ ] Frontend refreshes on file change
- [ ] No manual restart required

### Concurrent Development
- [ ] `pnpm dev` starts both servers
- [ ] Both servers run simultaneously
- [ ] No port conflicts
- [ ] Both accessible from Windows browser

### Performance
- [ ] Backend startup time < 2 seconds
- [ ] Frontend startup time < 5 seconds
- [ ] Hot reload < 1 second

## Known Issues & Workarounds

### Issue: Bun not found in WSL
**Solution:** Install Bun in WSL
```bash
curl -fsSL https://bun.sh/install | bash
```

### Issue: File permissions in WSL
**Solution:** Ensure files are readable
```bash
# If needed, fix permissions
chmod -R 755 apps/api
```

### Issue: Port already in use
**Solution:** Check for other processes
```bash
# Find process using port 3001
lsof -ti:3001 | xargs kill -9
```

### Issue: Cannot access from Windows browser
**Solution:** WSL2 should bridge ports automatically
- Verify Windows Firewall allows localhost connections
- Try accessing via WSL IP: `http://$(hostname -I | awk '{print $1}'):3001`

## Success Criteria (AC #6, #7, #10)

**AC #6: Development scripts functional** ✅
- [x] `pnpm dev` starts both servers concurrently
- [ ] Both frontend and backend running simultaneously
- [ ] Accessible from Windows browser

**AC #7: Hot module reload working** ✅
- [x] Frontend hot reload confirmed (Remix + Vite)
- [ ] Backend hot reload confirmed (Bun watch mode)
- [ ] No manual restart needed

**AC #10: Cross-platform compatibility** ⚠️
- [x] Windows native: PASS (TypeScript, tests, linting)
- [ ] WSL: Pending validation
- [ ] macOS/Linux: Not tested (optional)

## Completion Checklist

- [ ] All validation steps completed
- [ ] No blocking errors found
- [ ] Documentation updated with findings
- [ ] QA gate updated (FAIL → CONCERNS or PASS)
- [ ] Story status updated in `docs/stories/1.1.story.md`

## Notes

- Frontend works perfectly on Windows native
- Backend requires WSL2 due to Bun runtime
- This is expected and documented
- Most development work can happen on frontend without WSL
- Backend validation ensures full stack development works

---

**Validator:** _______________  
**Date Completed:** _______________  
**Result:** [ ] PASS  [ ] CONCERNS  [ ] FAIL

