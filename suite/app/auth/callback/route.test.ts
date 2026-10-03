import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const firstSignInHandler = vi.fn(async () => ({ status: 200, body: {} }));
vi.mock("@/lib/accounts/serverClient", () => ({ serverClient: async () => ({ auth: { getUser } }) }));
vi.mock("@/lib/accounts/handlers", () => ({ firstSignInHandler }));
vi.mock("@/lib/accounts/supabaseStore", () => ({ accountsStore: () => ({}) }));

const { GET, sameOriginPath, startsAWedding } = await import("./route");

const origin = "https://good.example";

describe("sameOriginPath", () => {
  it("passes through a normal same-site path unchanged", () => {
    expect(sameOriginPath("/invite/abc123", origin)).toBe("/invite/abc123");
  });

  it("keeps the query and hash of a same-site path", () => {
    expect(sameOriginPath("/account?tab=1#top", origin)).toBe("/account?tab=1#top");
  });

  it("falls back to /account when next is missing", () => {
    expect(sameOriginPath(null, origin)).toBe("/account");
  });

  it("rejects a protocol-relative URL", () => {
    expect(sameOriginPath("//evil.com", origin)).toBe("/account");
  });

  it("rejects the backslash bypass that a prefix-regex guard would miss", () => {
    // new URL() normalises \ to / for http/https before parsing, so this
    // resolves to https://evil.com/ even though it starts with a single "/".
    expect(sameOriginPath("/\\evil.com", origin)).toBe("/account");
    expect(sameOriginPath("/\\/evil.com", origin)).toBe("/account");
  });

  it("rejects an absolute URL to a different origin", () => {
    expect(sameOriginPath("https://evil.com/", origin)).toBe("/account");
  });

  it("rejects an absolute URL to the same origin but a different scheme/port (still an origin mismatch)", () => {
    expect(sameOriginPath("http://good.example", origin)).toBe("/account");
  });
});

describe("startsAWedding", () => {
  it("starts one on an ordinary sign-in", () => {
    expect(startsAWedding("/account")).toBe(true);
    expect(startsAWedding("/seating")).toBe(true);
  });

  it("does not on the way to an invite, which would block joining it", () => {
    expect(startsAWedding("/invite/abc123")).toBe(false);
  });

  it("does not for a planner arriving at their clients' weddings", () => {
    expect(startsAWedding("/weddings")).toBe(false);
  });
});

describe("GET", () => {
  beforeEach(() => {
    getUser.mockReset();
    firstSignInHandler.mockClear();
  });

  it("reports a provider's refusal as a failed sign-in, not a silent return", async () => {
    const response = await GET(
      new Request(`${origin}/auth/callback?error=access_denied&error_description=cancelled&next=%2Fweddings`),
    );
    expect(response.headers.get("location")).toBe(`${origin}/weddings?signin=failed`);
    expect(firstSignInHandler).not.toHaveBeenCalled();
  });

  it("finishes a sign-in already made in the browser — an emailed code — by starting the wedding", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    const response = await GET(new Request(`${origin}/auth/callback`));
    expect(firstSignInHandler).toHaveBeenCalledWith(expect.anything(), "u1");
    expect(response.headers.get("location")).toBe(`${origin}/account`);
  });

  it("with no session and nothing to exchange, just goes on", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const response = await GET(new Request(`${origin}/auth/callback?next=%2Fguests`));
    expect(firstSignInHandler).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(`${origin}/guests`);
  });
});
