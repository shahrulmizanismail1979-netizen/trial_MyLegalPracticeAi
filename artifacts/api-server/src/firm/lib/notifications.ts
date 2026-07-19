import type { Logger } from "pino";
import type { Task, User } from "../db";
import { sendWhatsApp, sendSms } from "./twilio";

/**
 * In-app nudges are the primary reminder channel. If email is configured
 * (SMTP_* / EMAIL_FROM) a real send could be wired in here; until then we
 * clearly log the message so the action is auditable in the backend console.
 */
function emailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.EMAIL_FROM);
}

/**
 * Sends a WhatsApp reminder to a user, but only if they have explicitly
 * provided a phone number and consented (`whatsappOptIn`). Respecting consent
 * is mandatory: no opt-in, no message.
 *
 * Delivery goes through Twilio (Replit connector) and is best-effort and
 * non-blocking: it is fire-and-forget so a Twilio outage never delays or fails
 * the primary action (acknowledging a task, etc.). When Twilio is not yet
 * connected, the message is clearly logged as simulated so it stays auditable.
 */
export function sendWhatsAppReminder(
  log: Logger,
  task: Task,
  user: User | null,
  message: string,
): void {
  if (!user?.whatsappOptIn || !user.phone) return;
  const phone = user.phone;
  void (async () => {
    try {
      const result = await sendWhatsApp(phone, message);
      if (result) {
        log.info(
          { taskId: task.id, to: phone, channel: "whatsapp", sid: result.sid },
          `[WHATSAPP] Sent to ${phone} (sid ${result.sid})`,
        );
      } else {
        log.info(
          { taskId: task.id, to: phone, channel: "whatsapp" },
          `[WHATSAPP] (Twilio not connected, simulated) To ${phone}: ${message}`,
        );
      }
    } catch (err) {
      log.error(
        {
          taskId: task.id,
          to: phone,
          channel: "whatsapp",
          err: (err as Error).message,
        },
        `[WHATSAPP] Failed to send to ${phone}: ${(err as Error).message}`,
      );
    }
  })();
}

/**
 * Sends an SMS reminder to a user, but only if they have explicitly provided a
 * phone number and consented (`smsOptIn`). Respecting consent is mandatory: no
 * opt-in, no message.
 *
 * Delivery goes through Twilio (Replit connector) and is best-effort and
 * non-blocking: it is fire-and-forget so a Twilio outage never delays or fails
 * the primary action. When Twilio is not connected (or no sender number is
 * configured), the message is clearly logged as simulated so it stays auditable.
 */
export function sendSmsReminder(
  log: Logger,
  task: Task,
  user: User | null,
  message: string,
): void {
  if (!user?.smsOptIn || !user.phone) return;
  const phone = user.phone;
  void (async () => {
    try {
      const result = await sendSms(phone, message);
      if (result) {
        log.info(
          { taskId: task.id, to: phone, channel: "sms", sid: result.sid },
          `[SMS] Sent to ${phone} (sid ${result.sid})`,
        );
      } else {
        log.info(
          { taskId: task.id, to: phone, channel: "sms" },
          `[SMS] (Twilio not connected or no sender configured, simulated) To ${phone}: ${message}`,
        );
      }
    } catch (err) {
      log.error(
        {
          taskId: task.id,
          to: phone,
          channel: "sms",
          err: (err as Error).message,
        },
        `[SMS] Failed to send to ${phone}: ${(err as Error).message}`,
      );
    }
  })();
}

export function sendNudge(
  log: Logger,
  task: Task,
  owner: User | null,
  manager: User | null,
): void {
  const to = owner?.email ?? "unassigned";
  const message = `Reminder: "${task.title}" (${task.category}, priority needs attention) requires your action.`;
  if (emailConfigured()) {
    log.info(
      { taskId: task.id, to, channel: "email" },
      `[NUDGE EMAIL] To ${to}: ${message}`,
    );
  } else {
    log.info(
      { taskId: task.id, to, channel: "in-app+console" },
      `[NUDGE] (email not configured, simulated) To ${to}: ${message}`,
    );
  }
  // Additionally reach the owner over WhatsApp and/or SMS if they opted in.
  sendWhatsAppReminder(log, task, owner, message);
  sendSmsReminder(log, task, owner, message);
  if (manager?.email) {
    log.info(
      { taskId: task.id, to: manager.email, channel: "manager-cc" },
      `[NUDGE] Manager ${manager.email} notified about task "${task.title}".`,
    );
  }
}

export function notifyManager(
  log: Logger,
  task: Task,
  reason: string,
): void {
  log.info(
    { taskId: task.id, reason },
    `[MANAGER ALERT] Task "${task.title}": ${reason}`,
  );
}
