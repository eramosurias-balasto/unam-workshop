// Recorta y acota lo que llega del cliente. Nada de HTML, nada de campos gigantes.
export function texto(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export function idParticipante(v: unknown): string {
  const s = typeof v === "string" ? v.trim() : "";
  return /^p[a-z0-9]{6,24}$/.test(s) ? s : "";
}

export function uuid(v: unknown): string {
  const s = typeof v === "string" ? v.trim() : "";
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s) ? s : "";
}
