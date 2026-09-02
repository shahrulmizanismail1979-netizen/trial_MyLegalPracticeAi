# Customer Unsubscribe Portal

## What & Why
Add one clear, secure self-service route for Stripe subscribers to manage or cancel their LAWyes subscription. Users currently see “cancel anytime” messaging but have no visible way to reach Stripe's billing portal, causing legitimate complaints and avoidable support requests.

## Done looks like
- The LAWyes site clearly shows a “Manage or cancel subscription” action near the subscription/payment area and in the site footer
- A subscriber can verify ownership using their access code and subscription email, then open their own Stripe-hosted billing portal
- Stripe's portal lets the subscriber cancel, update payment details, and view billing history without exposing another customer's account
- Invalid or mismatched details show a neutral, helpful error without revealing whether an account exists
- Cancellation continues to deactivate portal access through the existing Stripe webhook flow
- Focused API and browser tests confirm the link is visible and the secure portal handoff works

## Out of scope
- Changing prices, checkout, product catalog, or subscription entitlements
- Replacing Stripe's hosted billing portal with a custom cancellation system
- Changing manually arranged firm, corporate, or academic agreements that are not billed through Stripe
- Adding any unrelated portal features or design changes

## Steps
1. **Secure billing-portal handoff** — Add a rate-limited endpoint that verifies the submitted access code and subscription email against the same subscriber record before creating a Stripe billing-portal session. Derive the return URL from trusted server configuration and return neutral errors for failed verification.
2. **Visible customer action** — Add a small subscription-management page and place a clear “Manage or cancel subscription” link in the public payment area and footer so users can find it without signing into a specific portal.
3. **Focused verification** — Test successful ownership verification, incorrect details, subscribers without Stripe billing accounts, safe return URLs, and browser visibility of the cancellation action.

## Relevant files
- `artifacts/api-server/src/routes/stripe.ts:199-352`
- `artifacts/api-server/src/lib/provisioning.ts`
- `artifacts/api-server/src/lib/cancellation.test.ts`
- `artifacts/landing-page/src/components/payment.tsx`
- `artifacts/landing-page/src/App.tsx:57-105`
- `lib/db/src/schema/subscribers.ts`
