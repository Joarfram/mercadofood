-- Gestão Delivery Simples: adiciona dados de venda por peso ao cardápio público
-- sem duplicar toda a função get_public_menu existente.

create or replace function public.get_public_menu_delivery_simple(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_menu jsonb;
  v_categories jsonb;
begin
  v_menu := public.get_public_menu(p_slug);
  if v_menu is null or v_menu->'company' is null then
    return v_menu;
  end if;

  select coalesce(jsonb_agg(
    jsonb_set(
      cat.value,
      '{products}',
      coalesce((
        select jsonb_agg(
          prod.value || jsonb_build_object(
            'selling_mode', p.selling_mode,
            'reference_quantity', p.reference_quantity,
            'reference_unit', p.reference_unit,
            'minimum_sale_quantity', p.minimum_sale_quantity,
            'sale_increment', p.sale_increment,
            'stock_unit', p.stock_unit,
            'fixed_weight_options', p.fixed_weight_options
          )
        )
        from jsonb_array_elements(coalesce(cat.value->'products', '[]'::jsonb)) prod
        join public.products p on p.id = (prod.value->>'id')::uuid
      ), '[]'::jsonb)
    )
  ), '[]'::jsonb)
  into v_categories
  from jsonb_array_elements(coalesce(v_menu->'categories', '[]'::jsonb)) cat;

  return jsonb_set(v_menu, '{categories}', v_categories, true);
end;
$$;

revoke all on function public.get_public_menu_delivery_simple(text) from public;
grant execute on function public.get_public_menu_delivery_simple(text) to anon, authenticated;

comment on function public.get_public_menu_delivery_simple(text) is
  'Cardápio público enriquecido com selling_mode e campos de venda por peso da Gestão Delivery Simples.';