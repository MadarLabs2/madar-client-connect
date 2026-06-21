-- Roles
create type public.app_role as enum ('admin', 'client');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "Users can view their own roles"
  on public.user_roles for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Admins can view all roles"
  on public.user_roles for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "Admins can manage roles"
  on public.user_roles for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  company text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "Admins can view all profiles"
  on public.profiles for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

create policy "Admins can update any profile"
  on public.profiles for update
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- Updated-at trigger
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at_column();

-- Auto-create profile + default 'client' role on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, company)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.raw_user_meta_data ->> 'company', '')
  );
  insert into public.user_roles (user_id, role) values (new.id, 'client');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Projects
create type public.project_status as enum ('planning', 'in_progress', 'review', 'live', 'paused');
create type public.project_type as enum ('website', 'ecommerce', 'web_app', 'branding', 'marketing');

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type public.project_type not null default 'website',
  status public.project_status not null default 'planning',
  progress int not null default 0 check (progress between 0 and 100),
  live_url text,
  cms_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_client_id_idx on public.projects(client_id);
alter table public.projects enable row level security;

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.update_updated_at_column();

create policy "Clients can view their own projects"
  on public.projects for select
  to authenticated
  using (auth.uid() = client_id);

create policy "Admins can view all projects"
  on public.projects for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "Admins can insert projects"
  on public.projects for insert
  to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

create policy "Admins can update projects"
  on public.projects for update
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "Admins can delete projects"
  on public.projects for delete
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  has_any_admin boolean;
begin
  insert into public.profiles (id, name, company)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.raw_user_meta_data ->> 'company', '')
  );

  select exists(select 1 from public.user_roles where role = 'admin') into has_any_admin;
  if has_any_admin then
    insert into public.user_roles (user_id, role) values (new.id, 'client');
  else
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;

  return new;
end;
$$;revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
revoke all on function public.update_updated_at_column() from public, anon, authenticated;
-- Add DB connection fields to projects
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS supabase_url text,
  ADD COLUMN IF NOT EXISTS supabase_anon_key text,
  ADD COLUMN IF NOT EXISTS supabase_service_key text;

-- Products table (flexible JSON per project)
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_project ON public.products(project_id);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all products"
  ON public.products FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Clients view their products"
  ON public.products FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = products.project_id AND p.client_id = auth.uid()
  ));

CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enums
CREATE TYPE public.lead_stage AS ENUM ('new','contacted','qualified','proposal','won','lost');
CREATE TYPE public.activity_type AS ENUM ('call','meeting','email','task','note');
CREATE TYPE public.comm_channel AS ENUM ('phone','email','whatsapp','meeting','other');
CREATE TYPE public.comm_direction AS ENUM ('in','out');
CREATE TYPE public.invoice_status AS ENUM ('draft','sent','paid','overdue','cancelled');

-- Leads
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  company text,
  source text,
  stage public.lead_stage NOT NULL DEFAULT 'new',
  value numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'ILS',
  notes text,
  owner_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage leads" ON public.leads FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_leads_updated BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_leads_stage ON public.leads(stage);
CREATE INDEX idx_leads_created ON public.leads(created_at DESC);

-- Activities
CREATE TABLE public.lead_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  type public.activity_type NOT NULL DEFAULT 'task',
  title text NOT NULL,
  description text,
  due_date timestamptz,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage activities" ON public.lead_activities FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_activities_updated BEFORE UPDATE ON public.lead_activities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_activities_lead ON public.lead_activities(lead_id);
CREATE INDEX idx_activities_due ON public.lead_activities(due_date) WHERE completed = false;

-- Communications
CREATE TABLE public.lead_communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  channel public.comm_channel NOT NULL DEFAULT 'other',
  direction public.comm_direction NOT NULL DEFAULT 'out',
  content text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lead_communications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage communications" ON public.lead_communications FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX idx_comms_lead ON public.lead_communications(lead_id, occurred_at DESC);

-- Invoices
CREATE TABLE public.lead_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  number text,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'ILS',
  status public.invoice_status NOT NULL DEFAULT 'draft',
  issued_at timestamptz,
  due_date timestamptz,
  paid_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lead_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage invoices" ON public.lead_invoices FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_invoices_updated BEFORE UPDATE ON public.lead_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_invoices_lead ON public.lead_invoices(lead_id);
CREATE INDEX idx_invoices_status ON public.lead_invoices(status);

-- 1) Create admin-only secrets table
CREATE TABLE public.project_secrets (
  project_id uuid PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  supabase_url text,
  supabase_anon_key text,
  supabase_service_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage project secrets"
ON public.project_secrets
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER project_secrets_updated_at
BEFORE UPDATE ON public.project_secrets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Copy existing credentials
INSERT INTO public.project_secrets (project_id, supabase_url, supabase_anon_key, supabase_service_key)
SELECT id, supabase_url, supabase_anon_key, supabase_service_key
FROM public.projects
WHERE supabase_url IS NOT NULL
   OR supabase_anon_key IS NOT NULL
   OR supabase_service_key IS NOT NULL;

-- 3) Drop credential columns from projects (which is client-readable via RLS)
ALTER TABLE public.projects DROP COLUMN supabase_url;
ALTER TABLE public.projects DROP COLUMN supabase_anon_key;
ALTER TABLE public.projects DROP COLUMN supabase_service_key;
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();