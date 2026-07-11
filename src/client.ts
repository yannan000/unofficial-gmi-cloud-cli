/**
 * GMI Cloud API client.
 *
 * Two surfaces:
 *  1. Studio / generative media (image, video, audio) — async request queue:
 *     https://console.gmicloud.ai/api/v1/ie/requestqueue/apikey
 *  2. LLM inference — OpenAI-compatible:
 *     https://api.gmi-serving.com/v1
 *
 * Auth: Bearer GMI_API_KEY (create at console.gmicloud.ai → API Keys).
 * Optional: X-Organization-ID header for multi-org accounts.
 */

export const STUDIO_BASE = "https://console.gmicloud.ai/api/v1/ie/requestqueue/apikey";
export const LLM_BASE = "https://api.gmi-serving.com/v1";

export interface GmiClientOptions {
  apiKey?: string;
  orgId?: string;
}

export interface GenerationRequest {
  request_id: string;
  model: string;
  status: RequestStatus;
  payload?: Record<string, unknown>;
  outcome?: Record<string, unknown>;
  reason?: string;
  created_at?: number;
  updated_at?: number;
  queued_at?: number;
}

export type RequestStatus =
  | "created"
  | "queued"
  | "dispatched"
  | "processing"
  | "success"
  | "failed"
  | "cancelled";

export const TERMINAL_STATUSES: RequestStatus[] = ["success", "failed", "cancelled"];

export class GmiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public body?: string,
  ) {
    super(message);
    this.name = "GmiError";
  }
}

export class GmiClient {
  private apiKey: string;
  private orgId?: string;

  constructor(opts: GmiClientOptions = {}) {
    const apiKey = opts.apiKey ?? process.env.GMI_API_KEY;
    if (!apiKey) {
      throw new GmiError(
        "Missing API key. Set GMI_API_KEY (create one at console.gmicloud.ai → API Keys).",
      );
    }
    this.apiKey = apiKey;
    this.orgId = opts.orgId ?? process.env.GMI_ORG_ID;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
    if (this.orgId) h["X-Organization-ID"] = this.orgId;
    return h;
  }

  private async request<T>(url: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(url, { ...init, headers: { ...this.headers(), ...init.headers } });
    const text = await res.text();
    if (!res.ok) {
      throw new GmiError(`GMI API ${res.status} ${res.statusText} for ${url}`, res.status, text);
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new GmiError(`Non-JSON response from ${url}`, res.status, text.slice(0, 500));
    }
  }

  // ---------- Studio: generative media (async request queue) ----------

  /** List Studio models (image, video, audio generation). */
  async listStudioModels(): Promise<unknown> {
    return this.request(`${STUDIO_BASE}/models`);
  }

  /** Get a Studio model's parameter schema and pricing. */
  async getStudioModel(modelId: string): Promise<unknown> {
    return this.request(`${STUDIO_BASE}/models/${encodeURIComponent(modelId)}`);
  }

  /** Submit an async generation job. Returns immediately with a request_id. */
  async createGeneration(model: string, payload: Record<string, unknown>): Promise<GenerationRequest> {
    return this.request(`${STUDIO_BASE}/requests`, {
      method: "POST",
      body: JSON.stringify({ model, payload }),
    });
  }

  /** Get the status / outcome of a generation job. */
  async getGeneration(requestId: string): Promise<GenerationRequest> {
    return this.request(`${STUDIO_BASE}/requests/${encodeURIComponent(requestId)}`);
  }

  /** Poll a job until it reaches a terminal status (success/failed/cancelled). */
  async waitForGeneration(
    requestId: string,
    opts: { intervalMs?: number; timeoutMs?: number; onPoll?: (r: GenerationRequest) => void } = {},
  ): Promise<GenerationRequest> {
    const interval = opts.intervalMs ?? 5000;
    const timeout = opts.timeoutMs ?? 10 * 60 * 1000;
    const start = Date.now();
    for (;;) {
      const r = await this.getGeneration(requestId);
      opts.onPoll?.(r);
      if (TERMINAL_STATUSES.includes(r.status)) return r;
      if (Date.now() - start > timeout) {
        throw new GmiError(`Timed out after ${timeout}ms waiting for request ${requestId} (last status: ${r.status})`);
      }
      await new Promise((res) => setTimeout(res, interval));
    }
  }

  /**
   * Upload a local file (e.g. a reference image for image-to-video) and get a
   * public URL usable in generation payloads.
   */
  async uploadFile(filename: string, bytes: Uint8Array, contentType = "application/octet-stream"): Promise<{ public_url: string }> {
    const grant = await this.request<{ upload_url: string; public_url: string }>(
      `${STUDIO_BASE}/upload-url`,
      { method: "POST", body: JSON.stringify({ filename }) },
    );
    const put = await fetch(grant.upload_url, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: bytes as unknown as BodyInit,
    });
    if (!put.ok) {
      throw new GmiError(`Upload failed: ${put.status} ${put.statusText}`, put.status, await put.text());
    }
    return { public_url: grant.public_url };
  }

  // ---------- Inference Engine: LLMs (OpenAI-compatible) ----------

  /** List available LLM models. */
  async listLlmModels(): Promise<unknown> {
    return this.request(`${LLM_BASE}/models`);
  }

  /** Simple non-streaming chat completion. */
  async chat(
    model: string,
    messages: Array<{ role: string; content: string }>,
    params: Record<string, unknown> = {},
  ): Promise<{ text: string; raw: unknown }> {
    const raw = await this.request<{
      choices?: Array<{ message?: { content?: string } }>;
    }>(`${LLM_BASE}/chat/completions`, {
      method: "POST",
      body: JSON.stringify({ model, messages, ...params }),
    });
    const text = raw.choices?.[0]?.message?.content ?? "";
    return { text, raw };
  }
}

/** Pull the media URLs out of a completed job's outcome, wherever they live. */
export function extractMediaUrls(outcome: Record<string, unknown> | undefined): string[] {
  if (!outcome) return [];
  const urls: string[] = [];
  const walk = (v: unknown): void => {
    if (typeof v === "string" && /^https?:\/\//.test(v)) urls.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(outcome);
  return [...new Set(urls)];
}
