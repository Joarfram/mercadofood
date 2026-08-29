-- Gestão Delivery Simples: libera o módulo de estoque simples e adiciona movimentação atômica de produtos.

update public.plan_entitlements e
set enabled = true, updated_at = now()
from public.subscription_plans p
where e.plan_id = p.id
  and p.code = 'delivery-simples'
  and e.module_key = 'stock';

create or replace function public.delivery_simple_move_product_stock(
  p_product_id uuid,
  p_movement_type text,
  p_quantity numeric,
  p_notes text default null,
  p_unit_cost numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products%rowtype;
  v_company_id uuid;
  v_signed numeric;
  v_before numeric;
  v_after numeric;
  v_reserved numeric := 0;
  v_available_after numeric;
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Autenticação obrigatória.'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'Informe uma quantidade maior que zero.'; end if;
  if p_movement_type not in ('entry','sale_store','adjustment_in','adjustment_out','loss','return') then
    raise exception 'Tipo de movimentação inválido.';
  end if;
  if p_unit_cost is not null and p_unit_cost < 0 then raise exception 'Custo unitário inválido.'; end if;

  select * into v_product
  from public.products
  where id = p_product_id
    and is_active = true
    and coalesce(track_stock,false) = true
  for update;

  if not found then raise exception 'Produto com controle de estoque não encontrado.'; end if;
  v_company_id := v_product.company_id;
  if not public.is_company_member(v_company_id) then raise exception 'Sem permissão.'; end if;

  -- A quantidade informada usa sempre a própria unidade de estoque do produto.
  if coalesce(v_product.stock_unit,'unit') not in ('unit','g','kg') then
    raise exception 'Unidade de estoque do produto não é suportada neste plano.';
  end if;

  select coalesce(sum(r.quantity),0)
  into v_reserved
  from public.product_stock_reservations r
  where r.product_id = v_product.id
    and r.company_id = v_company_id
    and r.status = 'reserved'
    and r.expires_at > now();

  v_signed := case
    when p_movement_type in ('entry','adjustment_in','return') then p_quantity
    else -p_quantity
  end;

  v_before := coalesce(v_product.stock_quantity,0);
  v_after := v_before + v_signed;

  if v_after < 0 then
    raise exception 'Estoque físico insuficiente. Saldo atual: % %.', v_before, coalesce(v_product.stock_unit,'unit');
  end if;

  -- Saídas manuais não podem consumir quantidade já reservada para pedidos.
  if v_signed < 0 and v_after < v_reserved then
    raise exception 'Esta saída invade estoque já reservado para pedidos. Disponível para saída: % %.',
      greatest(0, v_before - v_reserved), coalesce(v_product.stock_unit,'unit');
  end if;

  v_available_after := greatest(0, v_after - v_reserved);

  update public.products
  set stock_quantity = v_after,
      availability_status = case
        when v_available_after <= 0 then 'unavailable'
        when availability_status = 'unavailable' and v_available_after > 0 then 'available'
        else availability_status
      end,
      updated_at = now()
  where id = v_product.id and company_id = v_company_id;

  insert into public.product_stock_movements(
    company_id, product_id, movement_type, quantity, unit,
    stock_before, stock_after, unit_cost, notes, created_by
  ) values (
    v_company_id, v_product.id, p_movement_type, v_signed, coalesce(v_product.stock_unit,'unit'),
    v_before, v_after, p_unit_cost, nullif(trim(coalesce(p_notes,'')),''), v_user
  );

  return jsonb_build_object(
    'product_id', v_product.id,
    'stock_before', v_before,
    'stock_after', v_after,
    'reserved', v_reserved,
    'available', v_available_after,
    'unit', coalesce(v_product.stock_unit,'unit')
  );
end;
$$;

revoke all on function public.delivery_simple_move_product_stock(uuid,text,numeric,text,numeric) from public, anon;
grant execute on function public.delivery_simple_move_product_stock(uuid,text,numeric,text,numeric) to authenticated;

comment on function public.delivery_simple_move_product_stock(uuid,text,numeric,text,numeric) is
  'Registra entrada, venda da loja, perda, retorno ou ajuste no estoque simples sem permitir consumir reservas ativas.';
