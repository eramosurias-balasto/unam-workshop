-- Muro de Problemas — taller de emprendimiento, Facultad de Derecho, UNAM.
-- Toda lectura y escritura pasa por las API routes con la service_role_key.
-- RLS deny-all: anon y authenticated no tocan nada.

create extension if not exists pgcrypto;

create table if not exists public.participantes (
  id         text primary key,
  nombre     text not null,
  contacto   text not null default '',
  rol        text not null default 'estudiante' check (rol in ('estudiante', 'profesor')),
  creado     timestamptz not null default now()
);

create table if not exists public.contribuciones (
  id             uuid primary key default gen_random_uuid(),
  titulo         text not null,
  quien          text not null,
  problema       text not null,
  hoy            text not null default '',
  evidencia      text not null default '',
  solucion       text not null default '',
  tipo           text not null check (tipo in ('problema', 'problema-solucion')),
  autor_id       text not null,
  autor_nombre   text not null,
  autor_contacto text not null default '',
  padre_id       uuid references public.contribuciones(id) on delete set null,
  creado         timestamptz not null default now(),
  -- "Solo problema" no lleva solucion; "problema y solucion" la exige.
  constraint solucion_coherente check (
    (tipo = 'problema' and solucion = '') or
    (tipo = 'problema-solucion' and length(solucion) > 0)
  )
);

create table if not exists public.votos (
  contribucion_id uuid not null references public.contribuciones(id) on delete cascade,
  autor_id        text not null,
  autor_nombre    text not null,
  autor_contacto  text not null default '',
  creado          timestamptz not null default now(),
  -- Un voto por persona por contribucion; sin limite de cuantas votas.
  primary key (contribucion_id, autor_id)
);

create table if not exists public.entrevistas (
  id              uuid primary key default gen_random_uuid(),
  contribucion_id uuid not null references public.contribuciones(id) on delete cascade,
  a_quien         text not null,
  hizo            text not null,
  ultima          text not null default '',
  sorpresa        text not null default '',
  supuesto        text not null default '',
  autor_id        text not null,
  autor_nombre    text not null,
  creado          timestamptz not null default now()
);

create index if not exists contribuciones_creado_idx on public.contribuciones (creado desc);
create index if not exists contribuciones_padre_idx  on public.contribuciones (padre_id);
create index if not exists votos_contribucion_idx    on public.votos (contribucion_id);
create index if not exists entrevistas_contrib_idx   on public.entrevistas (contribucion_id);

alter table public.participantes  enable row level security;
alter table public.contribuciones enable row level security;
alter table public.votos          enable row level security;
alter table public.entrevistas    enable row level security;
