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
  const [c, v, e] = await Promise.all([
    supabase.from("contribuciones").select("*").order("creado", { ascending: false }),
    supabase.from("votos").select("contribucion_id, autor_id, autor_nombre"),
    supabase.from("entrevistas").select("*").order("creado", { ascending: false }),
  ]);

  if (c.error || v.error || e.error) {
    return NextResponse.json({ error: "No se pudo leer el muro." }, { status: 500 });
  }

  const oculto = esAnonimo();

  // autor_id se queda: es un identificador opaco y sin el no funcionan
  // "Mios" ni el boton de voto. Lo que se va es el nombre y el contacto.
  const contribuciones = oculto
    ? c.data.map((x) => ({ ...x, autor_nombre: "", autor_contacto: "" }))
    : c.data;
  const entrevistas = oculto ? e.data.map((x) => ({ ...x, autor_nombre: "" })) : e.data;
  const votos = oculto ? v.data.map((x) => ({ ...x, autor_nombre: "" })) : v.data;

  return NextResponse.json(
    { contribuciones, votos, entrevistas, anonimo: oculto, maxVotos: maxVotos() },
    { headers: { "Cache-Control": "no-store" } }
  );
}
