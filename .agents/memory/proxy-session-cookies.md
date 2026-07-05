---
name: Session cookies in path-routed artifacts
description: Why direct curl to a local service port shows auth/session as broken when it actually works fine through the real proxy.
---

In this monorepo's artifact system, each service (e.g. an Express API) is reachable at two different addresses:
- Directly on its `localPort` (e.g. `http://localhost:8080`) — plain HTTP, no forwarded-proto headers.
- Through the shared reverse proxy on the public dev domain, using the `previewPath` prefix (e.g. `https://<dev-domain>/api/...`) — HTTPS terminated upstream, forwarded via `X-Forwarded-Proto`.

If the session cookie config uses `secure: true` (recommended for `sameSite: "none"` cross-artifact cookies), `express-session` will silently refuse to emit `Set-Cookie` on requests that aren't seen as secure. A direct `curl http://localhost:<port>/...` has no forwarded-proto header, so even with `app.set("trust proxy", 1)`, the request looks insecure and no cookie is set — this looks exactly like a broken login/session, but isn't.

**Why:** Wasted significant effort suspecting a real auth bug from curl testing against localhost, when the actual login/session flow was correct all along.

**How to apply:** When verifying auth/session behavior for a Replit path-routed app (frontend at `/`, API at `/api`, etc.), always test through the public HTTPS dev domain (`https://$REPLIT_DEV_DOMAIN/api/...`), not `localhost:<port>` directly. Only fall back to direct localhost testing for logic that doesn't depend on cookies/session.
