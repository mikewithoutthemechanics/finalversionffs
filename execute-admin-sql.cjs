const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lxdtovoakxekjrkexbae.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZHRvdm9ha3hla2pya2V4YmFlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjExNjA4MSwiZXhwIjoyMDg3NjkyMDgxfQ.aAWE8zdfCm9mX5yg8vSbEFUuUTpTulVB4jijHASKk3A';

const supabase = createClient(supabaseUrl, serviceKey);

const adminUsers = [
  { email: 'michael@agentcy.co.za', name: 'Michael' },
  { email: 'zelda@thefasciadome.co.za', name: 'Zelda' },
  { email: 'jo@thefasciadome.co.za', name: 'Jo' },
  { email: 'michaelgraemek@gmail.com', name: 'Michael Graeme' }
];

async function setAdmins() {
  console.log('Setting admin users...\n');
  
  for (const user of adminUsers) {
    try {
      // Check if user exists
      const { data: existing, error: checkError } = await supabase
        .from('users')
        .select('id, email, isAdmin')
        .eq('email', user.email)
        .single();
      
      if (checkError && checkError.code !== 'PGRST116') {
        console.error(`❌ Error checking ${user.email}:`, checkError.message);
        continue;
      }
      
      if (existing) {
        // Update existing user
        const { error: updateError } = await supabase
          .from('users')
          .update({ isAdmin: true, updated_at: new Date().toISOString() })
          .eq('email', user.email);
        
        if (updateError) {
          console.error(`❌ Failed to update ${user.email}:`, updateError.message);
        } else {
          console.log(`✅ Updated: ${user.email} (was already in DB)`);
        }
      } else {
        // Insert new user
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            id: `admin-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            email: user.email,
            name: user.name,
            isAdmin: true,
            waiverAccepted: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        
        if (insertError) {
          console.error(`❌ Failed to insert ${user.email}:`, insertError.message);
        } else {
          console.log(`✅ Created: ${user.email} (new user)`);
        }
      }
    } catch (err) {
      console.error(`❌ Error processing ${user.email}:`, err.message);
    }
  }
  
  // Verify
  console.log('\nVerifying admin users...\n');
  const { data: verifyData, error: verifyError } = await supabase
    .from('users')
    .select('email, name, isAdmin, created_at')
    .in('email', adminUsers.map(u => u.email));
  
  if (verifyError) {
    console.error('❌ Verification failed:', verifyError.message);
  } else {
    console.log('Current admin status:');
    console.table(verifyData);
  }
  
  console.log('\n✅ Done!');
}

setAdmins();
