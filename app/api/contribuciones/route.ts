import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { registrar } from "@/lib/participante";
import { texto, uuid } from "@/lib/validar";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const autor = await registrar(body);
  if (!autor.id) {
    return NextResponse.json({ error: "Identificate antes de publicar." }, { status: 400 });
  }

  const conSolucion = body.tipo === "problema-solucion";
  const fila = {
    titulo: texto(body.titulo, 80),
    quien: texto(body.quien, 90),
    problema: texto(body.problema, 500),
    hoy: texto(body.hoy, 350),
    evidencia: texto(body.evidencia, 300),
    solucion: conSolucion ? texto(body.solucion, 140) : "",
    tipo: conSolucion ? "problema-solucion" : "problema",
    autor_id: autor.id,
    autor_nombre: autor.nombre,
    autor_contacto: autor.contacto,
    padre_id: uuid(body.padre_id) || null,
  };

  if (fila.titulo.length < 10) {
    return NextResponse.json({ error: "Describe el problema en una frase completa." }, { status: 400 });
  }
  if (fila.quien.length < 3) {
    return NextResponse.json({ error: "Di quien tiene este problema." }, { status: 400 });
  }
  if (fila.problema.length < 20) {
    return NextResponse.json({ error: "Cuentanos que pasa exactamente." }, { status: 400 });
  }
  if (conSolucion && fila.solucion.length < 5) {
    return NextResponse.json({ error: "Escribe tu corazonada, aunque sea burda." }, { status: 400 });
  }

  const { error } = await supabase.from("contribuciones").insert(fila);
  if (error) {
    return NextResponse.json({ error: "No se pudo publicar. Intentalo de nuevo." }, { status: 500 });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
