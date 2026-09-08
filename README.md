# Muro de Problemas

Tablero del taller de emprendimiento de la Facultad de Derecho, UNAM.
Los estudiantes publican problemas de su día a día, votan sin límite en
"Yo trabajaría en esto", proponen soluciones alternativas al problema de
alguien más y registran las entrevistas que van haciendo.

Sin contraseñas ni cuentas: cada quien escribe su nombre y su contacto una
vez, y queda guardado en `localStorage` del propio teléfono. El nombre es a
propósito visible — así es como se encuentran los equipos.

## Puesta en marcha

1. **Supabase.** Crea un proyecto nuevo. En el SQL Editor pega y ejecuta
   `supabase/migrations/0001_muro.sql`.
2. **Variables de entorno.** Copia `.env.example` a `.env.local` (local) o
   ponlas en Railway (producción):
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (Settings → API → service_role)
   - `MURO_PASSWORD` — la que pide el CSV
   - `MURO_ANONIMO` — `1` (o ausente) oculta autores; `0` los muestra
   - `MURO_MAX_VOTOS` — votos por persona; `5` por defecto, `0` = ilimitados
3. **Local:** `npm install && npm run dev`
4. **Railway:** servicio nuevo apuntando a este repo, las tres variables
   arriba, y listo. `.nvmrc` fija Node 20 para Nixpacks.

## El muro anónimo

Por defecto el muro sale **sin nombres**: con autores a la vista, el voto mide
popularidad y la gente vota a sus amigos para acabar en su equipo. Los nombres
se quitan en `/api/muro`, del lado del servidor, no solo en pantalla — ocultarlos
en el navegador no sirve de nada.

Cuando toque formar equipos, pon `MURO_ANONIMO=0` en Railway y vuelve a
desplegar: aparecen autores y contactos en las fichas, y con eso la gente puede
buscarse. El CSV **siempre** trae los nombres, esté o no anónimo el muro: está
protegido por contraseña y es para ti.

## Los cinco votos

Cada persona tiene **cinco votos**. Con votos ilimitados nadie prioriza: se vota
todo lo que suena bien y el orden del muro deja de decir nada. El limite se
valida en el servidor, no en la pantalla, y revotar algo que ya votaste no
consume cuota. Se cambia con `MURO_MAX_VOTOS`.

## Cómo está armado

- El navegador nunca habla con Supabase. Solo las rutas de `app/api/` lo
  hacen, con la `service_role_key`. RLS está en *deny-all* para `anon` y
  `authenticated`.
- Cada voto es su propia fila con llave primaria `(contribucion_id, autor_id)`.
  Cuarenta personas votando al mismo tiempo no se pisan, y la cuenta sale
  siempre de un `count`, nunca de un contador editable.
- El muro se refresca solo cada 5 segundos. En el salón se ve cómo suben los
  votos mientras la clase avanza.
- `padre_id` guarda de qué problema deriva una contribución: proponer otra
  solución crea una publicación **propia**, no un comentario.

## Rutas

| Ruta | Qué hace |
|---|---|
| `/` | El muro |
| `/api/muro` | GET · contribuciones, votos y entrevistas |
| `/api/contribuciones` | POST · publicar |
| `/api/votos` | POST · alternar "Yo trabajaría en esto" |
| `/api/entrevistas` | POST · registrar una entrevista |
| `/api/export?clave=…` | GET · CSV con votos y entrevistas contados |

## El CSV

El botón sale solo si entraste como **profesor**; pide `MURO_PASSWORD`.
Trae una fila por contribución con sus votos y entrevistas ya contados,
con BOM para que Excel en español no rompa los acentos. Es lo que sirve
para agrupar problemas por tema antes de la siguiente sesión.
