import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import rateLimit from "express-rate-limit";
import { db, usersTable } from "../db";
import {
  CreateUserBody,
  ListUsersResponse,
  UpdateUserBody,
  UpdateUserParams,
  UpdateUserResponse,
  UpdateUserContactBody,
  UpdateUserContactParams,
  UpdateUserContactResponse,
} from "../apiZod";
import { requireManagerSession } from "../lib/managerSession";
import { firmScope, firmValues } from "../lib/workspace";

const router: IRouter = Router();

/**
 * Tight rate limit on user creation: prevents an attacker from rapidly
 * self-provisioning user accounts to acquire valid IDs for other checks.
 * 5 creations per hour per IP is generous for normal onboarding.
 */
const createUserRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many user creation requests. Please try again later." },
});

router.get("/users", async (_req, res): Promise<void> => {
  const users = await db
    .select()
    .from(usersTable)
    .where(firmScope(usersTable))
    .orderBy(usersTable.name);
  res.json(ListUsersResponse.parse(users));
});

router.post("/users", createUserRateLimit, async (req, res): Promise<void> => {
  // Creating users (including managers) is a manager-only operation —
  // otherwise any staff session could self-escalate by creating a manager
  // row and then using the manager login flow.
  if ((await requireManagerSession(req)) == null) {
    res.status(403).json({ error: "Manager authentication required." });
    return;
  }
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db
    .insert(usersTable)
    .values({
      name: parsed.data.name,
      role: parsed.data.role,
      title: parsed.data.title ?? null,
      email: parsed.data.email,
      activeStatus: parsed.data.activeStatus ?? true,
      ...firmValues(),
    })
    .returning();

  res.status(201).json(user);
});

router.patch("/users/:id", async (req, res): Promise<void> => {
  const params = UpdateUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if ((await requireManagerSession(req)) == null) {
    res.status(403).json({ error: "Only managers can change a user's role." });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({ role: parsed.data.role })
    .where(and(eq(usersTable.id, params.data.id), firmScope(usersTable)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  res.json(UpdateUserResponse.parse(updated));
});

router.patch("/users/:id/contact", async (req, res): Promise<void> => {
  const params = UpdateUserContactParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateUserContactBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Contact details (phone + WhatsApp opt-in) can drive outbound reminders, so
  // editing them is manager-only. "Self" cannot be verified in the no-auth
  // model — a caller-supplied actingUserId is spoofable — so the only
  // trustworthy authorization is a verified manager session.
  if ((await requireManagerSession(req)) == null) {
    res.status(403).json({
      error: "Only managers can update contact details.",
    });
    return;
  }

  const [existing] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.id, params.data.id), firmScope(usersTable)));

  if (!existing) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  const rawPhone = parsed.data.phone?.trim();
  const phone = rawPhone ? rawPhone : null;

  // Consent requires a phone number to be actionable.
  const optIn = parsed.data.whatsappOptIn && phone != null;
  const smsOptIn = (parsed.data.smsOptIn ?? false) && phone != null;

  const optInAt = optIn
    ? existing.whatsappOptInAt ?? new Date().toISOString()
    : null;
  const smsOptInAt = smsOptIn
    ? existing.smsOptInAt ?? new Date().toISOString()
    : null;

  const [updated] = await db
    .update(usersTable)
    .set({
      phone,
      whatsappOptIn: optIn,
      whatsappOptInAt: optInAt,
      smsOptIn,
      smsOptInAt,
    })
    .where(and(eq(usersTable.id, params.data.id), firmScope(usersTable)))
    .returning();

  req.log.info(
    {
      userId: updated.id,
      whatsappOptIn: updated.whatsappOptIn,
      smsOptIn: updated.smsOptIn,
    },
    `[CONTACT] ${updated.name} updated contact details (WhatsApp: ${updated.whatsappOptIn ? "on" : "off"}, SMS: ${updated.smsOptIn ? "on" : "off"}).`,
  );

  res.json(UpdateUserContactResponse.parse(updated));
});

export default router;
