import { test } from "node:test";
import assert from "node:assert/strict";
import { compareSemver, packageRoot } from "../src/update.js";
import { existsSync } from "node:fs";
import { join } from "node:path";

test("compareSemver orders versions correctly", () => {
  assert.ok(compareSemver("0.8.0", "0.7.9") > 0);
  assert.ok(compareSemver("0.7.0", "0.10.0") < 0); // numeric, not lexicographic
  assert.equal(compareSemver("1.2.3", "1.2.3"), 0);
  assert.ok(compareSemver("v1.0.0", "0.9.9") > 0); // tolerates v prefix
  assert.ok(compareSemver("1.0", "1.0.1") < 0); // missing segments = 0
});

test("packageRoot resolves to the package (has package.json)", () => {
  assert.ok(existsSync(join(packageRoot(), "package.json")));
});
