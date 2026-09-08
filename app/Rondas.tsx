"use client";

import { useState } from "react";
import { RONDAS, ronda as buscaRonda } from "@/lib/rondas";
import type { Identidad, Respuesta } from "@/lib/tipos";

/* La clave vive en sessionStorage: sobrevive a una recarga a media clase,
   y se va cuando cierras la pestaña. */
const CLAVE = "muro.clave";

function leeClave() {
  try {
    return sessionStorage.getItem(CLAVE) ?? "";
  } catch {
    return "";
  }
}

function guardaClave(v: string) {
  try {
    sessionStorage.setItem(CLAVE, v);
  } catch {
    /* modo privado: la pedimos otra vez */
  }
}

/** Consola del profesor: abre y cierra rondas en vivo. */
export function ConsolaRondas({
  abierta,
  alCambiar,
}: {
  abierta: number;
  alCambiar: () => void;
}) {
  const [ocupado, setOcupado] = useState(0);
  const [error, setError] = useState("");

  async function pon(n: number) {
    let clave = leeClave();
    if (!clave) {
      clave = window.prompt("Contraseña del taller:") ?? "";
      if (!clave) return;
    }

    setOcupado(n || -1);
    setError("");
    try {
      const r = await fetch("/api/ronda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ronda: n, clave }),
      });
      if (r.status === 401) {
        guardaClave("");
        setError("Clave incorrecta. Vuelve a intentarlo.");
        return;
      }
      if (!r.ok) {
        setError("No se pudo cambiar la ronda.");
        return;
      }
      guardaClave(clave);
      alCambiar();
    } catch {
      setError("No se pudo cambiar la ronda. Revisa tu conexión.");
    } finally {
      setOcupado(0);
    }
  }

  return (
    <div className="consola">
      <span className="consola-rotulo">Rondas</span>
      {RONDAS.map((r) => (
        <button
          key={r.numero}
          className="chip"
          aria-pressed={abierta === r.numero}
          disabled={ocupado !== 0}
          onClick={() => pon(r.numero)}
          title={r.titulo}
        >
          {ocupado === r.numero ? "…" : `${r.numero} · ${r.titulo}`}
        </button>
      ))}
      <button
        className="chip"
        aria-pressed={abierta === 0}
        disabled={ocupado !== 0}
        onClick={() => pon(0)}
      >
        Cerrar todas
      </button>
      {error && <span className="consola-error">{error}</span>}
    </div>
  );
}

/** Aviso para todo el salón de qué ronda está corriendo. */
export function AvisoRonda({ abierta }: { abierta: number }) {
  const r = buscaRonda(abierta);
  if (!r) return null;
  return (
    <div className="aviso-ronda">
      <b>
        Ronda {r.numero} abierta · {r.titulo}
      </b>
      <span>
        Abre la ficha del problema de tu estación y deja ahí lo que discutieron.
      </span>
    </div>
  );
}

/** Las rondas dentro de la ficha de un problema: preguntas, lo que ya
 *  escribieron los demás, y el formulario si la ronda está abierta. */
export function RondasEnFicha({
  contribucionId,
  respuestas,
  abierta,
  yo,
  anonimo,
  alGuardar,
}: {
  contribucionId: string;
  respuestas: Respuesta[];
  abierta: number;
  yo: Identidad | null;
  anonimo: boolean;
  alGuardar: () => void;
}) {
  // Solo aparecen las rondas con contenido y la que esté abierta: antes de
  // la dinámica, la ficha se queda como estaba.
  const visibles = RONDAS.filter(
    (r) => r.numero === abierta || respuestas.some((x) => x.ronda === r.numero)
  );
  if (!visibles.length) return null;

  return (
    <>
      <hr className="tajo" />
      {visibles.map((r) => (
        <div className="ronda" key={r.numero}>
          <div className="ronda-enc">
            <b>
              Ronda {r.numero} · {r.titulo}
            </b>
            {r.numero === abierta && <span className="pastilla-abierta">Abierta</span>}
          </div>

          <ol className="ronda-preguntas">
            {r.preguntas.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ol>

          <Comentarios
            lista={respuestas.filter((x) => x.ronda === r.numero)}
            anonimo={anonimo}
          />

          {r.numero === abierta && (
            <FormRespuesta
              contribucionId={contribucionId}
              yo={yo}
              alGuardar={alGuardar}
            />
          )}
        </div>
      ))}
    </>
  );
}

function Comentarios({ lista, anonimo }: { lista: Respuesta[]; anonimo: boolean }) {
  if (!lista.length) {
    return <p className="ronda-vacia">Nadie ha dejado nada en esta ronda todavía.</p>;
  }
  return (
    <div className="ronda-lista">
      {lista.map((x) => (
        <div className="comentario" key={x.id}>
          <p>{x.texto}</p>
          {!anonimo && x.autor_nombre && <span>{x.autor_nombre}</span>}
        </div>
      ))}
    </div>
  );
}

function FormRespuesta({
  contribucionId,
  yo,
  alGuardar,
}: {
  contribucionId: string;
  yo: Identidad | null;
  alGuardar: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  if (!yo) {
    return <p className="ronda-vacia">Identifícate para poder comentar.</p>;
  }

  async function enviar() {
    setError("");
    setEnviando(true);
    try {
      const r = await fetch("/api/respuestas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contribucion_id: contribucionId,
          texto,
          autor_id: yo!.id,
          autor_nombre: yo!.nombre,
          autor_contacto: yo!.contacto,
          rol: yo!.rol,
        }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        setError(j.error ?? "No se pudo guardar tu comentario.");
        setEnviando(false);
        return;
      }
      setTexto("");
      setEnviando(false);
      alGuardar();
    } catch {
      setError("No se pudo guardar. Revisa tu conexión.");
      setEnviando(false);
    }
  }

  return (
    <div className="ronda-form">
      <textarea
        rows={3}
        maxLength={900}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Lo que concluyeron en la mesa. Concreto, no bonito."
      />
      {error && <div className="error">{error}</div>}
      <div className="acciones">
        <button className="btn" disabled={enviando || texto.trim().length < 10} onClick={enviar}>
          {enviando ? "Guardando…" : "Dejar comentario"}
        </button>
      </div>
    </div>
  );
}
