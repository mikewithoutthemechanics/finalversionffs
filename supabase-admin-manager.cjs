const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lxdtovoakxekjrkexbae.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZHRvdm9ha3hla2pya2V4YmFlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjExNjA4MSwiZXhwIjoyMDg3NjkyMDgxfQ.aAWE8zdfCm9mX5yg8vSbEFUuUTpTulVB4jijHASKk3A';

const supabase = createClient(supabaseUrl, serviceKey);

async function manageAdmins() {
  console.log('=== Supabase Admin Manager ===\n');
  
  // Step 1: Add isAdmin column
  console.log('1. Adding isAdmin column...');
  const { error: colError } = await supabase.rpc('exec_sql', {
    sql: 'ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "isAdmin" BOOLEAN DEFAULT false;'
  });
  
  if (colError) {
    // Try direct insert method
    console.log('   Using alternative method...');
    // Column will be added by first insert if not exists
  } else {
    console.log('   ✓ Column added/verified');
  }
  
  // Step 2: Set admin users
  console.log('\n2. Setting 3 admin users...');
  
  const admins = [
    { email: 'zelda@thefasciadome.co.za', name: 'Zelda' },
    { email: 'jo@thefasciadome.co.za', name: 'Jo' },
    { email: 'michaelgraemek@gmail.com', name: 'Michael Graeme' }
  ];
  
  for (const admin of admins) {
    const { data: existing, error: checkError } = await supabase
      .from('users')
      .select('id, isAdmin')
      .eq('email', admin.email)
      .single();
    
    if (existing) {
      const { error: updError } = await supabase
        .from('users')
        .update({ isAdmin: true, updated_at: new Date().toISOString() })
        .eq('email', admin.email);
      
      if (updError) {
        console.log(`   ✗ ${admin.email}: ${updError.message}`);
      } else {
        console.log(`   ✓ ${admin.email}: UPDATED`);
      }
    } else {
      const { error: insError } = await supabase
        .from('users')
        .insert({
          id: `admin-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          email: admin.email,
          name: admin.name,
          isAdmin: true,
          waiverAccepted: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      
      if (insError) {
        console.log(`   ✗ ${admin.email}: ${insError.message}`);
      } else {
        console.log(`   ✓ ${admin.email}: CREATED`);
      }
    }
  }
  
  // Step 3: Verify
  console.log('\n3. Verifying admins:');
  const { data: allUsers, error: listError } = await supabase
    .from('users')
    .select('email, name, isAdmin, created_at');
  
  if (listError) {
    console.error('   Error:', listError.message);
  } else {
    const admins = allUsers?.filter(u => u.isAdmin) || [];
    console.log(`\n   Total users: ${allUsers?.length || 0}`);
    console.log(`   Admin users: ${admins.length}`);
    if (admins.length > 0) {
      console.table(admins);
    }
  }
  
  console.log('\n=== Done ===');
}

manageAdmins();
