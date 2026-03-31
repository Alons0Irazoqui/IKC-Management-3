-- ==========================================
-- IKC PULSE: COMPLETE CLEAN SLATE SCHEMA
-- ==========================================

-- 0. CLEANUP EXISTING TABLES (To ensure a true restart)
DROP TABLE IF EXISTS public.expenses CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.library CASCADE;
DROP TABLE IF EXISTS public.events CASCADE;
DROP TABLE IF EXISTS public.classes CASCADE;
DROP TABLE IF EXISTS public.students CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.academies CASCADE;

-- ==========================================
-- 1. TABLE DEFINITIONS
-- ==========================================

CREATE TABLE public.academies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'student',
    academy_id UUID REFERENCES public.academies(id) ON DELETE SET NULL,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    academy_id UUID NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE,
    group_id UUID,
    first_name TEXT,
    last_name TEXT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    rank_id TEXT,
    balance NUMERIC DEFAULT 0,
    attendance_data JSONB DEFAULT '{"total": 0, "history": []}'::jsonb,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academy_id UUID NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    instructor TEXT NOT NULL,
    enrolled_student_ids JSONB DEFAULT '[]'::jsonb,
    schedule_config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academy_id UUID NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    registrant_ids JSONB DEFAULT '[]'::jsonb,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.library (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academy_id UUID NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    url TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academy_id UUID NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    due_date DATE,
    payment_date TIMESTAMP WITH TIME ZONE,
    concept TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academy_id UUID NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    category TEXT DEFAULT 'General',
    payment_method TEXT,
    status TEXT DEFAULT 'paid',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 2. TRIGGERS & FUNCTIONS
-- ==========================================

-- Function to handle new user creation (Master and Student)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  new_academy_id uuid;
  new_academy_code text;
  new_student_id uuid;
  assigned_academy_id uuid;
  req_role text;
BEGIN
  req_role := COALESCE(new.raw_user_meta_data->>'role', 'student');

  IF req_role = 'master' THEN
    
    -- Generate new IDs
    new_academy_id := gen_random_uuid();
    new_academy_code := 'ACAD-' || floor(1000 + random() * 9000)::text;

    -- Insert into academies
    INSERT INTO public.academies (id, name, code, owner_id, settings)
    VALUES (
      new_academy_id,
      COALESCE(new.raw_user_meta_data->>'academy_name', 'Nueva Academia'),
      new_academy_code,
      new.id,
      '{"modules": {"library": true, "payments": true, "attendance": true}, "paymentSettings": {"currency": "MXN", "taxRate": 0, "lateFeeAmount": 150, "lateFeeDay": 10, "paymentDay": 1, "monthlyTuition": 500}, "ranks": [{"id": "rank-1","name": "Blanca","color": "10 Kyu","order": 1,"requiredAttendance": 0},{"id": "rank-2","name": "Blanca Av.","color": "9 Kyu","order": 2,"requiredAttendance": 20},{"id": "rank-3","name": "Amarilla","color": "8 Kyu","order": 3,"requiredAttendance": 40},{"id": "rank-4","name": "Amarilla Av.","color": "7 Kyu","order": 4,"requiredAttendance": 60},{"id": "rank-5","name": "Verde","color": "6 Kyu","order": 5,"requiredAttendance": 80},{"id": "rank-6","name": "Verde Av.","color": "5 Kyu","order": 6,"requiredAttendance": 100},{"id": "rank-7","name": "Azul","color": "4 Kyu","order": 7,"requiredAttendance": 120},{"id": "rank-8","name": "Azul Av.","color": "3 Kyu","order": 8,"requiredAttendance": 150},{"id": "rank-9","name": "Cafe","color": "2 Kyu","order": 9,"requiredAttendance": 180},{"id": "rank-10","name": "Cafe Av.","color": "1 Kyu","order": 10,"requiredAttendance": 220},{"id": "rank-11","name": "Shodan Ho","color": "Shodan Ho","order": 11,"requiredAttendance": 280},{"id": "rank-12","name": "Negra","color": "Cinta Negra","order": 12,"requiredAttendance": 350}]}'::jsonb
    );

    -- Insert into profiles
    INSERT INTO public.profiles (id, email, name, role, academy_id, avatar_url)
    VALUES (
      new.id,
      new.email,
      COALESCE(new.raw_user_meta_data->>'display_name', 'Maestro'),
      'master',
      new_academy_id,
      ''
    );

  ELSIF req_role = 'student' THEN
    
    -- Extract the academy_id they registered for
    assigned_academy_id := (new.raw_user_meta_data->>'academy_id')::uuid;
    new_student_id := gen_random_uuid();

    -- Insert into profiles
    INSERT INTO public.profiles (id, email, name, role, academy_id, avatar_url)
    VALUES (
      new.id,
      new.email,
      COALESCE(new.raw_user_meta_data->>'display_name', 'Alumno'),
      'student',
      assigned_academy_id,
      COALESCE(new.raw_user_meta_data->>'avatar_url', '')
    );

    -- Insert into students
    INSERT INTO public.students (id, user_id, academy_id, name, email, status, rank_id, balance, attendance_data, details)
    VALUES (
      new_student_id,
      new.id,
      assigned_academy_id,
      COALESCE(new.raw_user_meta_data->>'display_name', 'Alumno'),
      new.email,
      CASE WHEN COALESCE((new.raw_user_meta_data->>'initial_amount')::numeric, 0) > 0 THEN 'debtor' ELSE 'active' END,
      null,
      CASE WHEN COALESCE((new.raw_user_meta_data->>'initial_amount')::numeric, 0) > 0 THEN (new.raw_user_meta_data->>'initial_amount')::numeric * -1 ELSE 0 END,
      '{"total": 0, "history": []}'::jsonb,
      COALESCE((new.raw_user_meta_data->'student_details'), '{}'::jsonb)
    );

    -- Insert initial payment if amount > 0
    IF COALESCE((new.raw_user_meta_data->>'initial_amount')::numeric, 0) > 0 THEN
      INSERT INTO public.payments (academy_id, student_id, amount, status, due_date, concept, details)
      VALUES (
        assigned_academy_id,
        new_student_id,
        (new.raw_user_meta_data->>'initial_amount')::numeric,
        'pending',
        (new.raw_user_meta_data->>'payment_due_date')::date,
        COALESCE(new.raw_user_meta_data->>'payment_concept', 'Mensualidad Inicial'),
        '{"type": "charge", "description": "Cuota mensual inicial", "category": "Mensualidad", "method": "System", "canBePaidInParts": false}'::jsonb
      );
    END IF;

  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to execute the function on new user creation
DROP TRIGGER IF EXISTS on_auth_user_created_master ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==========================================
-- 3. RLS POLICIES FOR REGISTRATION FLOW
-- ==========================================

-- 1. PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow checking if email exists (Public)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" 
ON public.profiles FOR SELECT 
USING (true);

-- Allow users to insert their own profile (Student Registration)
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Allow users to update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id);

-- 2. ACADEMIES
ALTER TABLE public.academies ENABLE ROW LEVEL SECURITY;

-- Allow finding academy by code (Public - essential for student registration)
DROP POLICY IF EXISTS "Academies are viewable by everyone" ON public.academies;
CREATE POLICY "Academies are viewable by everyone" 
ON public.academies FOR SELECT 
USING (true);

-- Allow masters to update their own academy configuration
DROP POLICY IF EXISTS "Masters can update their own academy" ON public.academies;
CREATE POLICY "Masters can update their own academy" 
ON public.academies FOR UPDATE 
USING (auth.uid() = owner_id);

-- 3. STUDENTS
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- Allow students to create their own record
DROP POLICY IF EXISTS "Students can insert their own record" ON public.students;
CREATE POLICY "Students can insert their own record" 
ON public.students FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Allow students to read their own record
DROP POLICY IF EXISTS "Students can view their own record" ON public.students;
CREATE POLICY "Students can view their own record" 
ON public.students FOR SELECT 
USING (
  auth.uid() = user_id 
  OR 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
      AND role = 'master' 
      AND academy_id = public.students.academy_id
  )
);

-- 4. PAYMENTS (Clean Slate & Robust FK)
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Policy: VIEW (Read)
-- Masters: See all payments for their Academy
-- Students: See only payments belonging to their Student Record
DROP POLICY IF EXISTS "Payments Visibility Policy" ON public.payments;
CREATE POLICY "Payments Visibility Policy" 
ON public.payments FOR SELECT 
USING (
  -- Case A: User is the Student (via student_id look up)
  (auth.uid() IN (SELECT user_id FROM public.students WHERE id = student_id))
  OR
  -- Case B: User is the Master of the Academy
  (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'master' AND academy_id = public.payments.academy_id))
);

-- Policy: INSERT (Write)
-- Verified by Backend usually, but RLS can allow Authenticated users to create payments 
-- if they match their Academy or Self (for initial payment)
DROP POLICY IF EXISTS "Payments Insert Policy" ON public.payments;
CREATE POLICY "Payments Insert Policy" 
ON public.payments FOR INSERT 
WITH CHECK (
  auth.role() = 'authenticated'
);

-- Policy: UPDATE (Write)
-- Masters can update status/amount. Students usually cannot update unless uploading proof?
-- For now, let's allow Masters of equivalent Academy.
DROP POLICY IF EXISTS "Payments Update Policy" ON public.payments;
CREATE POLICY "Payments Update Policy" 
ON public.payments FOR UPDATE 
USING (
  auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'master' AND academy_id = public.payments.academy_id)
  OR
  -- Allow student to update ONLY specific fields (like proof_url) - simplified here to owner check
  (auth.uid() IN (SELECT user_id FROM public.students WHERE id = student_id))
);

-- Policy: DELETE
-- Only Masters
DROP POLICY IF EXISTS "Payments Delete Policy" ON public.payments;
CREATE POLICY "Payments Delete Policy" 
ON public.payments FOR DELETE 
USING (
  auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'master' AND academy_id = public.payments.academy_id)
);
