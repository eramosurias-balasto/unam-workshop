import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { registrar } from "@/lib/participante";
import { uuid } from "@/lib/validar";
import { maxVotos } from "@/lib/ajustes";

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

  /* Con votos ilimitados nadie prioriza: se vota todo lo que suena bien y
     el orden del muro deja de decir nada. Con cinco, votar cuesta algo.
     MURO_MAX_VOTOS=0 los vuelve ilimitados. */
  const max = maxVotos();
  if (max > 0) {
    // Los votos ya emitidos en OTRAS contribuciones. Revotar la misma es
    // idempotente y no debe consumir cuota.
    const { count, error: errCuenta } = await supabase
      .from("votos")
      .select("*", { count: "exact", head: true })
      .eq("autor_id", autor.id)
      .neq("contribucion_id", contribucion);

    if (errCuenta) {
      return NextResponse.json({ error: "No se pudo votar." }, { status: 500 });
    }
    if ((count ?? 0) >= max) {
      return NextResponse.json(
        {
          error: `Ya usaste tus ${max} votos. Quita uno para poder votar por este.`,
          sinCuota: true,
        },
        { status: 409 }
      );
    }
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
