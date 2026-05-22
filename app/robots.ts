import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin",
          "/admin/",
          "/dashboard",
          "/dashboard/",
          "/settings",
          "/settings/",
          "/profile",
          "/profile/",
          "/messages",
          "/messages/",
          "/signin",
          "/signup",
          "/verify-email",
          "/order-success",
          "/order-successfull",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
