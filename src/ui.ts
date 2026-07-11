/**
 * Terminal UI helpers: table rendering, progress spinner, model formatting.
 * All decorative output goes to stderr so stdout stays pipeable.
 */

// ---------- tables ----------

export function renderTable(headers: string[], rows: string[][], maxColWidth = 60): string {
  const all = [headers, ...rows];
  const widths = headers.map((_, c) =>
    Math.min(maxColWidth, Math.max(...all.map((r) => (r[c] ?? "").length))),
  );
  const line = (row: string[]) =>
    row.map((cell, c) => truncate(cell ?? "", widths[c]).padEnd(widths[c])).join("  ");
  return [line(headers), widths.map((w) => "-".repeat(w)).join("  "), ...rows.map(line)].join("\n");
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}

// ---------- defensive extraction from unknown API shapes ----------

/** Find the array of items in a response that may be [], {data}, {model_ids}, etc. */
export function itemsOf(resp: unknown): Record<string, unknown>[] {
  let arr: unknown[] = [];
  if (Array.isArray(resp)) arr = resp;
  else if (resp && typeof resp === "object") {
    for (const key of ["data", "models", "model_ids", "items", "results", "list"]) {
      const v = (resp as Record<string, unknown>)[key];
      if (Array.isArray(v)) {
        arr = v;
        break;
      }
    }
  }
  // Studio /models returns bare ID strings; normalize to objects.
  return arr.map((v) => (typeof v === "string" ? { id: v } : (v as Record<string, unknown>)));
}

function firstString(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v) return v;
    if (typeof v === "number") return String(v);
  }
  return "";
}

export interface ModelRow {
  id: string;
  type: string;
  price: string;
  description: string;
}

export function toModelRow(m: Record<string, unknown>): ModelRow {
  return {
    id: firstString(m, ["id", "model", "model_id", "name"]),
    type: firstString(m, ["type", "category", "modality", "task", "model_type"]),
    price: llmPrice(m.pricing) ?? firstString(m, ["pricing_details", "price", "cost", "price_per_unit", "unit_price"]),
    description: firstString(m, ["brief_description", "description", "desc", "summary"]).replace(/\s+/g, " "),
  };
}

/** LLM pricing comes as per-token strings; show as $/M tokens in/out. */
function llmPrice(pricing: unknown): string | undefined {
  if (!Array.isArray(pricing) || pricing.length === 0) return undefined;
  const t = pricing[0] as Record<string, unknown>;
  const perM = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? `$${+(n * 1e6).toFixed(2)}` : undefined;
  };
  const inP = perM(t.prompt);
  const outP = perM(t.completion);
  if (!inP && !outP) return undefined;
  return `${inP ?? "?"}/M in, ${outP ?? "?"}/M out`;
}

export function renderModelsTable(resp: unknown, typeFilter?: string): string | undefined {
  const rows = itemsOf(resp)
    .map(toModelRow)
    .filter((r) => r.id)
    .sort((a, b) => a.id.localeCompare(b.id));
  if (rows.length === 0) return undefined; // unknown shape — caller falls back to raw JSON
  const filtered = typeFilter
    ? rows.filter(
        (r) =>
          r.type.toLowerCase().includes(typeFilter.toLowerCase()) ||
          r.id.toLowerCase().includes(typeFilter.toLowerCase()),
      )
    : rows;
  const hasType = filtered.some((r) => r.type);
  const hasPrice = filtered.some((r) => r.price);
  const hasDesc = filtered.some((r) => r.description);
  const headers = [
    "MODEL",
    ...(hasType ? ["TYPE"] : []),
    ...(hasPrice ? ["PRICE"] : []),
    ...(hasDesc ? ["DESCRIPTION"] : []),
  ];
  const body = filtered.map((r) => [
    r.id,
    ...(hasType ? [r.type] : []),
    ...(hasPrice ? [r.price] : []),
    ...(hasDesc ? [r.description] : []),
  ]);
  return `${renderTable(headers, body)}\n\n${filtered.length} model(s)${typeFilter ? ` matching "${typeFilter}"` : ""}`;
}

/** Render a model detail (parameter schema) readably; undefined if shape is unrecognized. */
export function renderModelDetail(resp: unknown): string | undefined {
  if (!resp || typeof resp !== "object") return undefined;
  const m = resp as Record<string, unknown>;
  const out: string[] = [];
  const row = toModelRow(m);
  if (row.id) out.push(`Model:  ${row.id}`);
  if (row.type) out.push(`Type:   ${row.type}`);
  if (row.price) out.push(`Price:  ${row.price}`);
  const tags = m.tags;
  if (Array.isArray(tags) && tags.length > 0) out.push(`Tags:   ${tags.join(", ")}`);
  if (row.description) out.push(`\n${row.description}`);

  const rows: string[][] = [];
  const schema = (["parameters", "params", "schema", "payload_schema", "input_schema"] as const)
    .map((k) => m[k])
    .find((v) => v && typeof v === "object");

  if (Array.isArray(schema)) {
    // Real Studio shape: [{name, type, required, default_value, description}, ...]
    for (const spec of schema) {
      if (!spec || typeof spec !== "object") continue;
      const s = spec as Record<string, unknown>;
      const name = firstString(s, ["name", "display_name"]);
      if (!name) continue;
      rows.push([
        name + (s.required === true ? " *" : ""),
        firstString(s, ["type"]),
        s.default_value != null && s.default_value !== "" ? JSON.stringify(s.default_value) : "",
        firstString(s, ["description", "desc"]).replace(/\s+/g, " "),
      ]);
    }
  } else if (schema) {
    // JSON-Schema style: {properties: {...}, required: [...]}
    const sch = schema as Record<string, unknown>;
    const props = (sch.properties ?? sch) as Record<string, unknown>;
    const required = new Set(Array.isArray(sch.required) ? (sch.required as string[]) : []);
    for (const [name, spec] of Object.entries(props)) {
      if (!spec || typeof spec !== "object") continue;
      const s = spec as Record<string, unknown>;
      rows.push([
        name + (required.has(name) ? " *" : ""),
        firstString(s, ["type"]),
        s.default !== undefined ? JSON.stringify(s.default) : "",
        firstString(s, ["description", "desc"]).replace(/\s+/g, " "),
      ]);
    }
  }
  if (rows.length > 0) {
    out.push("", "Parameters (* = required):", renderTable(["NAME", "TYPE", "DEFAULT", "DESCRIPTION"], rows));
  }
  return out.length > 0 ? out.join("\n") : undefined;
}

// ---------- payload validation & cost estimation ----------

export interface PayloadCheck {
  missing: string[];
  unknown: string[];
}

/** Compare a payload against a model detail's parameters array (best-effort). */
export function validatePayload(detail: unknown, payload: Record<string, unknown>): PayloadCheck | undefined {
  if (!detail || typeof detail !== "object") return undefined;
  const params = (detail as Record<string, unknown>).parameters;
  if (!Array.isArray(params)) return undefined;
  const known = new Map<string, boolean>();
  for (const p of params) {
    if (p && typeof p === "object" && typeof (p as Record<string, unknown>).name === "string") {
      known.set((p as Record<string, unknown>).name as string, (p as Record<string, unknown>).required === true);
    }
  }
  if (known.size === 0) return undefined;
  const missing = [...known.entries()].filter(([k, req]) => req && payload[k] === undefined).map(([k]) => k);
  const unknown = Object.keys(payload).filter((k) => !known.has(k));
  return { missing, unknown };
}

/**
 * Best-effort cost estimate from a model detail's price_info
 * ({pricing_type, price (micro-dollars), unit}) and the payload.
 */
export function estimateCost(detail: unknown, payload: Record<string, unknown>): string | undefined {
  if (!detail || typeof detail !== "object") return undefined;
  const m = detail as Record<string, unknown>;
  const pi = m.price_info as Record<string, unknown> | undefined;
  const price = Number(pi?.price);
  if (!pi || !Number.isFinite(price) || price <= 0) {
    const text = m.pricing_details;
    return typeof text === "string" && text ? `pricing: ${text}` : undefined;
  }
  const perUnit = price / 1e6;
  const unit = String(pi.unit ?? pi.pricing_type ?? "unit");
  if (/second/i.test(unit)) {
    const secs = Number(payload.duration ?? payload.durationSeconds ?? payload.video_length);
    if (Number.isFinite(secs) && secs > 0) {
      return `~$${(perUnit * secs).toFixed(2)} (${secs}s × $${perUnit.toFixed(3)}/s)`;
    }
    return `$${perUnit.toFixed(3)} per second`;
  }
  if (/image/i.test(unit)) {
    const n = Number(payload.max_images ?? payload.n ?? 1) || 1;
    return `~$${(perUnit * n).toFixed(3)} (${n} × $${perUnit.toFixed(3)}/image)`;
  }
  return `$${perUnit.toFixed(4)} per ${unit}`;
}

// ---------- spinner ----------

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export interface Spinner {
  update(label: string): void;
  stop(finalLine?: string): void;
}

/**
 * Progress spinner on stderr with elapsed time. Falls back to plain
 * status-change lines when stderr is not a TTY (pipes, CI).
 */
export function startSpinner(label: string): Spinner {
  const start = Date.now();
  let current = label;

  const elapsed = () => {
    const s = Math.floor((Date.now() - start) / 1000);
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${String(s % 60).padStart(2, "0")}s`;
  };

  if (!process.stderr.isTTY) {
    console.error(`${label}...`);
    return {
      update(l) {
        if (l !== current) {
          current = l;
          console.error(`${l} (${elapsed()})`);
        }
      },
      stop(finalLine) {
        if (finalLine) console.error(`${finalLine} (${elapsed()})`);
      },
    };
  }

  let i = 0;
  const render = () => {
    process.stderr.write(`\r\x1b[2K${FRAMES[i++ % FRAMES.length]} ${current} (${elapsed()})`);
  };
  const timer = setInterval(render, 100);
  render();
  return {
    update(l) {
      current = l;
    },
    stop(finalLine) {
      clearInterval(timer);
      process.stderr.write("\r\x1b[2K");
      if (finalLine) console.error(`${finalLine} (${elapsed()})`);
    },
  };
}
