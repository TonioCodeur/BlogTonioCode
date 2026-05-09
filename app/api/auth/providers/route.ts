import { NextResponse } from "next/server";

const PROVIDERS = [
  { id: "github", label: "GitHub", envPrefix: "GITHUB" },
  { id: "google", label: "Google", envPrefix: "GOOGLE" },
  { id: "apple", label: "Apple", envPrefix: "APPLE" },
  { id: "microsoft", label: "Microsoft", envPrefix: "MICROSOFT" },
] as const;

export function GET() {
  const enabled = PROVIDERS.filter(
    (p) =>
      process.env[`${p.envPrefix}_CLIENT_ID`] &&
      process.env[`${p.envPrefix}_CLIENT_SECRET`],
  ).map((p) => ({ id: p.id, label: p.label }));

  return NextResponse.json(enabled, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
