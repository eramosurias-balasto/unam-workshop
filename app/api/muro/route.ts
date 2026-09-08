import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { esAnonimo, maxVotos } from "@/lib/ajustes";

export const dynamic = "force-dynamic";

/* Con nombres a la vista, el voto mide popularidad: la gente vota a sus
   amigos para acabar en su equipo. El muro sale anonimo por defecto y se
   destapa poniendo MURO_ANONIMO=0 en Railway, cuando toque formar equipos.
   Los nombres se quitan aqui, en el servidor: no basta con ocultarlos en
   la pantalla, porque cualquiera abre las herramientas del navegador. */
export async function GET() {
  const [c, v, e, r, a, i] = await Promise.all([
    supabase.from("contribuciones").select("*").order("creado", { ascending: false }),
    supabase.from("votos").select("contribucion_id, autor_id, autor_nombre"),
    supabase.from("entrevistas").select("*").order("creado", { ascending: false }),
    supabase.from("respuestas").select("*").order("creado", { ascending: true }),
    supabase.from("ajustes").select("ronda_abierta").eq("id", 1).maybeSingle(),
    supabase.from("participantes").select("interes_taller"),
  ]);

  if (c.error || v.error || e.error) {
    return NextResponse.json({ error: "No se pudo leer el muro." }, { status: 500 });
  }

  /* Las rondas son de la migracion 0002. Si todavia no corrio, estas dos
     consultas fallan y el muro tiene que seguir funcionando igual: sin
     rondas, pero en pie. Tumbar el muro entero a media clase por una
     tabla que aun no existe seria el peor intercambio posible. */
  const filasRespuestas = r.error ? [] : r.data;
  const rondaAbierta = a.error ? 0 : a.data?.ronda_abierta ?? 0;

  /* Cuentas agregadas de la pregunta sobre continuar el taller. Es la
     migracion 0003: si no corrio, salen en cero y nadie se entera. */
  const interes = { si: 0, tal_vez: 0, no: 0 };
  if (!i.error) {
    for (const fila of i.data) {
      const k = fila.interes_taller as keyof typeof interes;
      if (k in interes) interes[k] += 1;
    }
  }

  const oculto = esAnonimo();

  // autor_id se queda: es un identificador opaco y sin el no funcionan
  // "Mios" ni el boton de voto. Lo que se va es el nombre y el contacto.
  const contribuciones = oculto
    ? c.data.map((x) => ({ ...x, autor_nombre: "", autor_contacto: "" }))
    : c.data;
  const entrevistas = oculto ? e.data.map((x) => ({ ...x, autor_nombre: "" })) : e.data;
  const respuestas = oculto
    ? filasRespuestas.map((x) => ({ ...x, autor_nombre: "" }))
    : filasRespuestas;
  const votos = oculto ? v.data.map((x) => ({ ...x, autor_nombre: "" })) : v.data;

  return NextResponse.json(
    {
      contribuciones,
      votos,
      entrevistas,
      respuestas,
      anonimo: oculto,
      maxVotos: maxVotos(),
      rondaAbierta,
      interes,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
