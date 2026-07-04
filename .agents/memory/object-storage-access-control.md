---
name: Private object download access control
description: How /api/storage/objects/* is authorized and why staff auth works over plain browser navigation here.
---

# Private object serving is authorized by contribution status

`GET /api/storage/objects/*` serves files from `PRIVATE_OBJECT_DIR`. It is NOT
unconditionally public. Policy:

- If the object path matches a contribution whose `status === "approved"`, it is
  part of the public knowledge-base corpus → served to anyone.
- Otherwise (pending/rejected contribution, or an object tied to no contribution)
  → requires an authenticated allowlisted **staff** member (401 anonymous, 403
  non-staff).

**Why:** contributions are legal documents under review; anonymous download of
non-approved files is a data-exposure risk. Approved files must stay downloadable
because downstream apps consume the knowledge base.

**How to apply:**
- Use `checkStaff(req)` from `middlewares/requireAdmin.ts` for conditional
  (public-for-some, staff-only-for-others) authorization. It never writes to the
  response and returns `"anonymous" | "forbidden" | "staff"`. `requireStaff`
  (the throwing middleware) is only for fully-gated routes like `/admin`.
- **Key constraint:** the web app authenticates via the Clerk **session cookie**,
  not bearer tokens (`custom-fetch.ts` `setAuthTokenGetter` is Expo-only and must
  not be used on web). Because auth is a same-origin cookie, staff authorization
  works even for plain browser navigations (`<a href target=_blank>` downloads),
  not just `fetch`. Do not switch web download links to a bearer-token scheme —
  it would break, and it is unnecessary.
- Check status BEFORE calling `getObjectEntityFile`, so anonymous callers can't
  probe object existence (return 401 before any storage lookup).
