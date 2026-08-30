-- Gestão Delivery Simples: formas de venda por unidade, peso e pesos prontos.
-- Mantém compatibilidade com os produtos já cadastrados: todos começam como 'unit'.

alter table public.products
  add column if not exists selling_mode text not null default 'unit',
  add column if not exists reference_quantity numeric(12,3),
  add column if not exists reference_unit text,
  add column if not exists minimum_sale_quantity numeric(12,3),
  add column if not exists sale_increment numeric(12,3),
  add column if not exists stock_unit text not null default 'unit';

alter table public.products
  drop constraint if exists products_selling_mode_check;

alter table public.products
  add constraint products_selling_mode_check
  check (selling_mode in ('unit', 'weight', 'fixed_weight'));

alter table public.products
  drop constraint if exists products_reference_unit_check;

alter table public.products
  add constraint products_reference_unit_check
  check (reference_unit is null or reference_unit in ('g', 'kg'));

alter table public.products
  drop constraint if exists products_stock_unit_check;

alter table public.products
  add constraint products_stock_unit_check
  check (stock_unit in ('unit', 'g', 'kg'));

alter table public.products
  drop constraint if exists products_weight_configuration_check;

alter table public.products
  add constraint products_weight_configuration_check
  check (
    selling_mode <> 'weight'
    or (
      reference_quantity is not null and reference_quantity > 0
      and reference_unit is not null
      and minimum_sale_quantity is not null and minimum_sale_quantity > 0
      and sale_increment is not null and sale_increment > 0
    )
  );

comment on column public.products.selling_mode is 'unit=unidade, weight=preço proporcional por peso, fixed_weight=opções/embalagens de peso';
comment on column public.products.reference_quantity is 'Quantidade usada como base do preço no modo weight, na unidade definida em reference_unit';
comment on column public.products.reference_unit is 'Unidade da quantidade de referência: g ou kg';
comment on column public.products.minimum_sale_quantity is 'Menor quantidade permitida para compra no modo weight';
comment on column public.products.sale_increment is 'Passo de incremento da quantidade no modo weight';
comment on column public.products.stock_unit is 'Unidade usada para exibir e movimentar o estoque do produto';
