import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { litAccessCodes } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

// Fail-closed: if MASTER_ACCESS_CODE env var is not set, master login is disabled.
const MASTER_ACCESS_CODE = (process.env.MASTER_ACCESS_CODE ?? "").trim();

router.post("/login", async (req, res) => {
  const { password } = req.body;
  if (!password || typeof password !== "string") {
    return res.status(400).json({ error: "Access code is required" });
  }

  const code = password.trim().toUpperCase();

  try {
    if (MASTER_ACCESS_CODE && code === MASTER_ACCESS_CODE) {
      let [master] = await db
        .select()
        .from(litAccessCodes)
        .where(eq(litAccessCodes.code, MASTER_ACCESS_CODE))
        .limit(1);

      if (!master) {
        [master] = await db
          .insert(litAccessCodes)
          .values({
            code: MASTER_ACCESS_CODE,
            recipientName: "Master Override",
            recipientEmail: "master@mylitai.local",
            status: "active",
            compedAccess: true,
            notes: "Master overriding access — full access without payment.",
          })
          .returning();
      } else if (master.status !== "active" || !master.compedAccess) {
        [master] = await db
          .update(litAccessCodes)
          .set({ status: "active", compedAccess: true, expiresAt: null })
          .where(eq(litAccessCodes.id, master.id))
          .returning();
      }

      await db
        .update(litAccessCodes)
        .set({
          lastUsedAt: new Date(),
          usageCount: master.usageCount + 1,
        })
        .where(eq(litAccessCodes.id, master.id));

      const sess = req.session as unknown as Record<string, unknown>;
      sess.authenticated = true;
      sess.accessCodeId = master.id;

      return res.json({ success: true, message: "Login successful" });
    }

    const [record] = await db
      .select()
      .from(litAccessCodes)
      .where(eq(litAccessCodes.code, code))
      .limit(1);

    if (!record) {
      return res.status(401).json({ error: "Invalid or expired access code" });
    }

    if (record.status !== "active") {
      return res.status(401).json({ error: "Invalid or expired access code" });
    }

    if (record.expiresAt && record.expiresAt < new Date()) {
      await db
        .update(litAccessCodes)
        .set({ status: "expired" })
        .where(eq(litAccessCodes.id, record.id));
      return res.status(401).json({ error: "Invalid or expired access code" });
    }

    await db
      .update(litAccessCodes)
      .set({
        lastUsedAt: new Date(),
        usageCount: record.usageCount + 1,
      })
      .where(eq(litAccessCodes.id, record.id));

    const sess = req.session as unknown as Record<string, unknown>;
    sess.authenticated = true;
    sess.accessCodeId = record.id;

    return res.json({ success: true, message: "Login successful" });
  } catch (err) {
    req.log.error({ err }, "Login error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/verify", async (req, res) => {
  const sess = req.session as unknown as Record<string, unknown>;
  const authenticated = sess?.authenticated === true;
  const accessCodeId = sess?.accessCodeId as number | undefined;

  if (!authenticated || !accessCodeId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const [record] = await db
      .select()
      .from(litAccessCodes)
      .where(eq(litAccessCodes.id, accessCodeId))
      .limit(1);

    if (!record || record.status !== "active") {
      req.session.destroy(() => {});
      return res.status(401).json({ error: "Access code revoked or expired" });
    }

    if (record.expiresAt && record.expiresAt < new Date()) {
      await db
        .update(litAccessCodes)
        .set({ status: "expired" })
        .where(eq(litAccessCodes.id, record.id));
      req.session.destroy(() => {});
      return res.status(401).json({ error: "Access code expired" });
    }

    return res.json({ authenticated: true });
  } catch (err) {
    req.log.error({ err }, "Verify error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ message: "Logged out successfully" });
  });
});

export default router;
