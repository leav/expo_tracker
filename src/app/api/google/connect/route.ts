import { NextResponse } from "next/server";
import { googleAppOrigin, googleConnectHostRedirect, googleOAuthConfig } from "../../../../google/config";
import { createOAuthState, googleAuthorizationUrl } from "../../../../google/oauth";

export async function GET(request: Request) {
  const config = googleOAuthConfig();
  const origin = googleAppOrigin(config.ready ? config.redirectUri : undefined);
  if (!config.ready) {
    return NextResponse.redirect(settingsError(origin, config.reason));
  }
  const hostRedirect = googleConnectHostRedirect(request.headers.get("host"), config.redirectUri);
  if (hostRedirect) {
    return NextResponse.redirect(hostRedirect);
  }
  const state = createOAuthState(config.sessionSecret);
  const url = googleAuthorizationUrl(state);
  if (typeof url !== "string") {
    return NextResponse.redirect(settingsError(origin, url.error));
  }
  const response = NextResponse.redirect(url);
  response.cookies.set("oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return response;
}

function settingsError(origin: string, message: string) {
  return new URL(`/settings?error=${encodeURIComponent(message)}`, origin);
}
