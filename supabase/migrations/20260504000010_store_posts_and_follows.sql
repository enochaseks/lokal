-- Store posts: merchants can publish updates/feed items
CREATE TABLE IF NOT EXISTS public.store_posts (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id     UUID        NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  body         TEXT        NOT NULL CHECK (char_length(body) >= 1 AND char_length(body) <= 1000),
  image_url    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.store_posts ENABLE ROW LEVEL SECURITY;
-- Anyone can read posts (they're public updates)
CREATE POLICY "Public read store_posts"
  ON public.store_posts FOR SELECT USING (true);
-- Only the store owner can insert/update/delete
CREATE POLICY "Owner manages store_posts"
  ON public.store_posts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.stores
      WHERE stores.id = store_posts.store_id
        AND stores.owner_id = auth.uid()
    )
  );
-- Store follows: authenticated users follow stores
CREATE TABLE IF NOT EXISTS public.store_follows (
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id   UUID        NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, store_id)
);
ALTER TABLE public.store_follows ENABLE ROW LEVEL SECURITY;
-- Users manage their own follows; public read for follow counts
CREATE POLICY "Users manage own follows"
  ON public.store_follows FOR ALL
  USING (auth.uid() = user_id);
CREATE POLICY "Public read follows"
  ON public.store_follows FOR SELECT USING (true);
