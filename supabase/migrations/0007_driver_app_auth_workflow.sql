-- MercadoFood v0.8: acesso real do motoboy e fluxo operacional da corrida
alter table public.drivers add column if not exists email text;
alter table public.drivers add column if not exists invited_at timestamptz;
alter table public.drivers add column if not exists activated_at timestamptz;

create unique index if not exists idx_drivers_email_unique
  on public.drivers(lower(email)) where email is not null;

-- Quando o motoboy cria a conta com o e-mail cadastrado pela loja,
-- o perfil é vinculado automaticamente ao usuário do Supabase Auth.
create or replace function public.link_driver_on_auth_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.drivers
     set auth_user_id = new.id,
         registration_status = 'active',
         activated_at = now(),
         updated_at = now()
   where auth_user_id is null
     and email is not null
     and lower(email) = lower(new.email);
  return new;
end;
$$;

drop trigger if exists trg_link_driver_on_auth_signup on auth.users;
create trigger trg_link_driver_on_auth_signup
after insert or update of email on auth.users
for each row execute function public.link_driver_on_auth_signup();

-- O motoboy autenticado pode ler e atualizar apenas o próprio cadastro.
do $$ begin
  create policy "driver reads own profile" on public.drivers
  for select using (auth_user_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "driver updates own profile" on public.drivers
  for update using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- O motoboy pode acessar apenas as corridas atribuídas a ele.
do $$ begin
  create policy "driver reads own deliveries" on public.deliveries
  for select using (
    exists (
      select 1 from public.drivers d
      where d.id = driver_id and d.auth_user_id = auth.uid()
    )
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "driver updates own deliveries" on public.deliveries
  for update using (
    exists (
      select 1 from public.drivers d
      where d.id = driver_id and d.auth_user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.drivers d
      where d.id = driver_id and d.auth_user_id = auth.uid()
    ) or driver_id is null
  );
exception when duplicate_object then null; end $$;

-- Localização enviada somente pelo próprio motoboy.
do $$ begin
  create policy "driver inserts own location" on public.driver_locations
  for insert with check (
    exists (
      select 1 from public.drivers d
      where d.id = driver_id and d.auth_user_id = auth.uid()
    )
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "driver reads own locations" on public.driver_locations
  for select using (
    exists (
      select 1 from public.drivers d
      where d.id = driver_id and d.auth_user_id = auth.uid()
    )
  );
exception when duplicate_object then null; end $$;

-- Eventos operacionais criados pelo entregador autenticado.
do $$ begin
  create policy "driver inserts own delivery events" on public.delivery_events
  for insert with check (
    exists (
      select 1
      from public.deliveries del
      join public.drivers drv on drv.id = del.driver_id
      where del.id = delivery_id and drv.auth_user_id = auth.uid()
    )
  );
exception when duplicate_object then null; end $$;

-- Realtime da localização do motoboy.
do $$ begin
  alter publication supabase_realtime add table public.driver_locations;
exception when duplicate_object then null; end $$;
