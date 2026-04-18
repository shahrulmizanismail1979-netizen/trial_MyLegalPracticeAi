import crypto from "crypto";

const SANDBOX_BASE = "https://www.billplz-sandbox.com/api/v3";
const PRODUCTION_BASE = "https://www.billplz.com/api/v3";

function getConfig() {
  const apiKey = process.env["BILLPLZ_API_KEY"];
  const collectionId = process.env["BILLPLZ_COLLECTION_ID"];
  const xSignatureKey = process.env["BILLPLZ_X_SIGNATURE_KEY"];
  const sandbox = process.env["BILLPLZ_SANDBOX"] !== "false";

  if (!apiKey || !collectionId) {
    throw new Error(
      "Billplz is not configured. Set BILLPLZ_API_KEY and BILLPLZ_COLLECTION_ID."
    );
  }

  return {
    apiKey,
    collectionId,
    xSignatureKey,
    baseUrl: sandbox ? SANDBOX_BASE : PRODUCTION_BASE,
  };
}

export function isBillplzConfigured(): boolean {
  return Boolean(
    process.env["BILLPLZ_API_KEY"] && process.env["BILLPLZ_COLLECTION_ID"]
  );
}

export interface CreateBillInput {
  name: string;
  email: string;
  mobile?: string;
  amountInCents: number;
  description: string;
  callbackUrl: string;
  redirectUrl: string;
  reference1Label?: string;
  reference1?: string;
  reference2Label?: string;
  reference2?: string;
}

export interface BillplzBill {
  id: string;
  url: string;
  paid: boolean;
  state: string;
  amount: number;
  email: string;
  mobile: string | null;
  name: string;
  collection_id: string;
  description: string;
}

export async function createBill(input: CreateBillInput): Promise<BillplzBill> {
  const cfg = getConfig();
  const body = new URLSearchParams();
  body.set("collection_id", cfg.collectionId);
  body.set("email", input.email);
  body.set("name", input.name);
  if (input.mobile) body.set("mobile", input.mobile);
  body.set("amount", String(input.amountInCents));
  body.set("callback_url", input.callbackUrl);
  body.set("redirect_url", input.redirectUrl);
  body.set("description", input.description.slice(0, 200));
  if (input.reference1Label) body.set("reference_1_label", input.reference1Label);
  if (input.reference1) body.set("reference_1", input.reference1);
  if (input.reference2Label) body.set("reference_2_label", input.reference2Label);
  if (input.reference2) body.set("reference_2", input.reference2);

  const auth = Buffer.from(`${cfg.apiKey}:`).toString("base64");

  const res = await fetch(`${cfg.baseUrl}/bills`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const data = (await res.json()) as BillplzBill | { error: unknown };
  if (!res.ok) {
    throw new Error(`Billplz createBill failed: ${JSON.stringify(data)}`);
  }
  return data as BillplzBill;
}

export async function getBill(billId: string): Promise<BillplzBill> {
  const cfg = getConfig();
  const auth = Buffer.from(`${cfg.apiKey}:`).toString("base64");
  const res = await fetch(`${cfg.baseUrl}/bills/${billId}`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Billplz getBill failed: ${JSON.stringify(data)}`);
  }
  return data as BillplzBill;
}

/**
 * Verify Billplz x_signature for callback (webhook) payloads.
 * Source string format: alphabetically sorted "key|value" pairs joined by "|".
 * For redirect (GET) callbacks the params are prefixed with "billplz" and the
 * source string uses keys like "billplzid", "billplzpaid", etc.
 */
export function verifyXSignature(
  params: Record<string, string>,
  signature: string,
  mode: "callback" | "redirect"
): boolean {
  const cfg = getConfig();
  if (!cfg.xSignatureKey) return false;

  const filtered = Object.entries(params).filter(
    ([k]) => k !== "x_signature" && k !== "billplzx_signature"
  );

  let sourceString: string;
  if (mode === "redirect") {
    const stripped = filtered
      .filter(([k]) => k.startsWith("billplz"))
      .map(([k, v]) => [k, v] as const)
      .sort(([a], [b]) => a.localeCompare(b));
    sourceString = stripped.map(([k, v]) => `${k}${v}`).join("|");
  } else {
    const sorted = filtered
      .map(([k, v]) => [k, v] as const)
      .sort(([a], [b]) => a.localeCompare(b));
    sourceString = sorted.map(([k, v]) => `${k}${v}`).join("|");
  }

  const computed = crypto
    .createHmac("sha256", cfg.xSignatureKey)
    .update(sourceString)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(computed, "hex"),
      Buffer.from(signature, "hex")
    );
  } catch {
    return false;
  }
}
