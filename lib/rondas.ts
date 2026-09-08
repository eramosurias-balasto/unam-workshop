/** Las tres rondas del speed dating.
 *
 *  Preguntas distintas en cada ronda, a proposito: como visitante pasas por
 *  tres modos de pensar, y el anfitrion recibe su problema golpeado desde
 *  tres angulos en vez de oir la misma platica tres veces.
 *
 *  El arco es: es real -> que construiriamos -> por que nosotros.
 */
export type Ronda = {
  numero: 1 | 2 | 3;
  titulo: string;
  proposito: string;
  preguntas: string[];
};

export const RONDAS: Ronda[] = [
  {
    numero: 1,
    titulo: "¿El problema es real?",
    proposito: "Poner la frontera del problema. La última pregunta es la que duele.",
    preguntas: [
      "¿A quién exactamente le pasa esto, y cuándo fue la última vez?",
      "¿Qué hace hoy para salir del paso, y cuánto le cuesta en tiempo o dinero?",
      "¿Quién NO tiene este problema?",
    ],
  },
  {
    numero: 2,
    titulo: "¿Qué construiríamos?",
    proposito: "La primera pregunta libera la imaginación; la segunda la aterriza. En ese orden.",
    preguntas: [
      "Si tuvieran al mejor programador del mundo en el equipo, ¿qué diseñarían para resolverlo?",
      "¿Y qué es lo más chico de eso que podría estar funcionando en dos semanas, sin ese programador?",
    ],
  },
  {
    numero: 3,
    titulo: "¿Por qué nosotros?",
    proposito: "El foso, ya con material propio sobre la mesa.",
    preguntas: [
      "¿A qué tenemos acceso que otros no tengan?",
      "¿Quién ya intentó resolver esto y por qué no lo ha logrado?",
      "¿Qué tendría que ser cierto para que esto NO funcione?",
    ],
  },
];

export function ronda(n: number): Ronda | null {
  return RONDAS.find((r) => r.numero === n) ?? null;
}
