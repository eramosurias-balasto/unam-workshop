import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** Abre o cierra una ronda. Solo el profesor: pide MURO_PASSWORD.
 *  0 cierra todas. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const esperada = process.env.MURO_PASSWORD ?? "";
  if (!esperada || body.clave !== esperada) {
    return NextResponse.json({ error: "Clave incorrecta." }, { status: 401 });
  }

  const n = Number(body.ronda);
  if (!Number.isInteger(n) || n < 0 || n > 3) {
    return NextResponse.json({ error: "Ronda invalida." }, { status: 400 });
  }

  const { error } = await supabase
    .from("ajustes")
    .update({ ronda_abierta: n, actualizado: new Date().toISOString() })
    .eq("id", 1);

  if (error) {
    return NextResponse.json({ error: "No se pudo cambiar la ronda." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, ronda: n });
}
