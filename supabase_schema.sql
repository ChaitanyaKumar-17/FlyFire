-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create Enums
CREATE TYPE user_role AS ENUM ('ROLE_ADMIN', 'ROLE_USER', 'ROLE_SUPERADMIN');

-- 2. Create Users Table (Linked to Supabase Auth)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role user_role DEFAULT 'ROLE_USER'::user_role NOT NULL,
  is_enabled BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by UUID REFERENCES public.users(id),
  zone_id UUID,
  is_first_login BOOLEAN DEFAULT true NOT NULL
);

-- 3. Create Zones Table
CREATE TABLE IF NOT EXISTS public.zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES public.users(id)
);

-- Add foreign key constraint to users after zones is created
ALTER TABLE public.users ADD CONSTRAINT fk_zone_id FOREIGN KEY (zone_id) REFERENCES public.zones(id);

-- 4. Create Device Types Table
CREATE TABLE IF NOT EXISTS public.device_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES public.users(id)
);

-- 5. Create Devices Table
CREATE TABLE public.devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  serial_number TEXT NOT NULL,
  device_type TEXT, -- Legacy column, no longer NOT NULL
  device_type_id UUID REFERENCES public.device_types(id),
  description TEXT,
  qr_code_ref TEXT,
  qr_signed_url TEXT,
  registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  registered_by UUID REFERENCES public.users(id),
  is_active BOOLEAN DEFAULT true NOT NULL,
  zone_id UUID REFERENCES public.zones(id),
  CONSTRAINT devices_serial_number_type_key UNIQUE (serial_number, device_type_id)
);

-- 6. Create Inspections Table
CREATE TABLE public.inspections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id UUID REFERENCES public.devices(id) ON DELETE CASCADE NOT NULL,
  inspector_id UUID REFERENCES public.users(id) NOT NULL,
  remark TEXT NOT NULL CHECK (char_length(remark) >= 10),
  inspected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 7. Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_types ENABLE ROW LEVEL SECURITY;

-- 8. Create secure function to check admin status
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid() AND (role = 'ROLE_ADMIN' OR role = 'ROLE_SUPERADMIN')
  );
$$;

-- 9. Create RLS Policies

-- Devices Policies
CREATE POLICY "Public can view active devices" ON public.devices FOR SELECT USING (is_active = true);
CREATE POLICY "Users can view active devices" ON public.devices FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "Admins have full access to devices" ON public.devices FOR ALL TO authenticated USING ( public.is_admin() );

-- Inspections Policies
CREATE POLICY "Public can view inspections" ON public.inspections FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.devices d WHERE d.id = device_id AND d.is_active = true)
);
CREATE POLICY "Users can view inspections" ON public.inspections FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own inspections" ON public.inspections FOR INSERT TO authenticated WITH CHECK (inspector_id = auth.uid());
CREATE POLICY "Admins can view and insert inspections" ON public.inspections FOR ALL TO authenticated USING ( public.is_admin() ) WITH CHECK ( public.is_admin() );

-- Users Policies
CREATE POLICY "Users are viewable by everyone" ON public.users FOR SELECT USING (true);
CREATE POLICY "Admins can manage users" ON public.users FOR ALL TO authenticated USING ( public.is_admin() );
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Zones Policies
CREATE POLICY "Zones are viewable by everyone" ON public.zones FOR SELECT USING (true);
CREATE POLICY "Zones are insertable by super admin" ON public.zones FOR ALL USING (public.is_admin());

-- Device Types Policies
CREATE POLICY "Device types are viewable by everyone" ON public.device_types FOR SELECT USING (true);
CREATE POLICY "Device types are insertable by super admin" ON public.device_types FOR ALL USING (public.is_admin());

-- 10. Initial Admin Setup
-- INSERT INTO public.users (id, username, full_name, email, role, is_enabled)
-- VALUES ('<PUT_AUTH_USER_ID_HERE>', 'admin', 'System Administrator', 'admin@firesafetypro.local', 'ROLE_SUPERADMIN', true);
