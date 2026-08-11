-- Impressoras térmicas configuradas por estabelecimento.
create table public.thermal_printers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  brand text,
  model text,
  connection_type text not null default 'usb' check (connection_type in ('usb','network','bluetooth')),
  paper_width smallint not null default 80 check (paper_width in (58,80)),
  windows_printer_name text not null,
  sector text not null default 'kitchen' check (sector in ('kitchen','counter','bar','delivery')),
  copies smallint not null default 1 check (copies between 1 and 5),
  auto_print boolean not null default false,
  print_customer boolean not null default true,
  print_address boolean not null default true,
  print_payment boolean not null default true,
  status text not null default 'active' check (status in ('active','paused')),
  last_print_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,name),
  check (char_length(name) between 2 and 80),
  check (char_length(windows_printer_name) between 1 and 160)
);

create index thermal_printers_company_idx on public.thermal_printers(company_id,sector,status);
alter table public.thermal_printers enable row level security;

create policy "company manages thermal printers" on public.thermal_printers
for all to authenticated
using (public.has_company_role(company_id,array['owner','manager']))
with check (public.has_company_role(company_id,array['owner','manager']));

grant select,insert,update,delete on public.thermal_printers to authenticated;
