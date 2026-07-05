---
name: pos-nursery dev API proxy
description: Frontend/backend split monorepo apps need vite server.proxy for /api, otherwise relative API fetches silently 404 in dev.
---

The pos-nursery frontend and api-server backend run as two separate workflows on different ports (e.g. frontend 22193, backend 8080). The frontend API client (`@workspace/api-client-react`) makes relative `fetch("/api/...")` calls with no `setBaseUrl` configured.

Without a `server.proxy` entry for `/api` in the frontend's `vite.config.ts`, those relative requests hit the Vite dev server itself (not the backend) and 404 — this can look like a login/session bug (login POST appears to "succeed" when tested directly against the backend, but the UI never navigates) when the real issue is the frontend never reaching the backend at all in dev.

**Why:** Spent significant effort chasing a session-cookie theory before discovering the frontend's relative `/api` calls weren't even reaching the backend process in the dev workflow.

**How to apply:** When a pnpm-workspace app splits frontend (Vite) and backend (Express) into separate workflows/ports and the client uses relative `/api` fetches, always add a `server.proxy` block in `vite.config.ts` forwarding `/api` to the backend's port (e.g. `http://localhost:8080`) for the dev workflow to function. Also check `queryClient.setQueryData`/invalidation is wired after login mutations, since React Query won't auto-refetch `currentUser` after a successful login unless the cache is explicitly updated.
