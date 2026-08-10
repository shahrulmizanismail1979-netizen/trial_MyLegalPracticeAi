# Blockers Requiring Owner Action
Date: 2026-08-10

1. **ToyyibPay** — not integrated anywhere in the codebase. Needs: ToyyibPay merchant credentials + decision whether it should coexist with Stripe. Work completed: verified absence; Stripe covers all current billing. Safe state: Stripe-only. Next action: owner supplies ToyyibPay secret key + category code if wanted.
2. **New applications (MyClientAI client portal, MyLawResearch, MyJudicialAI)** — these do not exist as artifacts. Building each is a new product build (weeks of scope), affects pricing/entitlements. Next action: owner confirms which to build and their business model.
3. **Cross-portal shared firm/client database** — current design is per-portal silos with strict owner isolation (a security feature). Merging into one firm-wide client DB changes data-sharing semantics between subscriptions. Next action: owner decision.
4. **Voucher redemption path & dead admin RM pricing table** — business decisions parked in BUSINESS_RULE_CONFLICTS.md.
5. **Convey admin password change** — password is an environment secret by design; changing it requires an env update, not an in-app form.
6. **Publishing** — production still runs pre-audit code. All fixes (webhook crash, CORS, rate limiting, bundle-button fix, and this session's work) reach users only when the owner publishes.
