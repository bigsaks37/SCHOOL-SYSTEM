import "server-only";
import { neon } from "@neon/ai-sdk-provider";
import { generateText } from "ai";

export interface GatewayModelEntry {
  id: string;
  name?: string;
  owned_by?: string;
  enabled?: boolean;
  unavailable_reason?: string;
  recovery_url?: string;
}

export interface AiGatewayStatus {
  configured: boolean;
  reachable: boolean;
  baseUrl: string | null;
  totalModels: number;
  enabledModels: Array<{ id: string; name: string; ownedBy: string }>;
  firstEnabledModelId: string | null;
  unavailableReason: string | null;
  recoveryUrl: string | null;
  httpStatus: number | null;
}

export async function getAiGatewayStatus(): Promise<AiGatewayStatus> {
  const baseUrl = process.env.NEON_AI_GATEWAY_BASE_URL?.replace(/\/+$/, "");
  const token = process.env.NEON_AI_GATEWAY_TOKEN;

  if (!baseUrl || !token) {
    return {
      configured: false,
      reachable: false,
      baseUrl: null,
      totalModels: 0,
      enabledModels: [],
      firstEnabledModelId: null,
      unavailableReason: "not_configured",
      recoveryUrl: null,
      httpStatus: null,
    };
  }

  try {
    const res = await fetch(`${baseUrl}/v1/models`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return {
        configured: true,
        reachable: false,
        baseUrl,
        totalModels: 0,
        enabledModels: [],
        firstEnabledModelId: null,
        unavailableReason: `http_${res.status}`,
        recoveryUrl: null,
        httpStatus: res.status,
      };
    }

    const payload = (await res.json()) as { data?: GatewayModelEntry[] };
    const models = Array.isArray(payload.data) ? payload.data : [];
    const enabled = models.filter((m) => m.enabled === true);
    const firstDisabled = models.find((m) => m.enabled === false);

    return {
      configured: true,
      reachable: true,
      baseUrl,
      totalModels: models.length,
      enabledModels: enabled.map((m) => ({
        id: m.id,
        name: m.name || m.id,
        ownedBy: m.owned_by || "neon",
      })),
      firstEnabledModelId: enabled[0]?.id ?? null,
      unavailableReason:
        enabled.length === 0
          ? firstDisabled?.unavailable_reason ?? "no_enabled_models"
          : null,
      recoveryUrl:
        enabled.length === 0 ? firstDisabled?.recovery_url ?? null : null,
      httpStatus: res.status,
    };
  } catch (err) {
    console.error("[neon-ai-gateway] /v1/models check failed:", err);
    return {
      configured: true,
      reachable: false,
      baseUrl,
      totalModels: 0,
      enabledModels: [],
      firstEnabledModelId: null,
      unavailableReason: "network_error",
      recoveryUrl: null,
      httpStatus: null,
    };
  }
}

export async function draftSchoolContent(input: {
  kind: "announcement" | "report_remark";
  prompt: string;
  model?: string;
}): Promise<
  | { ok: true; text: string; model: string }
  | {
      ok: false;
      status: number;
      error: string;
      unavailableReason?: string | null;
      recoveryUrl?: string | null;
    }
> {
  const gateway = await getAiGatewayStatus();
  if (!gateway.configured) {
    return {
      ok: false,
      status: 503,
      error:
        "Neon AI Gateway is not configured. Run `neon deploy` to pull NEON_AI_GATEWAY_BASE_URL and NEON_AI_GATEWAY_TOKEN.",
    };
  }

  if (!gateway.firstEnabledModelId) {
    return {
      ok: false,
      status: 403,
      error:
        gateway.unavailableReason === "paid_plan_required"
          ? "Neon AI Gateway is connected and reachable, but requires prepaid AI Gateway credits before models can generate completions."
          : `No enabled models are currently available on Neon AI Gateway (${gateway.unavailableReason || "unknown"}).`,
      unavailableReason: gateway.unavailableReason,
      recoveryUrl: gateway.recoveryUrl,
    };
  }

  const chosenModel =
    input.model && gateway.enabledModels.some((m) => m.id === input.model)
      ? input.model
      : gateway.firstEnabledModelId;

  const system =
    input.kind === "announcement"
      ? "You are a helpful school communications officer for Sankofa Preparatory & JHS, a private basic school in Accra, Ghana. Write a clear, warm, concise parent/staff announcement ready to post on the school noticeboard. Use plain text without markdown headers."
      : "You are an experienced Ghanaian basic school teacher/headmaster writing concise, encouraging, constructive Terminal Report Card remarks (2–3 sentences) tailored to the student's performance. Return only the remark text.";

  try {
    const { text } = await generateText({
      model: neon(chosenModel),
      system,
      prompt: input.prompt,
    });
    return { ok: true, text: text.trim(), model: chosenModel };
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI Gateway request failed.";
    return {
      ok: false,
      status: 502,
      error: message,
      unavailableReason: gateway.unavailableReason,
      recoveryUrl: gateway.recoveryUrl,
    };
  }
}
