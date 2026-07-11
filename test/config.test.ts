import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEnv } from "../src/config.js";

test("parseEnv handles plain, quoted, and exported assignments", () => {
  const env = parseEnv(
    [
      "GMI_API_KEY=abc123",
      'QUOTED="hello world"',
      "SINGLE='v'",
      "export EXPORTED=yes",
      "# COMMENT=skipped",
      "EMPTY=",
      "not a var line",
    ].join("\n"),
  );
  assert.equal(env.GMI_API_KEY, "abc123");
  assert.equal(env.QUOTED, "hello world");
  assert.equal(env.SINGLE, "v");
  assert.equal(env.EXPORTED, "yes");
  assert.ok(!("COMMENT" in env));
  assert.ok(!("EMPTY" in env));
});

test("parseEnv keeps JWT-style values with dots and dashes intact", () => {
  const jwt = "eyJhbGciOi.something-with_dashes.signature";
  assert.equal(parseEnv(`GMI_API_KEY=${jwt}`).GMI_API_KEY, jwt);
});
