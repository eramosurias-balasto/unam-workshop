export type Rol = "estudiante" | "profesor";
export type Tipo = "problema" | "problema-solucion";

export type Identidad = {
  id: string;
  nombre: string;
  contacto: string;
  rol: Rol;
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

export type Muro = {
  contribuciones: Contribucion[];
  votos: Voto[];
  entrevistas: Entrevista[];
};
