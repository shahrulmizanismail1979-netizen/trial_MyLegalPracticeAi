---
name: MyLawAcad (acad) integration pattern
description: How the donor AssessHub app was integrated as MyLawAcad and its security hardening
---

- Mounted at `/api/acad` with express-session scoped to the mount (cookie `acad.sid`, table `acad_user_sessions`); session field is `acadUserId` to avoid TS augmentation collision with sya's `userId`.
- Frontend freezes the donor generated client in-app; `custom-fetch` strips a leading `/api` and prepends the configured base (`/api/acad`) — donor apps' generated URLs already start with `/api/`.
- **Security hardening added on top of donor code** (donor shipped these holes):
  - Candidate exam routes (`/exams/:id*`) were fully unauthenticated (IDOR by session UUID). Guard: `router.use("/exams/:id")` middleware allowing any logged-in user OR valid `x-attempt-token` (HMAC of session id, mirroring the studio attempt pattern). Join endpoints (`/exam-templates/by-code/:code/attempts`) return `accessToken`; frontend stores it in sessionStorage `exam.session.<id>.token` and sets the client token getter.
  - OAuth `computeRedirectUri` must use `/api/acad/...`, not donor's `/api/...`.
  - Logout must clear cookie `acad.sid` (donor cleared `examhall.sid`).
- **Why:** any future donor-app port should be audited for unauthenticated UUID-bearer routes and hardcoded `/api/` paths before going live.
- First registered acad user auto-becomes admin — never register smoke-test users first in a fresh DB without deleting them after.
- Billing routes stubbed to 503 `billing_disabled`; prod deploy needs the 17 `acad_` tables SQL (/tmp/acad-migrations) run against prod DB.
