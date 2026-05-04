-- Allow "Hair & Beauty" as a store category by extending the enum
ALTER TYPE store_category ADD VALUE IF NOT EXISTS 'Hair & Beauty';
