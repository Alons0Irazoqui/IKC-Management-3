-- Function to handle new master user creation
CREATE OR REPLACE FUNCTION public.handle_new_master_user()
RETURNS trigger AS $$
DECLARE
  new_academy_id uuid;
  new_academy_code text;
BEGIN
  -- Only proceed if the user role is 'master'
  IF new.raw_user_meta_data->>'role' = 'master' THEN
    
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
      '{"modules": {"library": true, "payments": true, "attendance": true}, "paymentSettings": {"currency": "MXN", "taxRate": 0, "lateFeeAmount": 0, "lateFeeDay": 10, "monthlyTuition": 0}, "ranks": []}'::jsonb
    );

    -- Insert into profiles
    INSERT INTO public.profiles (id, email, name, role, academy_id, avatar_url)
    VALUES (
      new.id,
      new.email,
      COALESCE(new.raw_user_meta_data->>'display_name', 'Maestro'),
      COALESCE(new.raw_user_meta_data->>'role', 'master'),
      new_academy_id,
      ''
    );
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to execute the function on new user creation
DROP TRIGGER IF EXISTS on_auth_user_created_master ON auth.users;
CREATE TRIGGER on_auth_user_created_master
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_master_user();

-- ==========================================
-- RLS POLICIES FOR REGISTRATION FLOW
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
USING (auth.uid() = user_id);

-- 4. PAYMENTS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Allow system to create initial payment for student (Student Registration)
-- Note: This is an insert by the authenticated student user
DROP POLICY IF EXISTS "Users can insert payments" ON public.payments;
CREATE POLICY "Users can insert payments" 
ON public.payments FOR INSERT 
WITH CHECK (auth.uid() = student_id);

-- Allow students to view their own payments
DROP POLICY IF EXISTS "Students view own payments" ON public.payments;
CREATE POLICY "Students view own payments" 
ON public.payments FOR SELECT 
USING (auth.uid() = student_id);
