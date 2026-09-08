-- ¿Le interesa al alumno que el taller continue?
--
-- Va en participantes y no en contribuciones porque es una pregunta sobre
-- la persona: quien publique tres problemas la contestaria tres veces y
-- los datos quedarian inconsistentes.
--
-- '' = todavia no contesta.
alter table public.participantes
  add column if not exists interes_taller text not null default '';

alter table public.participantes
  drop constraint if exists interes_taller_valido;

alter table public.participantes
  add constraint interes_taller_valido
  check (interes_taller in ('', 'si', 'tal_vez', 'no'));
