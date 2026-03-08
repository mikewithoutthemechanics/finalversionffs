const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lxdtovoakxekjrkexbae.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZHRvdm9ha3hla2pya2V4YmFlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjExNjA4MSwiZXhwIjoyMDg3NjkyMDgxfQ.aAWE8zdfCm9mX5yg8vSbEFUuUTpTulVB4jijHASKk3A';

const supabase = createClient(supabaseUrl, serviceKey, {
  db: { schema: 'public' }
});

async function setupAdmins() {
  console.log('Connecting to Supabase...\n');
  
  // Check if isAdmin column exists
  console.log('Step 1: Checking isAdmin column...');
  const { data: testData, error: testError } = await supabase
    .from('users')
    .select('isAdmin')
    .limit(1);
  
  if (testError && testError.message.includes('isAdmin')) {
    console.log('❌ isAdmin column does NOT exist');
    console.log('\n⚠️  You MUST run this SQL in Supabase SQL Editor first:');
    console.log('\n   ALTER TABLE public.users ADD COLUMN "isAdmin" BOOLEAN DEFAULT false;');
    console.log('\n   Go to: https://app.supabase.com/project/lxdtovoakxekjrkexbae/sql-editor');
    return;
  }
  
  console.log('✓ isAdmin column exists\n');
  
  // Set 3 admin users
  console.log('Step 2: Setting 3 admin users...');
  const admins = [
    { email: 'zelda@thefasciadome.co.za', name: 'Zelda' },
    { email: 'jo@thefasciadome.co.za', name: 'Jo' },
    { email: 'michaelgraemek@gmail.com', name: 'Michael Graeme' }
  ];
  
  for (const admin of admins) {
    const { data: existing } = await supabase
      .from('users')
      .select('id, isAdmin')
      .eq('email', admin.email)
      .single();
    
    if (existing) {
      const { error } = await supabase
        .from('users')
        .update({ isAdmin: true, updated_at: new Date().toISOString() })
        .eq('email', admin.email);
      
      if (error) {
        console.log(`   ✗ ${admin.email}: ${error.message}`);
      } else {
        console.log(`   ✓ ${admin.email}: UPDATED`);
      }
    } else {
      const { error } = await supabase
        .from('users')
        .insert({
          id: `admin-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          email: admin.email,
          name: admin.name,
          isAdmin: true,
          waiverAccepted: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      
      if (error) {
        console.log(`   ✗ ${admin.email}: ${error.message}`);
      } else {
        console.log(`   ✓ ${admin.email}: CREATED`);
      }
    }
  }
  
  // Verify
  console.log('\nStep 3: Verifying admins...');
  const { data: allUsers, error } = await supabase
    .from('users')
    .select('email, name, isAdmin');
  
  if (!error && allUsers) {
    const admins = allUsers.filter(u => u.isAdmin === true);
    console.log(`\n   Total users: ${allUsers.length}`);
    console.log(`   Admin users: ${admins.length}\n`);
    console.table(admins);
  }
  
  console.log('\n✅ Done! Admins can now login at https://tfmdbooking.vercel.app');
}

setupAdmins();
