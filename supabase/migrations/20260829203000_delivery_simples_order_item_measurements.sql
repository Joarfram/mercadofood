-- Gestão Delivery Simples: guardar a medida real comprada em cada item do pedido.
-- Ex.: 250 g de queijo, 1 unidade de vinagre, 500 g de creatina.

alter table public.order_items
  add column if not exists sale_quantity numeric(12,3),
  add column if not exists sale_unit text,
  add column if not exists selling_mode text not null default 'unit',
  add column if not exists reference_quantity numeric(12,3),
  add column if not exists reference_unit text;

alter table public.order_items
  drop constraint if exists order_items_sale_unit_check;

alter table public.order_items
  add constraint order_items_sale_unit_check
  check (sale_unit is null or sale_unit in ('unit','g','kg'));

alter table public.order_items
  drop constraint if exists order_items_selling_mode_check;

alter table public.order_items
  add constraint order_items_selling_mode_check
  check (selling_mode in ('unit','weight','fixed_weight'));

comment on column public.order_items.sale_quantity is 'Quantidade real escolhida pelo cliente para o item. Ex.: 250 para 250g.';
comment on column public.order_items.sale_unit is 'Unidade da quantidade real vendida: unit, g ou kg.';
comment on column public.order_items.selling_mode is 'Modo de venda congelado no momento do pedido.';
comment on column public.order_items.reference_quantity is 'Quantidade de referência congelada no momento do pedido.';
comment on column public.order_items.reference_unit is 'Unidade de referência congelada no momento do pedido.';