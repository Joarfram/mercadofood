-- MercadoFood v0.6: painel da cozinha conectado aos pedidos reais
create index if not exists idx_orders_company_kitchen_queue
  on public.orders(company_id, status, created_at);

-- Habilita eventos em tempo real para atualizações do painel.
-- O bloco evita erro caso a tabela já esteja adicionada à publicação.
do $$
begin
  alter publication supabase_realtime add table public.orders;
exception
  when duplicate_object then null;
end $$;
