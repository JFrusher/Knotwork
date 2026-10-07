import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The font engine loads with the tools that measure or embed fonts, never with
 * the shell every page shares.
 *
 * fontkit is 144 KB gzipped. It was on every page — the checklist, the money
 * page, the front page — because the shared store reads the card design, the
 * design starts from Place cards' defaults, and one constant among them was
 * imported from the module that measures text. Measured on a production build:
 * 522 KB of JavaScript shared by every page, 393 KB once it was cut.
 *
 * A grep-shaped test, as `offline.test.ts` is, and for the same reason: what is
 * being protected is the shape of the imports, which no unit test observes.
 * Static imports only — `import()` behind `next/dynamic` is exactly how a tool
 * is kept off the pages that do not use it.
 */

const ROOT = join(__dirname, "..");
const ENGINES = new Set(["fontkit", "@pdf-lib/fontkit"]);
const SHELLS = ["app/layout.tsx", "app/(app)/layout.tsx"];

function resolveSpec(from: string, spec: string): string | null {
  const base = spec.startsWith("@/") ? join(ROOT, spec.slice(2)) : spec.startsWith(".") ? join(dirname(from), spec) : null;
  if (base === null) return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** What a file imports statically: not `import type`, not `import()`. */
function staticImports(file: string): string[] {
  const source = readFileSync(file, "utf8");
  const specs: string[] = [];
  for (const match of source.matchAll(/^\s*(?:import|export)\s+(?!type\b)[^;]*?\bfrom\s+["']([^"']+)["']/gm)) specs.push(match[1]!);
  for (const match of source.matchAll(/^\s*import\s+["']([^"']+)["']/gm)) specs.push(match[1]!);
  return specs;
}

/** The chain of files from `start` to one importing a font engine, or null. */
function chainToEngine(start: string): string[] | null {
  const cameFrom = new Map<string, string | null>([[start, null]]);
  const queue = [start];
  while (queue.length > 0) {
    const file = queue.shift()!;
    for (const spec of staticImports(file)) {
      if (ENGINES.has(spec)) {
        const chain = [spec];
        for (let at: string | null = file; at !== null; at = cameFrom.get(at) ?? null) chain.unshift(relative(ROOT, at));
        return chain;
      }
      const next = resolveSpec(file, spec);
      if (next && !cameFrom.has(next)) {
        cameFrom.set(next, file);
        queue.push(next);
      }
    }
  }
  return null;
}

describe("the font engine", () => {
  it.each(SHELLS)("is not reachable from %s", (shell) => {
    expect(chainToEngine(join(ROOT, shell))).toBeNull();
  });

  it("is still found where it is used, so the walk is not silently finding nothing", () => {
    expect(chainToEngine(join(ROOT, "apps/stationery/core/text/fit.ts"))).toEqual([
      "apps/stationery/core/text/fit.ts",
      "apps/stationery/core/text/measure.ts",
      "fontkit",
    ]);
  });
});
