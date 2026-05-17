ALTER TABLE stores
ADD COLUMN IF NOT EXISTS page_background_theme TEXT CHECK (page_background_theme IN ('cream', 'primary_tint', 'accent_tint', 'gradient'));
