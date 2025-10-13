# Components

This section defines the major logical components across the Supplex fullstack system. Components are organized into three layers: **Frontend Components** (Remix application), **Backend Components** (ElysiaJS services), and **Shared Components** (monorepo packages).

## Frontend Components (Remix Application)

### Component 1: Authentication Module

**Responsibility:** Manages user authentication state, session management, and protected route access. Integrates with Supabase Auth for login/logout/registration.

**Key Interfaces:**

- `useAuth()` - React hook exposing current user, login/logout functions
- `requireAuth()` - Server-side loader utility enforcing authentication
- `getAuthenticatedUser()` - Extracts user from request session

**Dependencies:**

- Supabase Auth SDK (external)
- Session storage (cookies via Remix)
- User context provider (React Context)

**Technology Stack:**

- Remix session management (cookie-based)
- Supabase Auth client
- Zustand for client-side auth state

_(Additional component details follow...)_

---
