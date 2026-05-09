import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { createI18nMiddleware } from "next-international/middleware";

const LOCALES = ["en", "fr"] as const;
const DEFAULT_LOCALE = "en";

const I18nMiddleware = createI18nMiddleware({
  locales: [...LOCALES],
  defaultLocale: DEFAULT_LOCALE,
  urlMappingStrategy: "rewrite",
});

const protectedRoutes = ["/dashboard", "/settings", "/profile", "/admin", "/pricing", "/order-success", "/order-successfull", "/messages", "/blog/new", "/categories/new"];
const authRoutes = ["/signin", "/signup"];

function stripLocale(pathname: string): string {
  for (const locale of LOCALES) {
    if (pathname === `/${locale}`) return "/";
    if (pathname.startsWith(`/${locale}/`)) return pathname.slice(locale.length + 1);
  }
  return pathname;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const localePath = stripLocale(pathname);

  const sessionCookie = getSessionCookie(request);
  const isAuthenticated = !!sessionCookie;

  // Redirect authenticated users away from auth pages
  if (
    isAuthenticated &&
    authRoutes.some((route) => localePath === route || localePath.startsWith(route + "/"))
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Redirect unauthenticated users to signin for protected routes
  if (
    !isAuthenticated &&
    protectedRoutes.some((route) => localePath === route || localePath.startsWith(route + "/"))
  ) {
    const signInUrl = new URL("/signin", request.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return I18nMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|static|.*\\..*|_next).*)"],
};
