-- Enums
CREATE TYPE public.app_role AS ENUM ('shopper', 'merchant', 'admin');
CREATE TYPE public.store_category AS ENUM ('Groceries', 'Restaurants', 'Beauty', 'Fashion', 'Other');
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  city TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
-- User roles (separate to avoid privilege escalation)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;
-- Stores
CREATE TABLE public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category public.store_category NOT NULL,
  origin TEXT,
  description TEXT,
  address TEXT,
  city TEXT,
  postcode TEXT,
  hours TEXT,
  phone TEXT,
  image_url TEXT,
  bank_name TEXT,
  bank_account_name TEXT,
  bank_account_number TEXT,
  bank_sort_code TEXT,
  published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
CREATE INDEX stores_owner_idx ON public.stores(owner_id);
CREATE INDEX stores_published_idx ON public.stores(published);
-- Store products
CREATE TABLE public.store_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  unit TEXT,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.store_products ENABLE ROW LEVEL SECURITY;
CREATE INDEX store_products_store_idx ON public.store_products(store_id);
-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER set_stores_updated_at BEFORE UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
-- Auto-create profile + default shopper role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'shopper')
    ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
-- ===== RLS Policies =====

-- profiles: each user reads/updates their own
CREATE POLICY "Profiles are viewable by owner" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Profiles updatable by owner" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
-- user_roles: users can read their own roles; only admins can manage
CREATE POLICY "Users see own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
-- stores: published stores are public; owners manage their own
CREATE POLICY "Published stores public" ON public.stores
  FOR SELECT USING (published = true);
CREATE POLICY "Owners view own stores" ON public.stores
  FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Owners insert own stores" ON public.stores
  FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners update own stores" ON public.stores
  FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Owners delete own stores" ON public.stores
  FOR DELETE USING (auth.uid() = owner_id);
-- store_products: visible if parent store visible; manageable by store owner
CREATE POLICY "Products of published stores public" ON public.store_products
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.published = true
  ));
CREATE POLICY "Owners view products of own stores" ON public.store_products
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid()
  ));
CREATE POLICY "Owners insert products" ON public.store_products
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid()
  ));
CREATE POLICY "Owners update products" ON public.store_products
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid()
  ));
CREATE POLICY "Owners delete products" ON public.store_products
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid()
  ));
