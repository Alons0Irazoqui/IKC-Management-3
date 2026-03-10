import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nyfbkylzrhpvipyxjfgn.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55ZmJreWx6cmhwdmlweXhqZmduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2MDI4MDEsImV4cCI6MjA4NjE3ODgwMX0.Jxp5_G0ghV00dofBoBsCaq7gFktDD8TzHzME1CNrv2g';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testUpsert() {
    // 1. Fetch one master's student
    const { data: students, error: fetchErr } = await supabase.from('students').select('*').limit(1);
    if (fetchErr || !students || students.length === 0) {
        console.error("Fetch error or no students", fetchErr);
        return;
    }
    const s = students[0];
    console.log("Found student:", s.id, "User ID:", s.user_id);
    
    // Simulate what the mapper does for saving
    const mapped = {
        id: s.id,
        academy_id: s.academy_id,
        user_id: s.user_id || null, // Might be empty string
        name: s.name + " (Edit)",
        email: s.email,
        status: s.status,
        rank_id: s.rank_id || null,
        balance: s.balance,
        attendance_data: s.attendance_data,
        details: s.details
    };
    
    // 2. Perform upsert directly
    console.log("Upserting payload...");
    const { error, data } = await supabase.from('students').upsert([mapped]).select();
    
    if (error) {
        console.error("UPSERT ERROR:", JSON.stringify(error, null, 2));
    } else {
        console.log("UPSERT SUCCESS:", data);
    }
}

testUpsert();
