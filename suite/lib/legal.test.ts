import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { RETENTION_MONTHS as HANDLER_RETENTION } from "./documents/retention";
import { CONTROLLER, POLICIES, policyText, PRIVACY, RETENTION_MONTHS } from "./legal";

const digestOf = (text: string) => createHash("sha256").update(text).digest("hex").slice(0, 16);

/**
 * The effective date has to be true.
 *
 * A date claiming the reader was last told something in January, when the words
 * changed in June, is worse than no date at all. So the words are hashed and
 * the hash is recorded beside the date: change one without the other and this
 * fails, naming the value to paste in.
 */
test.each(POLICIES.map((policy) => [policy.title, policy] as const))(
  "%s: the effective date matches the words it belongs to",
  (_title, policy) => {
    const actual = digestOf(policyText(policy));
    expect(
      actual,
      `The ${policy.title} text has changed. Set updated to today and digest to "${actual}".`,
    ).toBe(policy.digest);
  },
);

test.each(POLICIES.map((policy) => [policy.title, policy] as const))(
  "%s: the effective date is a real date, not in the future",
  (_title, policy) => {
    const updated = new Date(policy.updated);
    expect(Number.isNaN(updated.getTime())).toBe(false);
    expect(updated.getTime()).toBeLessThanOrEqual(Date.now());
  },
);

test("the retention period quoted to the reader is the one the code enforces", () => {
  // The Privacy Policy states a number of months. The sweep deletes on that
  // number. Two places, and the one the reader sees is not the one that runs.
  expect(RETENTION_MONTHS).toBe(HANDLER_RETENTION);
  expect(policyText(PRIVACY)).toContain(`${HANDLER_RETENTION} months`);
});

test("a reader is given a way to make contact", () => {
  expect(policyText(PRIVACY)).toContain(CONTROLLER.email);
});

test("the visit counting the policy describes is the one the site runs", () => {
  // This used to assert that the policy said "no analytics" — which checked
  // the words against themselves, and so stayed green when Vercel's analytics
  // were added to the layout. It now reads the layout: if the counter is
  // there, the policy must name it and must not deny it; if it goes, so must
  // the description.
  const layout = readFileSync(join(process.cwd(), "app", "layout.tsx"), "utf8");
  const text = policyText(PRIVACY).toLowerCase();
  const counts = layout.includes("<PageCounts");
  const speed = layout.includes("<Speed");
  expect(text.includes("vercel web analytics")).toBe(counts);
  expect(text.includes("vercel speed insights")).toBe(speed);
  expect(text).not.toContain("no analytics");
  expect(text).not.toContain("the only third party");
});

test("nothing claims an absence that is no longer true", () => {
  // The cookie assertion used to be "no cookies are set". Accounts made that
  // false: @supabase/ssr keeps the session in one. The assertion now checks
  // the cookie is disclosed rather than denied, so the failure mode is the
  // same in the other direction — remove the disclosure and this fails.
  const text = policyText(PRIVACY).toLowerCase();
  expect(text).toContain("cookie");
  expect(text).not.toContain("no cookies are set");
  // The passphrase sync is gone; nothing may still describe it.
  expect(text).not.toContain("passphrase");
});
