
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
