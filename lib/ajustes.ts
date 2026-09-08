import "server-only";

/** Votos por persona. 0 = ilimitados. */
export function maxVotos(): number {
  const n = Number(process.env.MURO_MAX_VOTOS ?? 5);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 5;
}

/** Con autores a la vista el voto mide popularidad, no el problema. */
export function esAnonimo(): boolean {
  return process.env.MURO_ANONIMO !== "0";
}
