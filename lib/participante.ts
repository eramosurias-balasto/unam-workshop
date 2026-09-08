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

  await supabase
    .from("participantes")
    .upsert({ id, nombre, contacto, rol }, { onConflict: "id" });

  return { id, nombre, contacto };
}
