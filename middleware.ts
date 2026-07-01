export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    "/",
    "/approvals/:path*",
    "/announcements/:path*",
    "/tasks/:path*",
    "/issues/:path*",
    "/audits/:path*",
    "/inventory/:path*",
    "/notifications/:path*",
    "/services/:path*",
    "/settings/:path*",
    "/admin/:path*"
  ]
};
