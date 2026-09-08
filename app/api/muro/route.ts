import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const [c, v, e] = await Promise.all([
    supabase.from("contribuciones").select("*").order("creado", { ascending: false }),
    supabase.from("votos").select("contribucion_id, autor_id, autor_nombre"),
    supabase.from("entrevistas").select("*").order("creado", { ascending: false }),
  ]);

  if (c.error || v.error || e.error) {
    return NextResponse.json({ error: "No se pudo leer el muro." }, { status: 500 });
  }

  return NextResponse.json(
    { contribuciones: c.data, votos: v.data, entrevistas: e.data },
    { headers: { "Cache-Control": "no-store" } }
  );
}
