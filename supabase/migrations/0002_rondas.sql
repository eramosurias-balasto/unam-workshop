-- Rondas de speed dating: el profesor abre una ronda y los alumnos
-- responden sus preguntas en la ficha de cada problema.
-- Las preguntas viven en lib/rondas.ts, no aqui: son contenido, no datos.

-- Un solo renglon: cual ronda esta abierta. 0 = ninguna.
-- Tiene que ser dato y no variable de entorno, porque se abre en vivo
-- durante la clase y un redespliegue de Railway toma minutos.
create table if not exists public.ajustes (
  id            smallint primary key default 1 check (id = 1),
  ronda_abierta smallint not null default 0 check (ronda_abierta between 0 and 3),
  actualizado   timestamptz not null default now()
);

insert into public.ajustes (id) values (1) on conflict (id) do nothing;

create table if not exists public.respuestas (
  id              uuid primary key default gen_random_uuid(),
  contribucion_id uuid not null references public.contribuciones(id) on delete cascade,
  ronda           smallint not null check (ronda between 1 and 3),
  texto           text not null,
  autor_id        text not null,
  autor_nombre    text not null,
  creado          timestamptz not null default now()
);

create index if not exists respuestas_contrib_idx on public.respuestas (contribucion_id);
create index if not exists respuestas_ronda_idx   on public.respuestas (ronda);

alter table public.ajustes    enable row level security;
alter table public.respuestas enable row level security;
