import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function celda(v: unknown) {
  return '"' + String(v ?? "").replace(/"/g, '""') + '"';
}

/** CSV del muro para agrupar problemas antes de la siguiente sesion.
 *  Protegido por MURO_PASSWORD: /api/export?clave=... */
export async function GET(req: Request) {
  const esperada = process.env.MURO_PASSWORD ?? "";
  const dada = new URL(req.url).searchParams.get("clave") ?? "";

  if (!esperada || dada !== esperada) {
    return NextResponse.json({ error: "Clave incorrecta." }, { status: 401 });
  }

  const [c, v, e] = await Promise.all([
    supabase.from("contribuciones").select("*").order("creado", { ascending: true }),
    supabase.from("votos").select("contribucion_id"),
    supabase.from("entrevistas").select("contribucion_id"),
  ]);

  if (c.error || v.error || e.error) {
    return NextResponse.json({ error: "No se pudo leer el muro." }, { status: 500 });
  }

  const nVotos = new Map<string, number>();
  for (const x of v.data) nVotos.set(x.contribucion_id, (nVotos.get(x.contribucion_id) ?? 0) + 1);
  const nEnt = new Map<string, number>();
  for (const x of e.data) nEnt.set(x.contribucion_id, (nEnt.get(x.contribucion_id) ?? 0) + 1);
  const titulos = new Map(c.data.map((x) => [x.id, x.titulo]));

  const cols = ["id", "tipo", "titulo", "quien", "problema", "hoy", "evidencia", "solucion",
                "autor", "contacto", "votos", "entrevistas", "deriva_de", "creado"];

  const filas = c.data.map((x) => [
    x.id, x.tipo, x.titulo, x.quien, x.problema, x.hoy, x.evidencia, x.solucion,
    x.autor_nombre, x.autor_contacto,
    nVotos.get(x.id) ?? 0, nEnt.get(x.id) ?? 0,
    x.padre_id ? titulos.get(x.padre_id) ?? "" : "",
    x.creado,
  ]);

  // BOM para que Excel en espanol respete los acentos.
  const csv = "\uFEFF" + [cols, ...filas].map((f) => f.map(celda).join(",")).join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="muro-de-problemas.csv"',
      "Cache-Control": "no-store",
    },
  });
}
