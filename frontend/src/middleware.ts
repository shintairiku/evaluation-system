import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// 公開ルート（認証不要でアクセス可能）
const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhook(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  // ====== 認証を無効化する場合はここをコメントアウト ======
  // // 公開ルート以外は認証を要求
  // if (!isPublicRoute(req)) {
  //   const { userId } = await auth();
    
  //   if (!userId) {
  //     // 認証されていない場合、サインインページにリダイレクト
  //     const signInUrl = new URL('/sign-in', req.url);
  //     return NextResponse.redirect(signInUrl);
  //   }
  // }
  // ====== END OF SECTION TO COMMENT OUT ======
});

export const config = {
  // The following matcher runs middleware on all routes
  // except static assets.
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
}; 