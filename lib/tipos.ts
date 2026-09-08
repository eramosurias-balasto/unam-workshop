export type Rol = "estudiante" | "profesor";
export type Tipo = "problema" | "problema-solucion";

export type InteresTaller = "" | "si" | "tal_vez" | "no";

export type Identidad = {
  id: string;
  nombre: string;
  contacto: string;
  rol: Rol;
  /** Vacio mientras no haya contestado; se pregunta una sola vez. */
  interesTaller?: InteresTaller;
};

export type Contribucion = {
  id: string;
  titulo: string;
  quien: string;
  problema: string;
  hoy: string;
  evidencia: string;
  solucion: string;
  tipo: Tipo;
  autor_id: string;
  autor_nombre: string;
  autor_contacto: string;
  padre_id: string | null;
  creado: string;
};

export type Voto = {
  contribucion_id: string;
  autor_id: string;
  autor_nombre: string;
};

export type Entrevista = {
  id: string;
  contribucion_id: string;
  a_quien: string;
  hizo: string;
  ultima: string;
  sorpresa: string;
  supuesto: string;
  autor_nombre: string;
  creado: string;
};

export type Respuesta = {
  id: string;
  contribucion_id: string;
  ronda: number;
  texto: string;
  autor_id: string;
  autor_nombre: string;
  creado: string;
};

export type Muro = {
  contribuciones: Contribucion[];
  votos: Voto[];
  entrevistas: Entrevista[];
  respuestas: Respuesta[];
  /** Ronda de speed dating abierta; 0 = ninguna. */
  rondaAbierta: number;
  /** El servidor borro nombres y contactos antes de mandar el muro. */
  anonimo: boolean;
  /** Votos por persona; 0 = ilimitados. */
  maxVotos: number;
  /** Cuentas de la pregunta sobre continuar el taller. */
  interes: { si: number; tal_vez: number; no: number };
};
