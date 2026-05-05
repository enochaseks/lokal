-- Run after 20260505200000_add_clothes_fashion_category.sql.
UPDATE public.stores
SET category = 'Clothes & Fashion'
WHERE category = 'Fashion';
