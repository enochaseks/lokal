-- Allow pay_at_store fulfillment mode used by travel/service flows.

alter table public.stores
  drop constraint if exists stores_fulfillment_check;

alter table public.stores
  add constraint stores_fulfillment_check
  check (fulfillment in ('collection', 'delivery', 'both', 'pay_at_store'));

select 'success' as status;
