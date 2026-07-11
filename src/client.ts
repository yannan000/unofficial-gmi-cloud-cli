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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function backoffMs(attempt: number): number {
  return 1000 * 2 ** attempt;
}

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

  /**
   * Fetch with retry. 429 retries for any method (the request was rejected,
   * not processed). 5xx and network errors retry only for GET — retrying a
   * failed POST /requests could double-submit a paid job.
   */
  private async request<T>(url: string, init: RequestInit = {}): Promise<T> {
    const method = (init.method ?? "GET").toUpperCase();
    const maxRetries = 3;
    for (let attempt = 0; ; attempt++) {
      let res: Response;
      try {
        res = await fetch(url, { ...init, headers: { ...this.headers(), ...init.headers } });
      } catch (e) {
        if (method === "GET" && attempt < maxRetries) {
          await sleep(backoffMs(attempt));
          continue;
        }
        throw new GmiError(`Network error for ${url}: ${String(e)}`);
      }
      const text = await res.text();
      if (res.ok) {
        try {
          return JSON.parse(text) as T;
        } catch {
          throw new GmiError(`Non-JSON response from ${url}`, res.status, text.slice(0, 500));
        }
      }
      const retryable = res.status === 429 || (method === "GET" && res.status >= 500);
      if (retryable && attempt < maxRetries) {
        const retryAfter = Number(res.headers.get("retry-after"));
        await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoffMs(attempt));
        continue;
      }
      throw new GmiError(`GMI API ${res.status} ${res.statusText} for ${url}`, res.status, text);
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

  /** List your recent generation jobs, optionally filtered by model. */
  async listGenerations(model?: string): Promise<{ requests: GenerationRequest[] }> {
    const qs = model ? `?model=${encodeURIComponent(model)}` : "";
    return this.request(`${STUDIO_BASE}/requests${qs}`);
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
   * public URL usable in generation payloads. The API accepts only these file
   * types (bare extension): jpeg, jpg, png, mp4, mp3, wav. The presigned PUT
   * is signed for a literal "<category>/<ext>" content type and expires in
   * ~15 minutes.
   */
  async uploadFile(filename: string, bytes: Uint8Array): Promise<{ public_url: string }> {
    const ext = filename.split(".").pop()?.toLowerCase() ?? "";
    const signedType: Record<string, string> = {
      jpeg: "image/jpeg",
      jpg: "image/jpg",
      png: "image/png",
      mp4: "video/mp4",
      mp3: "audio/mp3",
      wav: "audio/wav",
    };
    if (!signedType[ext]) {
      throw new GmiError(`Unsupported file type ".${ext}" — GMI accepts: ${Object.keys(signedType).join(", ")}`);
    }
    const grant = await this.request<{ upload_url: string; public_url: string }>(
      `${STUDIO_BASE}/upload-url`,
      { method: "POST", body: JSON.stringify({ file_type: ext }) },
    );
    const put = await fetch(grant.upload_url, {
      method: "PUT",
      headers: { "Content-Type": signedType[ext] },
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

  /** Streaming chat completion; calls onDelta per token, returns the full text. */
  async chatStream(
    model: string,
    messages: Array<{ role: string; content: string }>,
    params: Record<string, unknown>,
    onDelta: (chunk: string) => void,
  ): Promise<string> {
    const res = await fetch(`${LLM_BASE}/chat/completions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ model, messages, stream: true, ...params }),
    });
    if (!res.ok || !res.body) {
      throw new GmiError(`GMI API ${res.status} ${res.statusText} for chat/completions`, res.status, await res.text());
    }
    const decoder = new TextDecoder();
    let buffer = "";
    let full = "";
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const data = line.replace(/^data:\s*/, "").trim();
        if (!data || data === "[DONE]" || !line.startsWith("data:")) continue;
        try {
          const parsed = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> };
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            full += delta;
            onDelta(delta);
          }
        } catch {
          // partial/keepalive line — skip
        }
      }
    }
    return full;
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
