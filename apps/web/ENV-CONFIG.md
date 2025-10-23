# Environment Variable Configuration - DO NOT BREAK

## Critical Files

This document describes the environment variable setup for Supabase authentication.
**Breaking this configuration will cause auth to fail silently with placeholder values.**

---

## Required Files and Their Roles

### 1. `apps/web/.env`
**Purpose:** Store actual Supabase credentials (never commit to git)

**Required Variables:**
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
API_URL=http://localhost:3001
SESSION_SECRET=your-secret-key-here
```

**DO NOT:**
- Delete this file
- Use placeholder values
- Commit this file to git (it's in .gitignore)

---

### 2. `apps/web/vite.config.ts`
**Purpose:** Expose environment variables to client-side code

**Critical Configuration:**
```typescript
envPrefix: ['VITE_', 'SUPABASE_', 'API_'],
```

**Why It Matters:**
- Vite only exposes env vars that start with these prefixes to `import.meta.env`
- Without this, client-side code cannot access SUPABASE_URL or SUPABASE_ANON_KEY
- Removing `'SUPABASE_'` or `'API_'` will break authentication

**DO NOT:**
- Remove `'SUPABASE_'` from envPrefix array
- Remove `'API_'` from envPrefix array
- Remove the envPrefix config entirely

---

### 3. `apps/web/app/lib/auth/supabase-client.ts`
**Purpose:** Initialize Supabase client with proper env var loading

**Critical Code Pattern:**
```typescript
const getSupabaseUrl = (): string => {
  if (typeof window !== 'undefined' && window.ENV?.SUPABASE_URL) {
    return window.ENV.SUPABASE_URL; // Browser: from server loader
  }
  return import.meta.env.SUPABASE_URL || process.env.SUPABASE_URL || '';
};
```

**Multi-Source Loading:**
1. **Browser:** Reads from `window.ENV` (set by root.tsx loader)
2. **Server:** Reads from `process.env` (Node.js env vars)
3. **Build:** Reads from `import.meta.env` (Vite-injected vars)

**DO NOT:**
- Change to single-source env loading (breaks SSR or client)
- Add fallback placeholder values (security risk)
- Remove `window.ENV` check (breaks client hydration)
- Remove `import.meta.env` check (breaks build-time)

---

### 4. `apps/web/app/root.tsx`
**Purpose:** Pass server env vars to client via window.ENV

**Critical Code:**
```typescript
return json({
  user,
  session,
  userRecord,
  env: {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    API_URL: process.env.API_URL || 'http://localhost:3001',
  },
});

// In component:
<script
  dangerouslySetInnerHTML={{
    __html: `window.ENV = ${JSON.stringify(env)};`,
  }}
/>
```

**DO NOT:**
- Remove env vars from the root loader
- Remove the window.ENV script injection
- Change env object structure

---

## How To Verify Configuration

### 1. Check .env file exists and has values:
```bash
cd apps/web
cat .env | grep SUPABASE
```

Should show:
```
SUPABASE_URL=https://mhyliteaqzzjvapnhmnv.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...
```

### 2. Check browser console after page load:
```javascript
console.log(window.ENV.SUPABASE_URL)
```

Should show your actual Supabase URL, NOT:
- `undefined`
- `https://placeholder.supabase.co`
- Empty string

### 3. Check network requests:
- Open DevTools Network tab
- Look for requests to Supabase
- URL should be `https://mhyliteaqzzjvapnhmnv.supabase.co`

---

## Common Mistakes That Break This

❌ **Removing envPrefix from vite.config.ts**
```typescript
// DON'T DO THIS:
export default defineConfig({
  plugins: [remix()],
  // Missing envPrefix - breaks client env access!
});
```

❌ **Using placeholder fallbacks**
```typescript
// DON'T DO THIS:
const url = env.SUPABASE_URL || 'https://placeholder.supabase.co';
// Silently fails with placeholder instead of real URL
```

❌ **Single-source env loading**
```typescript
// DON'T DO THIS:
const url = process.env.SUPABASE_URL; // Breaks in browser!
// or
const url = window.ENV.SUPABASE_URL; // Breaks on server!
```

❌ **Removing window.ENV injection**
```typescript
// DON'T DO THIS in root.tsx:
return json({ user, session }); // Missing env!
```

---

## Migration History

### Why This Configuration Exists

**Original Issue (2025-01-22):**
After migrating from `@supabase/auth-helpers-remix` to `@supabase/ssr`, environment variables stopped loading correctly. The app was using placeholder values (`https://placeholder.supabase.co`) instead of reading from the `.env` file.

**Root Cause:**
- `createBrowserClient` from `@supabase/ssr` requires different env handling
- Previous `process.env` access pattern didn't work in browser context
- Vite wasn't exposing SUPABASE_* vars to client

**Solution:**
Multi-source environment variable loading with priority:
1. Browser: window.ENV (from server)
2. Server: process.env (from .env)
3. Build: import.meta.env (from Vite)

---

## Troubleshooting

### Problem: "Using placeholder values"
**Symptoms:** Console shows `https://placeholder.supabase.co`

**Solutions:**
1. Check `apps/web/.env` exists and has SUPABASE_URL
2. Restart dev server to reload .env
3. Check vite.config.ts has envPrefix with 'SUPABASE_'
4. Check browser console: `window.ENV.SUPABASE_URL`

### Problem: "Auth not working"
**Symptoms:** Login fails, no errors in console

**Solutions:**
1. Verify SUPABASE_ANON_KEY is correct in .env
2. Check Network tab - requests going to correct Supabase project?
3. Verify root.tsx is passing env to client
4. Check supabase-client.ts isn't using fallback values

---

## Contact

If you need to modify this configuration, understand:
1. Why the multi-source pattern exists
2. How SSR + client hydration works in Remix
3. How Vite's envPrefix works
4. Where each source is used (server vs client vs build)

**When in doubt, don't change it.**

