import "server-only";
import { supabase } from "./supabase";
import { idParticipante, texto } from "./validar";

/** Registra o actualiza a quien escribe. Devuelve "" si el cuerpo no trae identidad valida. */
export async function registrar(body: Record<string, unknown>) {
  const id = idParticipante(body.autor_id);
  const nombre = texto(body.autor_nombre, 60);
  if (!id || nombre.length < 3) return { id: "", nombre: "", contacto: "" };

  const contacto = texto(body.autor_contacto, 80);
  const rol = body.rol === "profesor" ? "profesor" : "estudiante";

  // Solo se escribe si viene con valor: una segunda publicacion sin la
  // respuesta no debe borrar la que ya dio.
  const interes = texto(body.interes_taller, 10);
  const valido = ["si", "tal_vez", "no"].includes(interes);

  await supabase
    .from("participantes")
    .upsert(
      valido ? { id, nombre, contacto, rol, interes_taller: interes } : { id, nombre, contacto, rol },
      { onConflict: "id" }
    );

  return { id, nombre, contacto };
}
