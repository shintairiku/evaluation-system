import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/org(.*)',
  '/api/webhooks(.*)'
]);

export default clerkMiddleware(async (auth, req) => {
  // 公開ルート以外は認証を要求
  if (!isPublicRoute(req)) {
    const { userId, orgId } = await auth();
    
    if (!userId) {
      // 認証されていない場合、サインインページにリダイレクト
      const signInUrl = new URL('/sign-in', req.url);
      return NextResponse.redirect(signInUrl);
    }

    // 企業アカウント必須: 組織未所属なら org ページへリダイレクト
    if (!orgId) {
      const orgUrl = new URL('/org', req.url);
      return NextResponse.redirect(orgUrl);
    }
  }
});

export const config = {
  // The following matcher runs middleware on all routes
  // except static assets.
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
}; 