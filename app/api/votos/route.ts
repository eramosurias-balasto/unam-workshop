import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { registrar } from "@/lib/participante";
import { uuid } from "@/lib/validar";

export const dynamic = "force-dynamic";

/** Alterna "Yo trabajaria en esto". Cada voto es su propia fila: 40 personas votando
 *  a la vez no se pisan, y la cuenta sale de un count, nunca de un contador editable. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const autor = await registrar(body);
  const contribucion = uuid(body.contribucion_id);

  if (!autor.id || !contribucion) {
    return NextResponse.json({ error: "Falta identidad o contribucion." }, { status: 400 });
  }

  if (body.quitar === true) {
    const { error } = await supabase
      .from("votos")
      .delete()
      .eq("contribucion_id", contribucion)
      .eq("autor_id", autor.id);
    if (error) return NextResponse.json({ error: "No se pudo quitar el voto." }, { status: 500 });
    return NextResponse.json({ ok: true, votado: false });
  }

  const { error } = await supabase.from("votos").upsert(
    {
      contribucion_id: contribucion,
      autor_id: autor.id,
      autor_nombre: autor.nombre,
      autor_contacto: autor.contacto,
    },
    { onConflict: "contribucion_id,autor_id" }
  );
  if (error) return NextResponse.json({ error: "No se pudo votar." }, { status: 500 });
  return NextResponse.json({ ok: true, votado: true });
}
