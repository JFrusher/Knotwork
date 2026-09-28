import { expect, test } from "vitest";
import { importShareKey, newShareKey, seal, unseal } from "./crypto";

/** The security properties of a guest link, as tests. */

test("every seal uses a fresh nonce", async () => {
  const { key } = await newShareKey();
  const a = await seal(key, { same: "value" });
  const b = await seal(key, { same: "value" });

  // Reusing a nonce under one key leaks the XOR of the two plaintexts. Identical
  // input must still produce different bytes.
  expect(a.iv).not.toBe(b.iv);
  expect(a.ciphertext).not.toBe(b.ciphertext);
});

test("tampered ciphertext is refused, not silently mangled", async () => {
  const { key } = await newShareKey();
  const sealed = await seal(key, { table: "Table 4" });

  const bytes = atob(sealed.ciphertext).split("");
  bytes[0] = String.fromCharCode(bytes[0]!.charCodeAt(0) ^ 0x01);
  const tampered = { ...sealed, ciphertext: btoa(bytes.join("")) };

  await expect(unseal(key, tampered)).rejects.toThrow();
});

test("the link's fragment is enough to read a guest link, and another key is not", async () => {
  const { key, encoded } = await newShareKey();
  const forGuests = await seal(key, { name: "Eleanor Vane", table: "Table 2" });

  expect(await unseal(await importShareKey(encoded), forGuests)).toEqual({
    name: "Eleanor Vane",
    table: "Table 2",
  });
  const { key: another } = await newShareKey();
  await expect(unseal(another, forGuests)).rejects.toThrow();
});

test("a share key survives a round trip through a URL fragment", async () => {
  const { encoded } = await newShareKey();
  const url = new URL(`https://example.test/s/abc#k=${encoded}`);
  expect(new URLSearchParams(url.hash.slice(1)).get("k")).toBe(encoded);
});
