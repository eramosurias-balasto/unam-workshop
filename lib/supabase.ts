import "server-only";
import { createClient } from "@supabase/supabase-js";

// El navegador nunca habla con Supabase: solo estas rutas, con la service_role_key.
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.");
}

/* Next parchea fetch y cachea los GET. supabase-js lee con GET, y este
   cliente se construye a nivel de modulo -- fuera del alcance de la
   peticion -- asi que "force-dynamic" en las rutas no alcanza a cubrirlo:
   el muro se quedaba sirviendo la primera respuesta vacia para siempre,
   aunque las escrituras si llegaran a Postgres.
   Cada consulta pide cache: "no-store" explicitamente. */
export const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    fetch: (input: RequestInfo | URL, init?: RequestInit) =>
      fetch(input, { ...init, cache: "no-store" }),
  },
});
