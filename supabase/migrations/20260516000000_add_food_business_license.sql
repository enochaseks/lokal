-- Add food business license fields to stores table
ALTER TABLE stores 
ADD COLUMN food_business_license_url TEXT,
ADD COLUMN food_business_license_status TEXT CHECK (food_business_license_status IN ('pending', 'approved', 'rejected'));

-- Create index for faster lookups of pending food licenses (useful for admin verification)
CREATE INDEX idx_stores_food_business_license_status 
ON stores(food_business_license_status) 
WHERE food_business_license_status IS NOT NULL;
