import { test } from "node:test";
import assert from "node:assert/strict";
import {
  itemsOf,
  toModelRow,
  renderModelsTable,
  renderModelDetail,
  renderTable,
  validatePayload,
  estimateCost,
} from "../src/ui.js";

test("itemsOf handles the real Studio shape {model_ids: [string]}", () => {
  const items = itemsOf({ model_ids: ["a", "b"] });
  assert.deepEqual(items, [{ id: "a" }, { id: "b" }]);
});

test("itemsOf handles OpenAI-style {data: [...]} and bare arrays", () => {
  assert.equal(itemsOf({ data: [{ id: "x" }] }).length, 1);
  assert.equal(itemsOf([{ id: "y" }]).length, 1);
  assert.deepEqual(itemsOf({ nothing: true }), []);
});

test("toModelRow formats per-token LLM pricing as $/M", () => {
  const row = toModelRow({
    id: "some/llm",
    pricing: [{ prompt: "0.000000800", completion: "0.000004800" }],
  });
  assert.equal(row.price, "$0.8/M in, $4.8/M out");
});

test("toModelRow prefers pricing_details for Studio models", () => {
  const row = toModelRow({ model: "m", model_type: "video", pricing_details: "$0.168 per second" });
  assert.equal(row.price, "$0.168 per second");
  assert.equal(row.type, "video");
});

test("renderModelsTable filters by substring and reports count", () => {
  const out = renderModelsTable({ model_ids: ["kling-v3", "veo-3", "kling-o1"] }, "kling");
  assert.ok(out?.includes("kling-v3"));
  assert.ok(!out?.includes("veo-3"));
  assert.ok(out?.includes('2 model(s) matching "kling"'));
});

test("renderModelsTable returns undefined for unknown shapes (JSON fallback)", () => {
  assert.equal(renderModelsTable({ weird: true }), undefined);
});

test("renderModelDetail renders the real parameters-array shape", () => {
  const out = renderModelDetail({
    model: "m",
    model_type: "video",
    pricing_details: "$1/s",
    parameters: [
      { name: "prompt", type: "string", required: true, description: "text" },
      { name: "duration", type: "enum", default_value: "5" },
    ],
  });
  assert.ok(out?.includes("prompt *"));
  assert.ok(out?.includes('"5"'));
});

test("renderModelDetail renders JSON-Schema style parameters", () => {
  const out = renderModelDetail({
    id: "m",
    parameters: { properties: { a: { type: "string" } }, required: ["a"] },
  });
  assert.ok(out?.includes("a *"));
});

test("renderTable truncates long cells", () => {
  const out = renderTable(["H"], [["x".repeat(100)]], 10);
  assert.ok(out.includes("x".repeat(9) + "…"));
});

test("validatePayload flags missing required and unknown params", () => {
  const detail = {
    parameters: [
      { name: "prompt", required: true },
      { name: "duration", required: false },
    ],
  };
  const check = validatePayload(detail, { duration: 5, bogus: 1 });
  assert.deepEqual(check?.missing, ["prompt"]);
  assert.deepEqual(check?.unknown, ["bogus"]);
});

test("validatePayload returns undefined when schema shape is unknown", () => {
  assert.equal(validatePayload({ parameters: "n/a" }, {}), undefined);
  assert.equal(validatePayload(undefined, {}), undefined);
});

test("estimateCost multiplies per-second price by duration", () => {
  const cost = estimateCost(
    { price_info: { price: 152000, unit: "second" } },
    { duration: 8 },
  );
  assert.equal(cost, "~$1.22 (8s × $0.152/s)");
});

test("estimateCost multiplies per-image price by max_images", () => {
  const cost = estimateCost(
    { price_info: { price: 35000, unit: "image" } },
    { max_images: 2 },
  );
  assert.equal(cost, "~$0.070 (2 × $0.035/image)");
});

test("estimateCost falls back to pricing_details text", () => {
  const cost = estimateCost({ pricing_details: "$0.126/second for standard" }, {});
  assert.equal(cost, "pricing: $0.126/second for standard");
});
