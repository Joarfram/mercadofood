-- Gestão Delivery Simples: opções fechadas de peso/embalagem.
-- Armazenadas no próprio produto para manter o cadastro simples nesta primeira versão.

alter table public.products
  add column if not exists fixed_weight_options jsonb not null default '[]'::jsonb;

alter table public.products
  drop constraint if exists products_fixed_weight_options_array_check;

alter table public.products
  add constraint products_fixed_weight_options_array_check
  check (jsonb_typeof(fixed_weight_options) = 'array');

comment on column public.products.fixed_weight_options is
  'Lista de opções fechadas para selling_mode=fixed_weight. Ex.: [{"quantity":100,"unit":"g","price":5.00}]';