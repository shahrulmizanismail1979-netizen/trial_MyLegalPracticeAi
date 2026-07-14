import { Resend } from "resend";

// Shared access-code email delivery (used by the admin panel for manual code
// issuance, and by self-service Stripe provisioning after a purchase).

const RESEND_API_KEY = process.env.RESEND_API_KEY;

export function buildFromAddress(): string {
  const raw = (process.env.RESEND_FROM_EMAIL || "").trim();
  if (raw && raw.includes("@")) {
    if (raw.includes("<")) return raw;
    return `MyLitAi <${raw}>`;
  }
  return "MyLitAi <onboarding@resend.dev>";
}

export function buildAccessCodeEmailHtml(
  recipientName: string,
  codes: string[],
  expiresAt?: Date | null,
): string {
  const codeList = codes
    .map(
      (c) =>
        `<div style="margin:12px 0;background:#0f172a;border:1px solid #d4a017;border-radius:8px;padding:16px 24px;text-align:center;">
          <span style="font-family:monospace;font-size:22px;font-weight:bold;letter-spacing:4px;color:#d4a017;">${c}</span>
        </div>`,
    )
    .join("");

  const expiryNote = expiresAt
    ? `<p style="color:#94a3b8;font-size:14px;margin-top:8px;">Your access expires on <strong style="color:#f1f5f9;">${expiresAt.toLocaleDateString(
        "en-MY",
        { day: "2-digit", month: "long", year: "numeric" },
      )}</strong>.</p>`
    : "";

  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Georgia',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:12px;border:1px solid #d4a01733;overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:32px 40px;text-align:center;border-bottom:2px solid #d4a017;">
              <p style="margin:0 0 8px;font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#d4a017;">Malaysian Litigation AI Platform</p>
              <h1 style="margin:0;font-size:28px;color:#f1f5f9;font-family:'Georgia',serif;font-weight:bold;">MyLitAi</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 16px;font-size:16px;color:#f1f5f9;">Dear ${recipientName},</p>
              <p style="margin:0 0 24px;font-size:15px;color:#94a3b8;line-height:1.7;">
                Welcome to <strong style="color:#d4a017;">MyLitAi</strong> — your AI-powered Malaysian civil litigation platform. Below ${codes.length === 1 ? "is your unique access code" : "are your unique access codes"}. Please keep ${codes.length === 1 ? "it" : "them"} confidential.
              </p>

              ${codeList}

              ${expiryNote}

              <div style="margin:32px 0 0;padding:20px 24px;background:#0f172a;border-radius:8px;border-left:3px solid #d4a017;">
                <p style="margin:0 0 8px;font-size:13px;font-weight:bold;color:#d4a017;letter-spacing:1px;text-transform:uppercase;">How to login</p>
                <ol style="margin:8px 0 0;padding-left:20px;color:#94a3b8;font-size:14px;line-height:1.8;">
                  <li>Visit the MyLitAi platform</li>
                  <li>Enter your access code exactly as shown above</li>
                  <li>Click <strong style="color:#f1f5f9;">Enter Platform</strong></li>
                </ol>
              </div>

              <p style="margin:28px 0 0;font-size:13px;color:#64748b;line-height:1.7;">
                If you have any questions, please contact the platform administrator.<br>
                Do not share this code — each code is personal and access may be revoked if misused.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #1e293b;text-align:center;">
              <p style="margin:0;font-size:12px;color:#475569;">
                MyLitAi — AI-Powered Malaysian Litigation Practice<br>
                <span style="color:#334155;">Profesor Madya Dr Shahrul Mizan Ismail, Faculty of Law, UKM</span>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendAccessCodeEmail(
  recipientName: string,
  recipientEmail: string,
  codes: string[],
  expiresAt?: Date | null,
): Promise<{ success: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set — skipping email");
    return { success: false, error: "Email not configured" };
  }

  const resend = new Resend(RESEND_API_KEY);
  const subject =
    codes.length === 1
      ? "Your MyLitAi Access Code"
      : `Your MyLitAi Access Codes (${codes.length})`;

  const { error } = await resend.emails.send({
    from: buildFromAddress(),
    to: recipientEmail,
    subject,
    html: buildAccessCodeEmailHtml(recipientName, codes, expiresAt),
  });

  if (error) {
    console.error("Resend email error:", error);
    return { success: false, error: error.message };
  }
  return { success: true };
}
