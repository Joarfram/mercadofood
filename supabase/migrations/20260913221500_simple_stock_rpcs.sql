-- Operações atômicas do estoque simples de produtos acabados.

create or replace function public.company_subscription_entitled(target_company uuid, requested_module text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select o.enabled
       from public.company_entitlement_overrides o
      where o.company_id = target_company
        and o.module_key = requested_module),
    (select e.enabled
       from public.company_subscriptions s
       join public.plan_entitlements e on e.plan_id = s.plan_id
      where s.company_id = target_company
        and s.status in ('trialing','active')
        and (s.status <> 'trialing' or s.trial_ends_at is null or s.trial_ends_at > now())
        and e.module_key = requested_module),
    false
  );
$$;

revoke all on function public.company_subscription_entitled(uuid,text) from public, anon, authenticated;

create or replace function public.configure_simple_product_stock(
  p_product_id uuid,
  p_enabled boolean,
  p_stock_quantity numeric,
  p_minimum_stock numeric
)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_product public.products%rowtype;
begin
  if p_stock_quantity < 0 or p_minimum_stock < 0 then
    raise exception 'Saldo e estoque mínimo não podem ser negativos.';
  end if;

  select * into v_product
  from public.products
  where id = p_product_id
  for update;

  if not found then raise exception 'Produto não encontrado.'; end if;
  if public.current_company_role(v_product.company_id) not in ('owner','manager','stock') then
    raise exception 'Sem permissão para alterar o estoque.';
  end if;
  if not public.company_subscription_entitled(v_product.company_id,'stock_basic') then
    raise exception 'O controle de estoque por produto exige o plano Profissional ou Premium.';
  end if;

  update public.products
     set track_stock = p_enabled,
         stock_quantity = p_stock_quantity,
         minimum_stock = p_minimum_stock,
         updated_at = now()
   where id = p_product_id;

  return jsonb_build_object(
    'product_id', p_product_id,
    'track_stock', p_enabled,
    'stock_quantity', p_stock_quantity,
    'minimum_stock', p_minimum_stock
  );
end;
$$;

create or replace function public.adjust_simple_product_stock(
  p_product_id uuid,
  p_movement_type text,
  p_quantity numeric,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_product public.products%rowtype;
  v_signed numeric;
  v_before numeric;
  v_after numeric;
begin
  if p_movement_type not in ('entry','exit','adjustment_in','adjustment_out','loss','return') then
    raise exception 'Tipo de movimentação inválido.';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'A quantidade deve ser maior que zero.';
  end if;

  select * into v_product
  from public.products
  where id = p_product_id
  for update;

  if not found then raise exception 'Produto não encontrado.'; end if;
  if public.current_company_role(v_product.company_id) not in ('owner','manager','stock') then
    raise exception 'Sem permissão para movimentar o estoque.';
  end if;
  if not public.company_subscription_entitled(v_product.company_id,'stock_basic') then
    raise exception 'O controle de estoque por produto exige o plano Profissional ou Premium.';
  end if;
  if not coalesce(v_product.track_stock,false) then
    raise exception 'Produto sem controle de estoque ativo.';
  end if;

  v_signed := case when p_movement_type in ('entry','return','adjustment_in') then p_quantity else -p_quantity end;
  v_before := coalesce(v_product.stock_quantity,0);
  v_after := v_before + v_signed;
  if v_after < 0 then raise exception 'O estoque não pode ficar negativo.'; end if;

  update public.products
     set stock_quantity = v_after, updated_at = now()
   where id = p_product_id;

  insert into public.inventory_movements(
    company_id, product_id, movement_type, quantity,
    stock_before, stock_after, notes, created_by
  ) values (
    v_product.company_id, v_product.id, p_movement_type, v_signed,
    v_before, v_after, nullif(trim(coalesce(p_notes,'')),''), auth.uid()
  );

  return jsonb_build_object(
    'product_id', v_product.id,
    'stock_before', v_before,
    'stock_after', v_after,
    'quantity', v_signed,
    'movement_type', p_movement_type
  );
end;
$$;

revoke all on function public.configure_simple_product_stock(uuid,boolean,numeric,numeric) from public, anon;
grant execute on function public.configure_simple_product_stock(uuid,boolean,numeric,numeric) to authenticated;

revoke all on function public.adjust_simple_product_stock(uuid,text,numeric,text) from public, anon;
grant execute on function public.adjust_simple_product_stock(uuid,text,numeric,text) to authenticated;
