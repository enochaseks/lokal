UPDATE public.stores
SET origin = '🌍 Pan-African'
WHERE origin IS NULL OR btrim(origin) = '';

UPDATE public.stores
SET origin = '🌍 Pan-African'
WHERE origin NOT IN (
  '🌍 Pan-African',
  '🇬🇭 Ghanaian',
  '🇳🇬 Nigerian',
  '🇰🇪 Kenyan',
  '🇪🇹 Ethiopian',
  '🇸🇴 Somali',
  '🇪🇷 Eritrean',
  '🇿🇦 South African',
  '🇿🇼 Zimbabwean',
  '🇨🇩 Congolese',
  '🇸🇳 Senegalese',
  '🇨🇮 Ivorian',
  '🏝️ Caribbean mixed',
  '🇯🇲 Jamaican',
  '🇹🇹 Trinidadian & Tobagonian',
  '🇧🇧 Barbadian',
  '🇬🇾 Guyanese',
  '🇭🇹 Haitian',
  '🇩🇴 Dominican',
  '🇨🇺 Cuban'
);

ALTER TABLE public.stores
  ALTER COLUMN origin SET DEFAULT '🌍 Pan-African';

ALTER TABLE public.stores
  ALTER COLUMN origin SET NOT NULL;

ALTER TABLE public.stores
  DROP CONSTRAINT IF EXISTS stores_origin_allowed_check;

ALTER TABLE public.stores
  ADD CONSTRAINT stores_origin_allowed_check CHECK (
    origin IN (
      '🌍 Pan-African',
      '🇬🇭 Ghanaian',
      '🇳🇬 Nigerian',
      '🇰🇪 Kenyan',
      '🇪🇹 Ethiopian',
      '🇸🇴 Somali',
      '🇪🇷 Eritrean',
      '🇿🇦 South African',
      '🇿🇼 Zimbabwean',
      '🇨🇩 Congolese',
      '🇸🇳 Senegalese',
      '🇨🇮 Ivorian',
      '🏝️ Caribbean mixed',
      '🇯🇲 Jamaican',
      '🇹🇹 Trinidadian & Tobagonian',
      '🇧🇧 Barbadian',
      '🇬🇾 Guyanese',
      '🇭🇹 Haitian',
      '🇩🇴 Dominican',
      '🇨🇺 Cuban'
    )
  );
