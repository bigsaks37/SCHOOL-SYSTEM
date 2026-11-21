import { prisma } from "./prisma";

export type SmsEventType =
  | "ABSENCE_ALERT"
  | "FEE_RECEIPT"
  | "REPORT_PUBLISHED"
  | "BULK_PARENTS"
  | "BULK_DEBTORS"
  | "BULK_TEACHERS"
  | "MANUAL";

export interface SendSmsInput {
  recipientPhone: string;
  recipientName?: string | null;
  message: string;
  eventType: SmsEventType;
  sentById?: string | null;
}

/**
 * Normalizes Ghanaian phone numbers to 233XXXXXXXXX format for Arkesel / Hubtel.
 */
export function normalizeGhanaPhone(raw: string): string {
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.startsWith("233") && digits.length >= 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) {
    return `233${digits.slice(1)}`;
  }
  return digits;
}

export function getSmsGatewayConfig() {
  const provider = (process.env.SMS_PROVIDER || "ARKESEL").toUpperCase();
  const arkeselKey = (process.env.ARKESEL_API_KEY || "").trim();
  const hubtelId = (process.env.HUBTEL_CLIENT_ID || "").trim();
  const hubtelSecret = (process.env.HUBTEL_CLIENT_SECRET || "").trim();
  const senderId = (process.env.SMS_SENDER_ID || "SankofaSch").trim();

  const arkeselReady =
    Boolean(arkeselKey) && !arkeselKey.includes("replace_with");
  const hubtelReady =
    Boolean(hubtelId) &&
    Boolean(hubtelSecret) &&
    !hubtelId.includes("replace_with");

  const isLive =
    (provider === "ARKESEL" && arkeselReady) ||
    (provider === "HUBTEL" && hubtelReady);

  return {
    provider: isLive ? provider : "SIMULATION",
    configuredProvider: provider,
    isLive,
    senderId,
    arkeselKey,
    hubtelId,
    hubtelSecret,
  };
}

/**
 * Sends an SMS via Arkesel or Hubtel when live API keys are configured,
 * or saves cleanly in Simulation / Log Mode to the SmsLog Outbox table.
 */
export async function sendSms(input: SendSmsInput) {
  const phoneClean = input.recipientPhone?.trim();
  if (!phoneClean) return null;

  const normalized = normalizeGhanaPhone(phoneClean);
  const cfg = getSmsGatewayConfig();

  let status: "SIMULATED" | "SENT" | "FAILED" = "SIMULATED";
  let providerUsed: "SIMULATION" | "ARKESEL" | "HUBTEL" = "SIMULATION";
  let providerRef = `SIM-SMS-${Date.now().toString(36).toUpperCase()}-${Math.floor(
    100 + Math.random() * 900
  )}`;

  if (cfg.isLive && cfg.configuredProvider === "ARKESEL") {
    providerUsed = "ARKESEL";
    try {
      const res = await fetch("https://sms.arkesel.com/api/v2/sms/send", {
        method: "POST",
        headers: {
          "api-key": cfg.arkeselKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sender: cfg.senderId,
          message: input.message,
          recipients: [normalized],
        }),
      });
      const json = await res.json();
      status = res.ok && json.status === "success" ? "SENT" : "FAILED";
      providerRef = json.data?.[0]?.id || `ARK-${Date.now()}`;
    } catch {
      status = "FAILED";
      providerRef = `ARK-ERR-${Date.now()}`;
    }
  } else if (cfg.isLive && cfg.configuredProvider === "HUBTEL") {
    providerUsed = "HUBTEL";
    try {
      const auth = Buffer.from(
        `${cfg.hubtelId}:${cfg.hubtelSecret}`
      ).toString("base64");
      const res = await fetch("https://smsc.hubtel.com/v1/messages/send", {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          From: cfg.senderId,
          To: normalized,
          Content: input.message,
        }),
      });
      const json = await res.json();
      status = res.ok ? "SENT" : "FAILED";
      providerRef = json.MessageId || `HUB-${Date.now()}`;
    } catch {
      status = "FAILED";
      providerRef = `HUB-ERR-${Date.now()}`;
    }
  }

  return prisma.smsLog.create({
    data: {
      recipientName: input.recipientName || null,
      recipientPhone: phoneClean,
      message: input.message,
      eventType: input.eventType,
      provider: providerUsed,
      status,
      providerRef,
      sentById: input.sentById || null,
    },
  });
}

export async function sendBulkSms(
  recipients: Array<{ phone: string; name?: string | null; customMessage?: string }>,
  defaultMessage: string,
  eventType: SmsEventType,
  sentById?: string | null
) {
  const results = [];
  for (const r of recipients) {
    if (!r.phone?.trim()) continue;
    const saved = await sendSms({
      recipientPhone: r.phone,
      recipientName: r.name,
      message: r.customMessage || defaultMessage,
      eventType,
      sentById,
    });
    if (saved) results.push(saved);
  }
  return results;
}
