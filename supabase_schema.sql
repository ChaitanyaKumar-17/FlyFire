-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create Enums
CREATE TYPE user_role AS ENUM ('ROLE_ADMIN', 'ROLE_USER');

-- 2. Create Users Table (Linked to Supabase Auth)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role user_role DEFAULT 'ROLE_USER'::user_role NOT NULL,
  is_enabled BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by UUID REFERENCES public.users(id)
);

-- 3. Create Devices Table
CREATE TABLE public.devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  serial_number TEXT UNIQUE NOT NULL,
  device_type TEXT NOT NULL,
  description TEXT,
  qr_code_ref TEXT,
  qr_signed_url TEXT,
  registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  registered_by UUID REFERENCES public.users(id),
  is_active BOOLEAN DEFAULT true NOT NULL
);

-- 4. Create Inspections Table
CREATE TABLE public.inspections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id UUID REFERENCES public.devices(id) ON DELETE CASCADE NOT NULL,
  inspector_id UUID REFERENCES public.users(id) NOT NULL,
  remark TEXT NOT NULL CHECK (char_length(remark) >= 10),
  inspected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;

-- 5.5 Create secure function to check admin status
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid() AND role = 'ROLE_ADMIN'
  );
$$;

-- 6. Create RLS Policies

-- Devices Policies
-- PUBLIC: Can read active devices
CREATE POLICY "Public can view active devices" ON public.devices
  FOR SELECT USING (is_active = true);

-- USER: Can read active devices
CREATE POLICY "Users can view active devices" ON public.devices
  FOR SELECT TO authenticated USING (is_active = true);

-- ADMIN: Can do everything
CREATE POLICY "Admins have full access to devices" ON public.devices
  FOR ALL TO authenticated USING ( public.is_admin() );

-- Inspections Policies
-- PUBLIC: Can view only the latest inspection (handled partially in queries, but we allow SELECT)
CREATE POLICY "Public can view inspections" ON public.inspections
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.devices d WHERE d.id = device_id AND d.is_active = true)
  );

-- USER: Can view all inspections for active devices, and INSERT their own
CREATE POLICY "Users can view inspections" ON public.inspections
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert own inspections" ON public.inspections
  FOR INSERT TO authenticated WITH CHECK (
    inspector_id = auth.uid()
  );

-- ADMIN: Can SELECT all and INSERT
CREATE POLICY "Admins can view and insert inspections" ON public.inspections
  FOR ALL TO authenticated USING ( public.is_admin() ) 
  WITH CHECK ( public.is_admin() );

-- Users Policies
-- ADMIN: Can do everything except DELETE (soft-delete via is_enabled is used instead)
CREATE POLICY "Admins can manage users" ON public.users
  FOR ALL TO authenticated USING ( public.is_admin() );

-- USER: Can read their own data
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT TO authenticated USING (id = auth.uid());

-- 7. Initial Admin Setup (Run this after creating your first Auth user in the Supabase Dashboard)
-- INSERT INTO public.users (id, username, full_name, email, role, is_enabled)
-- VALUES ('<PUT_AUTH_USER_ID_HERE>', 'admin', 'System Administrator', 'admin@firesafetypro.local', 'ROLE_ADMIN', true);
