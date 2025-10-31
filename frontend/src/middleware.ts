import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/org(.*)',
  '/api/webhooks(.*)',
  '/access-denied'
]);

const isAdminRoute = createRouteMatcher([
  '/evaluation-period-management(.*)',
  '/org-management(.*)',
  '/stage-management(.*)',
  '/competency-management(.*)',
  '/admin-goal-list(.*)'
]);

export default clerkMiddleware(async (auth, req) => {
  // 公開ルート以外は認証を要求
  if (!isPublicRoute(req)) {
    const { userId, orgId, orgRole } = await auth();

    if (!userId) {
      // 認証されていない場合、サインインページにリダイレクト（元のURLを保持）
      const signInUrl = new URL('/sign-in', req.url);
      const callbackPath = `${req.nextUrl.pathname}${req.nextUrl.search}`;
      if (callbackPath) {
        signInUrl.searchParams.set('redirect_url', callbackPath);
      }
      return NextResponse.redirect(signInUrl);
    }

    // 企業アカウント必須: 組織未所属なら org ページへリダイレクト
    if (!orgId) {
      const orgUrl = new URL('/org', req.url);
      return NextResponse.redirect(orgUrl);
    }

    // 管理者専用ルートのアクセス制御
    if (isAdminRoute(req)) {
      // org:adminロールを持っているかチェック
      if (orgRole !== 'org:admin') {
        // 管理者でない場合、アクセス拒否ページにリダイレクト
        const accessDeniedUrl = new URL('/access-denied', req.url);
        return NextResponse.redirect(accessDeniedUrl);
      }
    }
  }
});

export const config = {
  // The following matcher runs middleware on all routes
  // except static assets.
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
}; 
