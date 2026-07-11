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

/** Find the array of items in a response that may be [], {data}, {models}, etc. */
export function itemsOf(resp: unknown): Record<string, unknown>[] {
  if (Array.isArray(resp)) return resp as Record<string, unknown>[];
  if (resp && typeof resp === "object") {
    for (const key of ["data", "models", "items", "results", "list"]) {
      const v = (resp as Record<string, unknown>)[key];
      if (Array.isArray(v)) return v as Record<string, unknown>[];
    }
  }
  return [];
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
    price: firstString(m, ["price", "pricing", "cost", "price_per_unit", "unit_price"]),
    description: firstString(m, ["description", "desc", "summary"]).replace(/\s+/g, " "),
  };
}

export function renderModelsTable(resp: unknown, typeFilter?: string): string | undefined {
  const rows = itemsOf(resp).map(toModelRow).filter((r) => r.id);
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
  const headers = ["MODEL", ...(hasType ? ["TYPE"] : []), ...(hasPrice ? ["PRICE"] : []), "DESCRIPTION"];
  const body = filtered.map((r) => [
    r.id,
    ...(hasType ? [r.type] : []),
    ...(hasPrice ? [r.price] : []),
    r.description,
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
  if (row.description) out.push(`\n${row.description}`);

  // Parameter schema may live under several keys, possibly JSON-Schema shaped.
  const schema = (["parameters", "params", "schema", "payload_schema", "input_schema"] as const)
    .map((k) => m[k])
    .find((v) => v && typeof v === "object") as Record<string, unknown> | undefined;
  if (schema) {
    const props = (schema.properties ?? schema) as Record<string, unknown>;
    const required = new Set(Array.isArray(schema.required) ? (schema.required as string[]) : []);
    const rows: string[][] = [];
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
    if (rows.length > 0) {
      out.push("", "Parameters (* = required):", renderTable(["NAME", "TYPE", "DEFAULT", "DESCRIPTION"], rows));
    }
  }
  return out.length > 0 ? out.join("\n") : undefined;
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
