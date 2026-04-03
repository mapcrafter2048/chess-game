import { NextResponse } from "next/server";
import { headers } from "next/headers";

export async function GET() {
  const headersList = await headers();
  const host = headersList.get("host") || "";

  const isMergeChess = host.includes("mergechess.org");

  const manifest = {
    name: isMergeChess
      ? "Merge Chess – Merge & Split Pieces Game"
      : "Combine Chess – Merge & Split Pieces Game",
    short_name: isMergeChess ? "Merge Chess" : "Combine Chess",
    description: isMergeChess
      ? "Play an innovative chess variant online: merge & split pieces, AI engine, and peer-to-peer multiplayer."
      : "Play an innovative chess variant online: combine & split pieces, AI engine, and peer-to-peer multiplayer.",
    start_url: "/",
    display: "standalone",
    background_color: "#0d0d0d",
    theme_color: "#0d0d0d",
    icons: [
      {
        src: "/logo.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json",
    },
  });
}
