import { NextResponse } from "next/server";
import { updateProduct, deleteProduct } from "@/lib/voorraad";

export const dynamic = "force-dynamic";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = (await req.json()) as {
      naam?: string;
      eenheid?: string;
      categorie?: string | null;
      drempelKritiek?: number;
      drempelLaag?: number;
      kritiekProduct?: boolean;
      notitie?: string | null;
      volgorde?: number;
    };
    await updateProduct(params.id, body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "onbekend";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    await deleteProduct(params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "onbekend";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
