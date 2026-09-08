"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  Contribucion,
  Entrevista,
  Identidad,
  InteresTaller,
  Muro as Datos,
  Respuesta,
  Rol,
  Tipo,
} from "@/lib/tipos";
import { AvisoRonda, ConsolaRondas, RondasEnFicha } from "./Rondas";

const LLAVE = "muro.identidad.v1";
const VACIO: Datos = {
  contribuciones: [],
  votos: [],
  entrevistas: [],
  respuestas: [],
  rondaAbierta: 0,
  anonimo: true,
  maxVotos: 5,
  interes: { si: 0, tal_vez: 0, no: 0 },
};

function nuevoId() {
  const abc = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += abc[bytes[i] % abc.length];
  return "p" + s;
}

function cuando(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  if (min < 1440) return `hace ${Math.floor(min / 60)} h`;
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

type Panel =
  | { que: "nada" }
  | { que: "identidad" }
  | { que: "publicar"; padre: Contribucion | null }
  | { que: "detalle"; id: string }
  | { que: "entrevista"; contribucion: Contribucion };

export default function Muro() {
  const [datos, setDatos] = useState<Datos>(VACIO);
  const [cargado, setCargado] = useState(false);
  const [yo, setYo] = useState<Identidad | null>(null);
  const [panel, setPanel] = useState<Panel>({ que: "nada" });
  const [filtro, setFiltro] = useState<"todos" | Tipo | "mios">("todos");
  const [orden, setOrden] = useState<"votos" | "reciente">("votos");
  /* Nadie elige ser profesor desde el formulario: se entra con ?profe=1
     en la URL. El CSV sigue pidiendo MURO_PASSWORD, así que la bandera
     solo decide qué se ve, nunca qué se puede descargar. */
  const [rolDeEntrada, setRolDeEntrada] = useState<Rol>("estudiante");
  const [aviso, setAviso] = useState("");
  const pendiente = useRef<null | (() => void)>(null);

  /* ---------- datos ---------- */

  const refrescar = useCallback(async () => {
    try {
      const r = await fetch("/api/muro", { cache: "no-store" });
      if (!r.ok) return;
      setDatos(await r.json());
    } catch {
      /* la siguiente vuelta lo intenta otra vez */
    } finally {
      setCargado(true);
    }
  }, []);

  useEffect(() => {
    refrescar();
    const t = setInterval(refrescar, 5000);
    return () => clearInterval(t);
  }, [refrescar]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("profe") === "1") {
      setRolDeEntrada("profesor");
    }
    try {
      const raw = localStorage.getItem(LLAVE);
      if (raw) setYo(JSON.parse(raw));
    } catch {
      /* sin identidad guardada */
    }
  }, []);

  useEffect(() => {
    const cerrar = (e: KeyboardEvent) => e.key === "Escape" && setPanel({ que: "nada" });
    window.addEventListener("keydown", cerrar);
    return () => window.removeEventListener("keydown", cerrar);
  }, []);

  /* ---------- derivados ---------- */

  const votosPor = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of datos.votos) m.set(v.contribucion_id, (m.get(v.contribucion_id) ?? 0) + 1);
    return m;
  }, [datos.votos]);

  const entrevistasPor = useMemo(() => {
    const m = new Map<string, Entrevista[]>();
    for (const e of datos.entrevistas) {
      const l = m.get(e.contribucion_id) ?? [];
      l.push(e);
      m.set(e.contribucion_id, l);
    }
    return m;
  }, [datos.entrevistas]);

  const respuestasPor = useMemo(() => {
    const m = new Map<string, Respuesta[]>();
    for (const x of datos.respuestas) {
      const l = m.get(x.contribucion_id) ?? [];
      l.push(x);
      m.set(x.contribucion_id, l);
    }
    return m;
  }, [datos.respuestas]);

  const misVotos = useMemo(() => {
    const s = new Set<string>();
    if (yo) for (const v of datos.votos) if (v.autor_id === yo.id) s.add(v.contribucion_id);
    return s;
  }, [datos.votos, yo]);

  const titulos = useMemo(
    () => new Map(datos.contribuciones.map((c) => [c.id, c])),
    [datos.contribuciones]
  );

  const visibles = useMemo(() => {
    let l = datos.contribuciones.slice();
    if (filtro === "mios") l = l.filter((c) => yo && c.autor_id === yo.id);
    else if (filtro !== "todos") l = l.filter((c) => c.tipo === filtro);

    l.sort((a, b) => {
      if (orden === "votos") {
        const d = (votosPor.get(b.id) ?? 0) - (votosPor.get(a.id) ?? 0);
        if (d !== 0) return d;
      }
      return b.creado.localeCompare(a.creado);
    });
    return l;
  }, [datos.contribuciones, filtro, orden, votosPor, yo]);

  /* ---------- identidad ---------- */

  const guardarYo = (i: Identidad) => {
    setYo(i);
    try {
      localStorage.setItem(LLAVE, JSON.stringify(i));
    } catch {
      /* modo privado: la identidad dura lo que la pestaña */
    }
  };

  const conIdentidad = (accion: () => void) => {
    if (yo) accion();
    else {
      pendiente.current = accion;
      setPanel({ que: "identidad" });
    }
  };

  /* ---------- votar ---------- */

  const votar = async (cid: string) => {
    conIdentidad(async () => {
      if (!yo) return;
      const quitar = misVotos.has(cid);

      // Optimista: la cuenta se mueve al instante y el sondeo confirma.
      setDatos((d) => ({
        ...d,
        votos: quitar
          ? d.votos.filter((v) => !(v.contribucion_id === cid && v.autor_id === yo.id))
          : [...d.votos, { contribucion_id: cid, autor_id: yo.id, autor_nombre: yo.nombre }],
      }));

      try {
        const r = await fetch("/api/votos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contribucion_id: cid,
            quitar,
            autor_id: yo.id,
            autor_nombre: yo.nombre,
            autor_contacto: yo.contacto,
            rol: yo.rol,
          }),
        });
        if (!r.ok) {
          const j = (await r.json().catch(() => ({}))) as { error?: string };
          setAviso(j.error ?? "No se pudo votar.");
          setTimeout(() => setAviso(""), 6000);
        } else if (aviso) {
          setAviso("");
        }
      } catch {
        setAviso("No se pudo votar. Revisa tu conexión.");
        setTimeout(() => setAviso(""), 6000);
      }
      // Restaura la verdad del servidor: deshace el optimismo si fue rechazado.
      refrescar();
    });
  };

  /* ---------- CSV ---------- */

  const descargar = () => {
    const clave = window.prompt("Contraseña del taller para descargar el CSV:");
    if (clave) window.location.href = `/api/export?clave=${encodeURIComponent(clave)}`;
  };

  /* ---------- render ---------- */

  const nConSolucion = datos.contribuciones.filter((c) => c.tipo === "problema-solucion").length;

  return (
    <>
      <header className="barra">
        <div className="env barra-int">
          <button className="marca" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            Muro de Problemas <span>Derecho UNAM</span>
          </button>
          {yo && (
            <div className="yo">
              <span className={"punto" + (yo.rol === "profesor" ? " prof" : "")} />
              {yo.nombre}
            </div>
          )}
          <button className="btn" onClick={() => conIdentidad(() => setPanel({ que: "publicar", padre: null }))}>
            Publicar
          </button>
        </div>
      </header>

      {yo?.rol === "profesor" && (
        <div className="consola-envoltura">
          <div className="env">
            <ConsolaRondas abierta={datos.rondaAbierta} alCambiar={refrescar} />
          </div>
        </div>
      )}

      <main className="env">
        <section className="intro">
          <h1>Toda empresa empieza con un problema que alguien ya tiene.</h1>
          <p>
            Publica los problemas que ves en tu día a día. Puedes traer solo el problema, o el
            problema y una posible solución. Vota los que trabajarías y registra las entrevistas
            que hagas.
          </p>
          <div className="cifras">
            <Cifra n={datos.contribuciones.length} rotulo="publicaciones" />
            <Cifra n={nConSolucion} rotulo="con solución" />
            <Cifra n={datos.votos.length} rotulo="votos" />
            <Cifra n={datos.entrevistas.length} rotulo="entrevistas" />
            {yo?.rol === "profesor" && (
              <>
                <Cifra n={datos.interes.si} rotulo="quieren seguir" />
                <Cifra n={datos.interes.tal_vez} rotulo="tal vez" />
                <Cifra n={datos.interes.no} rotulo="no creen" />
              </>
            )}
          </div>
        </section>

        <div className="filtros">
          <Chip activo={filtro === "todos"} al={() => setFiltro("todos")}>Todo</Chip>
          <Chip activo={filtro === "problema"} al={() => setFiltro("problema")}>Solo problema</Chip>
          <Chip activo={filtro === "problema-solucion"} al={() => setFiltro("problema-solucion")}>
            Problema y solución
          </Chip>
          <Chip activo={filtro === "mios"} al={() => setFiltro("mios")}>Míos</Chip>
          <span className="sep" />
          <Chip activo={orden === "votos"} al={() => setOrden("votos")}>Más votados</Chip>
          <Chip activo={orden === "reciente"} al={() => setOrden("reciente")}>Recientes</Chip>
        </div>

        <AvisoRonda abierta={datos.rondaAbierta} />

        {(aviso || datos.anonimo || (yo && datos.maxVotos > 0)) && (
          <p className="nota-anonimo">
            {aviso && <b className="aviso-voto">{aviso} </b>}
            {yo && datos.maxVotos > 0 && (
              <b className="cuota">
                Te quedan {Math.max(0, datos.maxVotos - misVotos.size)} de {datos.maxVotos} votos.{" "}
              </b>
            )}
            {datos.anonimo &&
              "Los autores están ocultos: vota el problema, no a quien lo escribió."}
          </p>
        )}

        <section className="muro">
          {!cargado && (
            <div className="aviso">
              <b>Cargando el muro…</b>
              <span>Un segundo.</span>
            </div>
          )}

          {cargado && visibles.length === 0 && filtro === "todos" && (
            <div className="aviso">
              <b>Todavía no hay publicaciones</b>
              <span>Las que se publiquen aparecen aquí.</span>
            </div>
          )}

          {cargado && visibles.length === 0 && filtro !== "todos" && (
            <div className="aviso">
              <b>Nada por aquí todavía</b>
              <span>Cambia el filtro o publica algo tú.</span>
            </div>
          )}

          {visibles.map((c) => (
            <article className="ficha" key={c.id}>
              <div className="fila-etiquetas">
                <Etiqueta tipo={c.tipo} />
              </div>
              <h3>{c.titulo}</h3>
              {c.padre_id && titulos.has(c.padre_id) && (
                <div className="deriva">
                  {datos.anonimo
                    ? "Otra solución a otro problema del muro"
                    : `Otra solución al problema de ${titulos.get(c.padre_id)!.autor_nombre}`}
                </div>
              )}
              <div className="ficha-cuerpo">{c.problema}</div>
              <div className="ficha-pie">
                {!datos.anonimo && <span className="autor">{c.autor_nombre}</span>}
                {(entrevistasPor.get(c.id)?.length ?? 0) > 0 && (
                  <span className="cuenta-ent">
                    {entrevistasPor.get(c.id)!.length === 1
                      ? "1 entrevista"
                      : `${entrevistasPor.get(c.id)!.length} entrevistas`}
                  </span>
                )}
                <button
                  className="votar"
                  aria-pressed={misVotos.has(c.id)}
                  aria-label="Yo trabajaría en esto"
                  onClick={() => votar(c.id)}
                >
                  {misVotos.has(c.id) ? "✓ " : ""}
                  {votosPor.get(c.id) ?? 0}
                </button>
              </div>
              <button className="btn fantasma" onClick={() => setPanel({ que: "detalle", id: c.id })}>
                Abrir ficha
              </button>
            </article>
          ))}
        </section>

        <footer className="pie">
          <span>Taller de emprendimiento · Facultad de Derecho, UNAM</span>
          <span className="sep" />
          {yo && (
            <button
              className="chip"
              onClick={() => {
                try {
                  localStorage.removeItem(LLAVE);
                } catch {}
                setYo(null);
              }}
            >
              Cambiar de nombre
            </button>
          )}
          {yo?.rol === "profesor" && (
            <button className="chip" onClick={descargar}>
              Descargar CSV
            </button>
          )}
        </footer>
      </main>

      {panel.que === "identidad" && (
        <Contenedor titulo="Antes de entrar" cerrar={() => setPanel({ que: "nada" })}>
          <FormIdentidad
            listo={(i) => {
              guardarYo(i);
              const seguir = pendiente.current;
              pendiente.current = null;
              setPanel({ que: "nada" });
              if (seguir) setTimeout(seguir, 0);
            }}
            nuevoId={nuevoId}
            rol={rolDeEntrada}
            anonimo={datos.anonimo}
          />
        </Contenedor>
      )}

      {panel.que === "publicar" && yo && (
        <Contenedor
          titulo={panel.padre ? "Otra solución al mismo problema" : "Publicar en el muro"}
          cerrar={() => setPanel({ que: "nada" })}
        >
          <FormContribucion
            yo={yo}
            preguntarInteres={!yo.interesTaller}
            alResponderInteres={(v) => guardarYo({ ...yo, interesTaller: v })}
            padre={panel.padre}
            listo={() => {
              setPanel({ que: "nada" });
              refrescar();
            }}
          />
        </Contenedor>
      )}

      {panel.que === "entrevista" && yo && (
        <Contenedor titulo="Registrar una entrevista" cerrar={() => setPanel({ que: "nada" })}>
          <FormEntrevista
            yo={yo}
            contribucion={panel.contribucion}
            listo={() => {
              setPanel({ que: "detalle", id: panel.contribucion.id });
              refrescar();
            }}
          />
        </Contenedor>
      )}

      {panel.que === "detalle" && titulos.has(panel.id) && (
        <Contenedor titulo="Ficha de la contribución" cerrar={() => setPanel({ que: "nada" })}>
          <Detalle
            anonimo={datos.anonimo}
            respuestas={respuestasPor.get(panel.id) ?? []}
            rondaAbierta={datos.rondaAbierta}
            yo={yo}
            refrescar={refrescar}
            c={titulos.get(panel.id)!}
            padre={titulos.get(titulos.get(panel.id)!.padre_id ?? "") ?? null}
            votos={votosPor.get(panel.id) ?? 0}
            vote={misVotos.has(panel.id)}
            entrevistas={entrevistasPor.get(panel.id) ?? []}
            alVotar={() => votar(panel.id)}
            alEntrevistar={() =>
              conIdentidad(() =>
                setPanel({ que: "entrevista", contribucion: titulos.get(panel.id)! })
              )
            }
            alDerivar={() =>
              conIdentidad(() => setPanel({ que: "publicar", padre: titulos.get(panel.id)! }))
            }
          />
        </Contenedor>
      )}
    </>
  );
}

/* ---------------- piezas ---------------- */

function Cifra({ n, rotulo }: { n: number; rotulo: string }) {
  return (
    <div className="cifra">
      <b>{n}</b>
      <span>{rotulo}</span>
    </div>
  );
}

function Chip({ activo, al, children }: { activo: boolean; al: () => void; children: React.ReactNode }) {
  return (
    <button className="chip" aria-pressed={activo} onClick={al}>
      {children}
    </button>
  );
}

function Etiqueta({ tipo }: { tipo: Tipo }) {
  return (
    <span className={"etiqueta " + (tipo === "problema-solucion" ? "ambas" : "solo")}>
      {tipo === "problema-solucion" ? "Problema y solución" : "Solo problema"}
    </span>
  );
}

function Contenedor({
  titulo,
  cerrar,
  children,
}: {
  titulo: string;
  cerrar: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="telon"
      onClick={(e) => {
        if (e.target === e.currentTarget) cerrar();
      }}
    >
      <div className="panel" role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="panel-barra">
          <h2>{titulo}</h2>
          <button className="cerrar" aria-label="Cerrar" onClick={cerrar}>
            ×
          </button>
        </div>
        <div className="panel-cuerpo">{children}</div>
      </div>
    </div>
  );
}

function Campo({
  etiqueta,
  pista,
  children,
}: {
  etiqueta: string;
  pista?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="campo">
      <label>{etiqueta}</label>
      {pista && <p className="pista">{pista}</p>}
      {children}
    </div>
  );
}

/* ---------------- formularios ---------------- */

function FormIdentidad({
  listo,
  nuevoId,
  rol,
  anonimo,
}: {
  listo: (i: Identidad) => void;
  nuevoId: () => string;
  rol: Rol;
  anonimo: boolean;
}) {
  const [nombre, setNombre] = useState("");
  const [contacto, setContacto] = useState("");
  const [error, setError] = useState("");

  return (
    <>
      <p className="pista">
        {anonimo
          ? "Por ahora el muro es anónimo: nadie ve quién escribió qué. Tu nombre se guarda para cuando toque formar equipos."
          : "Tu nombre aparece junto a lo que publicas: así es como los equipos se encuentran."}
      </p>
      <Campo etiqueta="¿Cómo te llamas?">
        <input
          type="text"
          maxLength={60}
          value={nombre}
          autoFocus
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre y apellido"
        />
      </Campo>
      <Campo
        etiqueta="¿Cómo te contactan?"
        pista="No se muestra en el muro. Sirve para armar equipos más adelante."
      >
        <input
          type="text"
          maxLength={80}
          value={contacto}
          onChange={(e) => setContacto(e.target.value)}
          placeholder="WhatsApp o correo"
        />
      </Campo>
      {rol === "profesor" && (
        <div className="regla">
          <b>Entras como profesor</b>
          Vas a ver además el botón para descargar el CSV.
        </div>
      )}
      {error && <div className="error">{error}</div>}
      <div className="acciones">
        <button
          className="btn"
          onClick={() => {
            if (nombre.trim().length < 3) {
              setError("Escribe tu nombre completo para que te puedan buscar.");
              return;
            }
            listo({ id: nuevoId(), nombre: nombre.trim(), contacto: contacto.trim(), rol });
          }}
        >
          Entrar al muro
        </button>
      </div>
    </>
  );
}

function FormContribucion({
  yo,
  padre,
  listo,
  preguntarInteres,
  alResponderInteres,
}: {
  yo: Identidad;
  padre: Contribucion | null;
  listo: () => void;
  preguntarInteres: boolean;
  alResponderInteres: (v: InteresTaller) => void;
}) {
  const [titulo, setTitulo] = useState(padre?.titulo ?? "");
  const [quien, setQuien] = useState(padre?.quien ?? "");
  const [problema, setProblema] = useState(padre?.problema ?? "");
  const [hoy, setHoy] = useState(padre?.hoy ?? "");
  const [evidencia, setEvidencia] = useState("");
  const [solucion, setSolucion] = useState("");
  const [tipo, setTipo] = useState<Tipo>(padre ? "problema-solucion" : "problema");
  const [interes, setInteres] = useState<InteresTaller>("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const enviar = async () => {
    setError("");
    setEnviando(true);
    try {
      const r = await fetch("/api/contribuciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo,
          quien,
          problema,
          hoy,
          evidencia,
          solucion,
          tipo,
          padre_id: padre?.id ?? null,
          autor_id: yo.id,
          autor_nombre: yo.nombre,
          autor_contacto: yo.contacto,
          rol: yo.rol,
          interes_taller: interes,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setError(j.error ?? "No se pudo publicar. Inténtalo de nuevo.");
        setEnviando(false);
        return;
      }
      if (interes) alResponderInteres(interes);
      listo();
    } catch {
      setError("No se pudo publicar. Revisa tu conexión.");
      setEnviando(false);
    }
  };

  return (
    <>
      {padre && (
        <div className="regla">
          <b>Partes de otro problema del muro</b>
          {padre.titulo}
        </div>
      )}

      <Campo etiqueta="El problema, en una frase" pista="Describe el problema, no la solución.">
        <input
          type="text"
          maxLength={80}
          value={titulo}
          autoFocus
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="El trámite de titulación se explica en cinco ventanillas distintas"
        />
      </Campo>

      <Campo
        etiqueta="¿Quién lo tiene?"
        pista="Una persona o un grupo concreto, no una categoría general."
      >
        <input
          type="text"
          maxLength={90}
          value={quien}
          onChange={(e) => setQuien(e.target.value)}
          placeholder="Pasantes de Derecho que se titulan por tesis"
        />
      </Campo>

      <Campo etiqueta="¿Qué pasa exactamente?">
        <textarea
          rows={4}
          maxLength={500}
          value={problema}
          onChange={(e) => setProblema(e.target.value)}
          placeholder="Qué pasa, cuándo pasa y a quién le cuesta."
        />
      </Campo>

      <Campo etiqueta="¿Qué hacen hoy?" pista="Cómo resuelven el problema actualmente.">
        <textarea
          rows={3}
          maxLength={350}
          value={hoy}
          onChange={(e) => setHoy(e.target.value)}
          placeholder="Los pasos que siguen hoy."
        />
      </Campo>

      <Campo etiqueta="¿Cómo lo sabes?" pista="Si lo viviste, lo observaste o lo estás suponiendo.">
        <textarea
          rows={2}
          maxLength={300}
          value={evidencia}
          onChange={(e) => setEvidencia(e.target.value)}
          placeholder="A cuántas personas se lo has escuchado."
        />
      </Campo>

      <hr className="tajo" />

      <Campo etiqueta="Qué traes">
        <div className="opciones">
          <label className="opcion">
            <input
              type="radio"
              name="tipo"
              checked={tipo === "problema"}
              onChange={() => setTipo("problema")}
            />
            <div>
              <b>Solo problema, sin solución</b>
              <small>Otra persona puede proponer una solución después.</small>
            </div>
          </label>
          <label className="opcion">
            <input
              type="radio"
              name="tipo"
              checked={tipo === "problema-solucion"}
              onChange={() => setTipo("problema-solucion")}
            />
            <div>
              <b>Problema y solución</b>
              <small>Incluyes una propuesta inicial de solución.</small>
            </div>
          </label>
        </div>
      </Campo>

      {tipo === "problema-solucion" && (
        <Campo
          etiqueta="Posible solución"
          pista="Una línea. Es una hipótesis inicial y puede cambiar."
        >
          <input
            type="text"
            maxLength={140}
            value={solucion}
            onChange={(e) => setSolucion(e.target.value)}
            placeholder="Una línea."
          />
        </Campo>
      )}

      {preguntarInteres && (
        <>
          <hr className="tajo" />
          <Campo
            etiqueta="Una última, y no se vuelve a preguntar"
            pista="¿Te interesaría que continuáramos con el taller al menos una vez al mes?"
          >
            <div className="opciones">
              {(
                [
                  ["si", "Sí, cuenten conmigo"],
                  ["tal_vez", "Tal vez, depende de las fechas"],
                  ["no", "No creo"],
                ] as [InteresTaller, string][]
              ).map(([valor, texto]) => (
                <label className="opcion" key={valor}>
                  <input
                    type="radio"
                    name="interes"
                    checked={interes === valor}
                    onChange={() => setInteres(valor)}
                  />
                  <div>
                    <b>{texto}</b>
                  </div>
                </label>
              ))}
            </div>
          </Campo>
        </>
      )}

      {error && <div className="error">{error}</div>}

      <div className="acciones">
        <button className="btn" disabled={enviando} onClick={enviar}>
          {enviando ? "Publicando…" : padre ? "Publicar mi versión" : "Publicar en el muro"}
        </button>
      </div>
    </>
  );
}

function FormEntrevista({
  yo,
  contribucion,
  listo,
}: {
  yo: Identidad;
  contribucion: Contribucion;
  listo: () => void;
}) {
  const [aQuien, setAQuien] = useState("");
  const [hizo, setHizo] = useState("");
  const [ultima, setUltima] = useState("");
  const [sorpresa, setSorpresa] = useState("");
  const [supuesto, setSupuesto] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const enviar = async () => {
    setError("");
    setEnviando(true);
    try {
      const r = await fetch("/api/entrevistas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contribucion_id: contribucion.id,
          a_quien: aQuien,
          hizo,
          ultima,
          sorpresa,
          supuesto,
          autor_id: yo.id,
          autor_nombre: yo.nombre,
          autor_contacto: yo.contacto,
          rol: yo.rol,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setError(j.error ?? "No se pudo guardar la entrevista.");
        setEnviando(false);
        return;
      }
      listo();
    } catch {
      setError("No se pudo guardar. Revisa tu conexión.");
      setEnviando(false);
    }
  };

  return (
    <>
      <div className="regla">
        <b>Cómo se entrevista</b>
        <p style={{ margin: "0 0 8px" }}>
          No preguntes por el futuro ni por tu idea. Pregunta por lo que ya hizo.
        </p>
        <ul>
          <li>
            <s>¿Usarías esto?</s> → ¿Qué hiciste la última vez que te pasó?
          </li>
          <li>
            <s>¿Te parece buena idea?</s> → ¿Cuánto tiempo o dinero te costó?
          </li>
          <li>
            <s>¿Pagarías por esto?</s> → ¿Qué has pagado ya por resolverlo?
          </li>
        </ul>
      </div>

      <Campo etiqueta="¿Con quién hablaste?" pista="Descríbelo por su rol, nunca por su nombre.">
        <input
          type="text"
          maxLength={90}
          value={aQuien}
          autoFocus
          onChange={(e) => setAQuien(e.target.value)}
          placeholder="Pasante de segundo año, titulándose por tesis"
        />
      </Campo>

      <Campo etiqueta="¿Qué hace hoy cuando se le presenta el problema?">
        <textarea
          rows={4}
          maxLength={500}
          value={hizo}
          onChange={(e) => setHizo(e.target.value)}
          placeholder="Cuenta los pasos que te describió, no su opinión."
        />
      </Campo>

      <Campo
        etiqueta="¿Cuándo fue la última vez que le pasó?"
        pista="Si no lo recuerda, el problema no es tan frecuente como crees."
      >
        <input
          type="text"
          maxLength={90}
          value={ultima}
          onChange={(e) => setUltima(e.target.value)}
          placeholder="La semana pasada / hace seis meses / nunca"
        />
      </Campo>

      <Campo etiqueta="¿Qué te sorprendió?">
        <textarea
          rows={3}
          maxLength={400}
          value={sorpresa}
          onChange={(e) => setSorpresa(e.target.value)}
          placeholder="Lo que no esperabas oír es lo único que vale la pena traer."
        />
      </Campo>

      <Campo etiqueta="¿Qué supuesto se debilitó?">
        <textarea
          rows={3}
          maxLength={400}
          value={supuesto}
          onChange={(e) => setSupuesto(e.target.value)}
          placeholder="¿Qué creencia tuya quedó más débil después de esta conversación?"
        />
      </Campo>

      {error && <div className="error">{error}</div>}

      <div className="acciones">
        <button className="btn" disabled={enviando} onClick={enviar}>
          {enviando ? "Guardando…" : "Guardar entrevista"}
        </button>
      </div>
    </>
  );
}

/* ---------------- detalle ---------------- */

function Detalle({
  anonimo,
  respuestas,
  rondaAbierta,
  yo,
  refrescar,
  c,
  padre,
  votos,
  vote,
  entrevistas,
  alVotar,
  alEntrevistar,
  alDerivar,
}: {
  anonimo: boolean;
  respuestas: Respuesta[];
  rondaAbierta: number;
  yo: Identidad | null;
  refrescar: () => void;
  c: Contribucion;
  padre: Contribucion | null;
  votos: number;
  vote: boolean;
  entrevistas: Entrevista[];
  alVotar: () => void;
  alEntrevistar: () => void;
  alDerivar: () => void;
}) {
  return (
    <>
      <div className="bloque">
        <div className="fila-etiquetas">
          <span className={"etiqueta " + (c.tipo === "problema-solucion" ? "ambas" : "solo")}>
            {c.tipo === "problema-solucion" ? "Problema y solución" : "Solo problema, sin solución"}
          </span>
        </div>
        <h3 className="titulo-detalle">{c.titulo}</h3>
      </div>

      {padre && (
        <div className="deriva">
          {anonimo
            ? "Deriva de otro problema del muro"
            : `Deriva del problema publicado por ${padre.autor_nombre}`}
        </div>
      )}

      <div className="bloque">
        <h4>¿Quién lo tiene?</h4>
        <p>{c.quien}</p>
      </div>
      <div className="bloque">
        <h4>¿Qué pasa?</h4>
        <p>{c.problema}</p>
      </div>
      {c.hoy && (
        <div className="bloque">
          <h4>¿Qué hacen hoy?</h4>
          <p>{c.hoy}</p>
        </div>
      )}
      {c.evidencia && (
        <div className="bloque">
          <h4>¿Cómo lo sabe?</h4>
          <p>{c.evidencia}</p>
        </div>
      )}
      {c.solucion && (
        <div className="bloque">
          <h4>Corazonada de solución</h4>
          <p>{c.solucion}</p>
        </div>
      )}

      <div className="meta-detalle">
        <span>
          {anonimo
            ? "Autor oculto hasta formar equipos"
            : c.autor_nombre + (c.autor_contacto ? ` · ${c.autor_contacto}` : "")}
        </span>
        <span>{cuando(c.creado)}</span>
        <button className="votar" aria-pressed={vote} onClick={alVotar}>
          {vote ? "✓ Trabajaría en esto · " : "Yo trabajaría en esto · "}
          {votos}
        </button>
      </div>

      <RondasEnFicha
        contribucionId={c.id}
        respuestas={respuestas}
        abierta={rondaAbierta}
        yo={yo}
        anonimo={anonimo}
        alGuardar={refrescar}
      />

      <hr className="tajo" />

      <div className="acciones">
        <button className="btn" onClick={alEntrevistar}>
          Registrar una entrevista
        </button>
        <button className="btn fantasma" onClick={alDerivar}>
          Proponer otra solución
        </button>
      </div>

      <div className="bloque">
        <h4>Entrevistas · {entrevistas.length}</h4>
      </div>

      {entrevistas.length === 0 ? (
        <div className="aviso">
          <b>Nadie ha salido a preguntar todavía</b>
          <span>
            Una hipótesis sin entrevistas es una opinión. Habla con tres personas que lo padezcan y
            regresa.
          </span>
        </div>
      ) : (
        <div className="lista">
          {entrevistas.map((e) => (
            <div className="entrevista" key={e.id}>
              <div className="entrevista-enc">
                <b>{e.a_quien}</b>
                {!anonimo && <span>por {e.autor_nombre}</span>}
                <span>{cuando(e.creado)}</span>
              </div>
              <Par t="Qué hace hoy" v={e.hizo} />
              <Par t="Última vez" v={e.ultima} />
              <Par t="Qué sorprendió" v={e.sorpresa} />
              <Par t="Supuesto debilitado" v={e.supuesto} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function Par({ t, v }: { t: string; v: string }) {
  if (!v) return null;
  return (
    <dl className="par">
      <dt>{t}</dt>
      <dd>{v}</dd>
    </dl>
  );
}
