-- ==============================================================================
-- CoordinatorDnD: Schema para Supabase
-- Tabla: polls con disponibilidad en jsonb, RLS público y soporte Realtime
-- ==============================================================================

-- 1. Crear tabla polls
create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  year integer not null,
  month integer not null check (month between 1 and 12),
  participants text[] not null default '{}',
  -- availability almacena un objeto jsonb mapeando fecha -> array de nombres
  -- Ejemplo: { "2026-09-15": ["Lucas (DM)", "Carlos"], "2026-09-22": ["Lucas (DM)", "Carlos", "Valeria", "Andrés"] }
  availability jsonb not null default '{}'::jsonb,
  -- comments almacena un objeto jsonb mapeando fecha -> array de comentarios/notas
  -- Ejemplo: { "2026-09-15": [{ "id": "1", "author": "Carlos", "text": "Llego 9:00 PM", "createdAt": "..." }] }
  comments jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

-- Para bases de datos existentes, agregar la columna comments si no existe:
alter table public.polls add column if not exists comments jsonb not null default '{}'::jsonb;

-- 2. Índices para acelerar búsquedas
create index if not exists idx_polls_slug on public.polls(slug);

-- 3. Trigger para actualizar automáticamente updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_polls_updated_at on public.polls;
create trigger set_polls_updated_at
  before update on public.polls
  for each row
  execute function public.handle_updated_at();

-- 4. Configurar Row Level Security (RLS)
alter table public.polls enable row level security;

-- Política de lectura pública (Cero Login)
create policy "Allow public read access to polls"
  on public.polls
  for select
  to anon, authenticated
  using (true);

-- Política de inserción pública (Cero Login)
create policy "Allow public insert to polls"
  on public.polls
  for insert
  to anon, authenticated
  with check (true);

-- Política de actualización pública (Cero Login)
create policy "Allow public update to polls"
  on public.polls
  for update
  to anon, authenticated
  using (true)
  with check (true);

-- 5. Habilitar la tabla en la publicación Realtime de Supabase
-- Nota: 'supabase_realtime' es la publicación predeterminada en Supabase
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' 
      and schemaname = 'public' 
      and tablename = 'polls'
  ) then
    alter publication supabase_realtime add table public.polls;
  end if;
end;
$$;
