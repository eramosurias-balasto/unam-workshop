import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { registrar } from "@/lib/participante";
import { texto, uuid } from "@/lib/validar";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const autor = await registrar(body);
  const contribucion = uuid(body.contribucion_id);

  if (!autor.id || !contribucion) {
    return NextResponse.json({ error: "Falta identidad o contribucion." }, { status: 400 });
  }

  const fila = {
    contribucion_id: contribucion,
    a_quien: texto(body.a_quien, 90),
    hizo: texto(body.hizo, 500),
    ultima: texto(body.ultima, 90),
    sorpresa: texto(body.sorpresa, 400),
    supuesto: texto(body.supuesto, 400),
    autor_id: autor.id,
    autor_nombre: autor.nombre,
  };

  if (fila.a_quien.length < 3) {
    return NextResponse.json({ error: "Describe a quien entrevistaste." }, { status: 400 });
  }
  if (fila.hizo.length < 15) {
    return NextResponse.json({ error: "Cuenta que hace hoy esa persona." }, { status: 400 });
  }

  const { error } = await supabase.from("entrevistas").insert(fila);
  if (error) {
    return NextResponse.json({ error: "No se pudo guardar la entrevista." }, { status: 500 });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
