import { NextResponse } from "next/server";
import { listProducten, createProduct } from "@/lib/voorraad";
import type { Bedrijf } from "@/lib/sumup";

export const dynamic = "force-dynamic";

const VALID: Bedrijf[] = ["bb", "sl", "kl"];
function isBedrijf(s: unknown): s is Bedrijf {
  return typeof s === "string" && (VALID as string[]).includes(s);
}

export async function GET(_req: Request, { params }: { params: { bedrijf: string } }) {
  if (!isBedrijf(params.bedrijf)) {
    return NextResponse.json({ error: "ongeldig bedrijf" }, { status: 400 });
  }
  try {
    const producten = await listProducten(params.bedrijf);
    return NextResponse.json({ producten });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "onbekend";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: { bedrijf: string } }) {
  if (!isBedrijf(params.bedrijf)) {
    return NextResponse.json({ error: "ongeldig bedrijf" }, { status: 400 });
  }
  try {
    const body = (await req.json()) as {
      naam?: string;
      eenheid?: string;
      categorie?: string;
      drempelKritiek?: number;
      drempelLaag?: number;
      kritiekProduct?: boolean;
      notitie?: string;
    };
    if (!body.naam || !body.naam.trim()) {
      return NextResponse.json({ error: "naam verplicht" }, { status: 400 });
    }
    const { id } = await createProduct({
      bedrijf: params.bedrijf,
      naam: body.naam.trim(),
      eenheid: body.eenheid,
      categorie: body.categorie,
      drempelKritiek: body.drempelKritiek,
      drempelLaag: body.drempelLaag,
      kritiekProduct: body.kritiekProduct,
      notitie: body.notitie,
    });
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "onbekend";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
