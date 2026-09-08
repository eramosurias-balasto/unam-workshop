import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { registrar } from "@/lib/participante";
import { texto, uuid } from "@/lib/validar";
import { ronda } from "@/lib/rondas";

export const dynamic = "force-dynamic";

/** Un comentario a las preguntas de la ronda abierta. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const autor = await registrar(body);
  const contribucion = uuid(body.contribucion_id);

  if (!autor.id || !contribucion) {
    return NextResponse.json({ error: "Falta identidad o contribucion." }, { status: 400 });
  }

  const cuerpo = texto(body.texto, 900);
  if (cuerpo.length < 10) {
    return NextResponse.json({ error: "Escribe al menos una frase completa." }, { status: 400 });
  }

  // La ronda la decide el servidor, no el cliente: si esta cerrada, no se
  // escribe, aunque alguien arme la peticion a mano.
  const { data: ajustes, error: errAjustes } = await supabase
    .from("ajustes")
    .select("ronda_abierta")
    .eq("id", 1)
    .single();

  if (errAjustes) {
    return NextResponse.json({ error: "No se pudo leer la ronda." }, { status: 500 });
  }

  const abierta = ajustes?.ronda_abierta ?? 0;
  if (!ronda(abierta)) {
    return NextResponse.json(
      { error: "No hay ronda abierta ahora mismo." },
      { status: 409 }
    );
  }

  const { error } = await supabase.from("respuestas").insert({
    contribucion_id: contribucion,
    ronda: abierta,
    texto: cuerpo,
    autor_id: autor.id,
    autor_nombre: autor.nombre,
  });

  if (error) {
    return NextResponse.json({ error: "No se pudo guardar tu comentario." }, { status: 500 });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
