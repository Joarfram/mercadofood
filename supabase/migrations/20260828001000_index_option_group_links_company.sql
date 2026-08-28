-- Índice de suporte ao isolamento e às consultas por empresa.
create index if not exists idx_option_group_links_company
  on public.product_option_group_links(company_id);


