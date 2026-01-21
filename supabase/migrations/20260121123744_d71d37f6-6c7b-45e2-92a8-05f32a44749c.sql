-- Add coming_soon column to plan_products to allow admins to hide prices
ALTER TABLE public.plan_products 
ADD COLUMN coming_soon boolean NOT NULL DEFAULT false;

-- Add comment explaining the column
COMMENT ON COLUMN public.plan_products.coming_soon IS 'When true, displays "COMING SOON" instead of price on pricing page';