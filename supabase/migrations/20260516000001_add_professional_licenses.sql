-- Add optional professional license fields for Barbers, Beauty stores, and Hair & Beauty
ALTER TABLE stores 
ADD COLUMN barber_license_url TEXT,
ADD COLUMN beauty_license_url TEXT,
ADD COLUMN hair_beauty_license_url TEXT;

-- Create indexes for optional license fields (for potential future verification workflows)
CREATE INDEX idx_stores_barber_license 
ON stores(barber_license_url) 
WHERE barber_license_url IS NOT NULL;

CREATE INDEX idx_stores_beauty_license 
ON stores(beauty_license_url) 
WHERE beauty_license_url IS NOT NULL;

CREATE INDEX idx_stores_hair_beauty_license 
ON stores(hair_beauty_license_url) 
WHERE hair_beauty_license_url IS NOT NULL;
