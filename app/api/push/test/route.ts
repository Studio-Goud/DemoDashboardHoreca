import { NextRequest, NextResponse } from "next/server";
import { stuurPush, pushGeconfigureerd } from "@/lib/push";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const cfg = pushGeconfigureerd();
  if (!cfg.vapid || !cfg.kv) {
    return NextResponse.json(
      { error: "Push niet volledig geconfigureerd", cfg },
      { status: 500 }
    );
  }
  const result = await stuurPush(
    "Test notificatie",
    "Als je dit ziet werkt web push correct 🎉",
    { url: "/bb", tag: "test" }
  );
  return NextResponse.json(result);
}
