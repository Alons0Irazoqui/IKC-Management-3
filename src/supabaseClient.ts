
import { createClient } from '@supabase/supabase-js';

// These should be in environment variables in a real production build
const supabaseUrl = 'https://nyfbkylzrhpvipyxjfgn.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55ZmJreWx6cmhwdmlweXhqZmduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2MDI4MDEsImV4cCI6MjA4NjE3ODgwMX0.Jxp5_G0ghV00dofBoBsCaq7gFktDD8TzHzME1CNrv2g';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
