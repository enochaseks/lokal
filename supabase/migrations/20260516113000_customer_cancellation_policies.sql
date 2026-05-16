-- Allow authenticated customers to cancel only their own orders/bookings.
-- Customer ownership is resolved via customers.user_id = auth.uid().

DROP POLICY IF EXISTS "Customers cancel own pending orders" ON public.orders;
CREATE POLICY "Customers cancel own pending orders"
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (
    status = 'pending_transfer'
    AND customer_id IN (
      SELECT id FROM public.customers WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    status = 'cancelled'
    AND customer_id IN (
      SELECT id FROM public.customers WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Customers cancel own active bookings" ON public.store_bookings;
CREATE POLICY "Customers cancel own active bookings"
  ON public.store_bookings
  FOR UPDATE
  TO authenticated
  USING (
    status IN ('pending', 'confirmed')
    AND customer_id IN (
      SELECT id FROM public.customers WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    status = 'cancelled'
    AND cancelled_by = 'customer'
    AND customer_id IN (
      SELECT id FROM public.customers WHERE user_id = auth.uid()
    )
  );
