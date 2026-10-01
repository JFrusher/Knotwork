import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { log, REQUEST_ID_HEADER } from "@/lib/server/log";

/**
 * Finish a sign-in wherever its link happens to land.
 *
 * `/auth/callback` is where the app asks Supabase to send people, and when the
 * project's redirect allowlist agrees, that is where they go. When it does not,
 * Supabase quietly falls back to the project's Site URL — so the link arrives
 * at `/?code=…`, nothing there exchanges it, and the user is returned to a page
 * telling them to sign in, having just done so. That happened on a real
 * deployment.
 *
 * Depending on a dashboard setting being right is not worth a broken sign-in,
 * so the exchange happens here instead: any path, any of the shapes a link can
 * take. The callback route stays, because it is still the correct destination
 * and is the only one that knows where an invite should go next.
 */

const CLEAN = ["code", "token_hash", "type"];

/**
 * What an incoming request id may look like. A caller's id is kept so a trace
 * can cross from their system into this one; anything else is replaced, so a
 * header cannot write arbitrary text into the log.
 */
const REQUEST_ID = /^[\w.:-]{1,128}$/;

function requestId(request: NextRequest): string {
  const presented = request.headers.get(REQUEST_ID_HEADER) ?? request.headers.get("x-correlation-id");
  return presented && REQUEST_ID.test(presented) ? presented : crypto.randomUUID();
}

/**
 * Every request gets an id, which the route handlers read back to tag their
 * log lines (`requestLog`) and which goes back to the caller on the response,
 * so a report from a browser can be found in the log.
 */
export async function proxy(request: NextRequest) {
  const id = requestId(request);
  const response = signsIn(request) ? await finishSignIn(request, id) : forward(request, id);
  response.headers.set(REQUEST_ID_HEADER, id);
  return response;
}

function forward(request: NextRequest, id: string): NextResponse {
  const headers = new Headers(request.headers);
  headers.set(REQUEST_ID_HEADER, id);
  return NextResponse.next({ request: { headers } });
}

function signsIn(request: NextRequest): boolean {
  const { searchParams, pathname } = request.nextUrl;
  // The overwhelmingly common case: no auth material, nothing to do.
  if (!searchParams.get("code") && !searchParams.get("token_hash")) return false;
  // The callback route does its own exchange, and knows about `next`.
  return pathname !== "/auth/callback";
}

async function finishSignIn(request: NextRequest, id: string): Promise<NextResponse> {
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");

  const destination = new URL(request.nextUrl);
  for (const key of CLEAN) destination.searchParams.delete(key);

  const response = NextResponse.redirect(destination);

  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const key = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
  // No accounts on this deployment. Strip the parameters and move on rather
  // than leaving a code sitting in the address bar.
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
      },
    },
  });

  try {
    const { error } = tokenHash
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" })
      : await supabase.auth.exchangeCodeForSession(code as string);
    if (error) {
      // Say so rather than dropping them on a page that just asks them to sign
      // in again. The session cookies already set on `response` stay set.
      destination.searchParams.set("signin", "failed");
      response.headers.set("location", destination.toString());
    }
  } catch (error) {
    log.child({ requestId: id }).error({ err: error }, "[accounts] proxy sign-in");
    destination.searchParams.set("signin", "failed");
    response.headers.set("location", destination.toString());
  }

  return response;
}

export const config = {
  // Everything a person can land on. Static assets and image optimisation can
  // never carry a sign-in link, and running on them would cost every request.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
