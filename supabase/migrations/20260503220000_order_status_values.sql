-- Add new order statuses: transfer_received, ready, completed
-- (pending_transfer, payment_received, cancelled already exist)
-- The status column is text so no enum change needed.
-- Add a check constraint to enforce valid values.
alter table public.orders
  drop constraint if exists orders_status_check;
alter table public.orders
  add constraint orders_status_check
  check (status in (
    'pending_transfer',
    'transfer_received',
    'payment_received',
    'ready',
    'completed',
    'cancelled'
  ));
