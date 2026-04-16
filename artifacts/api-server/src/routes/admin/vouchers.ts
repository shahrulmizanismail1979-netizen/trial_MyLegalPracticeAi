import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, vouchersTable, activityTable } from "@workspace/db";
import {
  CreateVoucherBody,
  UpdateVoucherParams,
  UpdateVoucherBody,
  UpdateVoucherResponse,
  DeleteVoucherParams,
  ListVouchersResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/vouchers", async (_req, res): Promise<void> => {
  const vouchers = await db
    .select()
    .from(vouchersTable)
    .orderBy(vouchersTable.createdAt);

  res.json(ListVouchersResponse.parse(vouchers));
});

router.post("/vouchers", async (req, res): Promise<void> => {
  const parsed = CreateVoucherBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [voucher] = await db
    .insert(vouchersTable)
    .values(parsed.data)
    .returning();

  await db.insert(activityTable).values({
    type: "voucher_created",
    description: `New voucher: ${parsed.data.code} (${parsed.data.discountType} ${parsed.data.discountValue})`,
  });

  res.status(201).json(UpdateVoucherResponse.parse(voucher));
});

router.patch("/vouchers/:id", async (req, res): Promise<void> => {
  const params = UpdateVoucherParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateVoucherBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [voucher] = await db
    .update(vouchersTable)
    .set(parsed.data)
    .where(eq(vouchersTable.id, params.data.id))
    .returning();

  if (!voucher) {
    res.status(404).json({ error: "Voucher not found" });
    return;
  }

  res.json(UpdateVoucherResponse.parse(voucher));
});

router.delete("/vouchers/:id", async (req, res): Promise<void> => {
  const params = DeleteVoucherParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [voucher] = await db
    .delete(vouchersTable)
    .where(eq(vouchersTable.id, params.data.id))
    .returning();

  if (!voucher) {
    res.status(404).json({ error: "Voucher not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
