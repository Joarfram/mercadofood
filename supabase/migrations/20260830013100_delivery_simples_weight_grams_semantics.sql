-- Gestão Delivery Simples: mínimo e incremento de venda por peso são SEMPRE armazenados em gramas.
-- A unidade de referência serve apenas para formar o preço (ex.: R$ 24 por 1 kg).

create or replace function public.delivery_simple_weight_price(
  p_product_id uuid,
  p_quantity numeric,
  p_unit text default 'g'
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products%rowtype;
  v_requested_grams numeric;
  v_reference_grams numeric;
  v_minimum_grams numeric;
  v_increment_grams numeric;
  v_steps numeric;
  v_base_price numeric;
begin
  select * into v_product from public.products where id = p_product_id;
  if not found then raise exception 'Produto não encontrado.'; end if;
  if v_product.selling_mode <> 'weight' then raise exception 'Este produto não é vendido por peso.'; end if;
  if p_unit not in ('g','kg') then raise exception 'Unidade de peso inválida.'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'Quantidade inválida.'; end if;
  if v_product.reference_quantity is null or v_product.reference_quantity <= 0 then raise exception 'Referência de preço inválida.'; end if;

  v_requested_grams := case when p_unit = 'kg' then p_quantity * 1000 else p_quantity end;
  v_reference_grams := case when v_product.reference_unit = 'kg' then v_product.reference_quantity * 1000 else v_product.reference_quantity end;

  v_minimum_grams := greatest(0, coalesce(v_product.minimum_sale_quantity, 0));
  v_increment_grams := greatest(0, coalesce(v_product.sale_increment, 0));

  if v_minimum_grams > 0 and v_requested_grams < v_minimum_grams then
    raise exception 'Quantidade abaixo do mínimo permitido.';
  end if;

  if v_increment_grams > 0 then
    v_steps := (v_requested_grams - v_minimum_grams) / v_increment_grams;
    if v_steps < 0 or v_steps <> trunc(v_steps) then
      raise exception 'Quantidade fora do incremento permitido.';
    end if;
  end if;

  v_base_price := coalesce(v_product.promotional_price, v_product.base_price);
  return round((v_requested_grams / v_reference_grams) * v_base_price, 2);
end;
$$;

revoke all on function public.delivery_simple_weight_price(uuid,numeric,text) from anon, authenticated;

comment on function public.delivery_simple_weight_price(uuid,numeric,text) is
  'Calcula preço por peso no servidor. minimum_sale_quantity e sale_increment são sempre interpretados em gramas.';