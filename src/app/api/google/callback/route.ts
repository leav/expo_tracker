import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { openDatabase } from "../../../../db";
import { saveGoogleConnection } from "../../../../domain/settings";
import { googleAppOrigin, googleOAuthConfig, ownerEmailEnv } from "../../../../google/config";
import { exchangeAuthorizationCode, googleOAuthCallbackCheck } from "../../../../google/oauth";

export async function GET(request: Request) {
  const config = googleOAuthConfig();
  const origin = googleAppOrigin(config.ready ? config.redirectUri : undefined);
  const url = new URL(request.url);
  if (url.searchParams.get("error")) {
    return redirectSettings(origin, "Google connection was cancelled.");
  }
  if (!config.ready) return redirectSettings(origin, config.reason);

  const cookieStore = await cookies();
  const check = googleOAuthCallbackCheck({
    code: url.searchParams.get("code"),
    state: url.searchParams.get("state"),
    cookie: cookieStore.get("oauth_state")?.value,
    secret: config.sessionSecret,
    appOrigin: origin,
  });
  if (!check.ok) return redirectSettings(origin, check.error);

  try {
    const tokens = await exchangeAuthorizationCode(check.code);
    const result = saveGoogleConnection(openDatabase(), {
      ...tokens,
      ownerEmailEnv: ownerEmailEnv(),
    });
    if (!result.ok) return redirectSettings(origin, result.error);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google connection failed.";
    return redirectSettings(origin, message);
  }

  const response = NextResponse.redirect(new URL("/settings", origin));
  response.cookies.set("oauth_state", "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}

function redirectSettings(origin: string, message: string) {
  return NextResponse.redirect(new URL(`/settings?error=${encodeURIComponent(message)}`, origin));
}
