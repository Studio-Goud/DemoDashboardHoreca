import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { bouwDataContext } from "@/lib/chat-context";
import type { Bedrijf } from "@/lib/sumup";
import { unstable_cache } from "next/cache";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

// Cache de system-prompt context 5 min per bedrijf. De prompt is ~kb's aan
// CSV-data; opnieuw bouwen per request zou onnodig zijn.
const getContextCached = unstable_cache(
  async (bedrijf: Bedrijf) => bouwDataContext(bedrijf),
  ["chat-context-v2"],
  { revalidate: 300, tags: ["chat"] }
);

interface ClientMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { bedrijf: string } }
) {
  const bedrijf = params.bedrijf as Bedrijf;
  if (!["bb", "sl"].includes(bedrijf)) {
    return NextResponse.json({ error: "Onbekend bedrijf" }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY ontbreekt in server env" },
      { status: 500 }
    );
  }

  let body: { messages?: ClientMessage[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON body" }, { status: 400 });
  }

  const messages = (body.messages ?? []).filter(
    (m) => m && typeof m.content === "string" && m.content.trim().length > 0
  );
  if (messages.length === 0) {
    return NextResponse.json(
      { error: "Minstens één bericht vereist" },
      { status: 400 }
    );
  }

  try {
    const context = await getContextCached(bedrijf);
    const client = new Anthropic();

    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 1024,
      // System-prompt met cache_control zodat herhaalde vragen binnen
      // hetzelfde bedrijf de grote data-context uit cache lezen (~0.1× cost).
      system: [
        {
          type: "text",
          text: context.systemPrompt,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const tekstBlokken = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    return NextResponse.json({
      antwoord: tekstBlokken,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        cache_read: response.usage.cache_read_input_tokens ?? 0,
        cache_creation: response.usage.cache_creation_input_tokens ?? 0,
      },
      stopReason: response.stop_reason,
    });
  } catch (err: unknown) {
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "Te veel verzoeken — probeer zo opnieuw." },
        { status: 429 }
      );
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: "Ongeldige ANTHROPIC_API_KEY in Vercel env." },
        { status: 401 }
      );
    }
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Claude API fout (${err.status}): ${err.message}` },
        { status: 500 }
      );
    }
    const msg = err instanceof Error ? err.message : "Onbekende fout";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
