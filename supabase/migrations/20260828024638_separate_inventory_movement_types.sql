-- Separa saídas e ajustes sem alterar os registros históricos existentes.
alter table public.inventory_movements
  drop constraint if exists inventory_movements_movement_type_check;

alter table public.inventory_movements
  add constraint inventory_movements_movement_type_check
  check (movement_type in (
    'entry',
    'exit',
    'sale',
    'adjustment',
    'adjustment_in',
    'adjustment_out',
    'loss',
    'return'
  ));
