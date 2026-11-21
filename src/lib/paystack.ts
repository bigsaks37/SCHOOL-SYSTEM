/**
 * Paystack Ghana Payment Service Module (GHS — Mobile Money & Card)
 *
 * Reads PAYSTACK_PUBLIC_KEY and PAYSTACK_SECRET_KEY from environment variables.
 * - When real Paystack keys are configured, initializes/verifies against https://api.paystack.co.
 * - When placeholder keys are present (local testing), runs a deterministic simulation
 *   returning a verified PSK-SIM-* reference so the full checkout & receipt flow works offline.
 */

export interface PaystackInitParams {
  email: string;
  amountGhs: number;
  studentAdmissionNo: string;
  studentName: string;
  channelPreference: "mobile_money" | "card";
  momoNetwork?: "MTN" | "TELECEL" | "AT";
  momoPhone?: string;
  callbackUrl?: string;
}

export interface PaystackInitResult {
  mode: "LIVE" | "SIMULATION";
  reference: string;
  amountPesewas: number;
  currency: "GHS";
  authorizationUrl: string | null;
  status: "SUCCESS" | "PENDING";
  gatewayMessage: string;
}

export function getPaystackConfig() {
  const publicKey = process.env.PAYSTACK_PUBLIC_KEY || "";
  const secretKey = process.env.PAYSTACK_SECRET_KEY || "";
  const isConfigured =
    Boolean(publicKey) &&
    Boolean(secretKey) &&
    !publicKey.includes("replace_with") &&
    !secretKey.includes("replace_with");

  return {
    publicKey,
    secretKey,
    isConfigured,
    currency: "GHS" as const,
  };
}

export function generatePaystackReference(prefix = "PSK"): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${stamp}-${rand}`;
}

export async function initializePaystackTransaction(
  params: PaystackInitParams
): Promise<PaystackInitResult> {
  const { secretKey, isConfigured } = getPaystackConfig();
  const amountPesewas = Math.round(params.amountGhs * 100);
  const reference = generatePaystackReference(isConfigured ? "PSK" : "PSK-SIM");

  if (!isConfigured) {
    // Simulation mode for local development & demo testing
    const channelLabel =
      params.channelPreference === "mobile_money"
        ? `${params.momoNetwork || "MTN"} Mobile Money${params.momoPhone ? ` (${params.momoPhone})` : ""}`
        : "Visa / Mastercard (Paystack)";

    return {
      mode: "SIMULATION",
      reference,
      amountPesewas,
      currency: "GHS",
      authorizationUrl: null,
      status: "SUCCESS",
      gatewayMessage: `Simulated Paystack GHS checkout approved via ${channelLabel}`,
    };
  }

  // Live Paystack Ghana API integration
  const response = await fetch(
    "https://api.paystack.co/transaction/initialize",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: params.email,
        amount: amountPesewas,
        currency: "GHS",
        reference,
        channels: [params.channelPreference, "mobile_money", "card"],
        callback_url: params.callbackUrl,
        metadata: {
          student_id: params.studentAdmissionNo,
          student_name: params.studentName,
          momo_network: params.momoNetwork || null,
        },
      }),
    }
  );

  const json = await response.json();
  if (!response.ok || !json.status) {
    throw new Error(json.message || "Paystack transaction initialization failed.");
  }

  return {
    mode: "LIVE",
    reference: json.data.reference,
    amountPesewas,
    currency: "GHS",
    authorizationUrl: json.data.authorization_url,
    status: "PENDING",
    gatewayMessage: "Paystack checkout initialized.",
  };
}

export async function verifyPaystackTransaction(reference: string): Promise<{
  verified: boolean;
  mode: "LIVE" | "SIMULATION";
  status: string;
  amountGhs?: number;
}> {
  const { secretKey, isConfigured } = getPaystackConfig();
  if (!isConfigured || reference.startsWith("PSK-SIM-")) {
    return {
      verified: reference.startsWith("PSK-SIM-"),
      mode: "SIMULATION",
      status: "success",
    };
  }

  const response = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: { Authorization: `Bearer ${secretKey}` },
    }
  );
  const json = await response.json();
  return {
    verified: Boolean(json.status && json.data?.status === "success"),
    mode: "LIVE",
    status: json.data?.status || "failed",
    amountGhs: json.data?.amount ? json.data.amount / 100 : undefined,
  };
}
