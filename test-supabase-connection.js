import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://oubkbvypiabgfulnhsnd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91YmtidnlwaWFiZ2Z1bG5oc25kIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTYwMzAzNiwiZXhwIjoyMDg1MTc5MDM2fQ.o9frJkStEODqbxWezbaSNTE8ZDgCPI_cFu35Pvya05Y';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  console.log('🔄 Testing Supabase connection...');

  try {
    // Test 1: Check profiles table
    console.log('\n📋 Querying profiles table...');
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, full_name, role')
      .limit(5);

    if (profilesError) {
      console.error('❌ Profiles query error:', profilesError.message);
    } else {
      console.log('✅ Profiles query successful!');
      console.log(`   Found ${profiles?.length || 0} profiles:`);
      profiles?.forEach(p => {
        console.log(`   - ${p.email} (${p.role})`);
      });
    }

    // Test 2: Check documents table
    console.log('\n📄 Querying documents table...');
    const { data: documents, error: docsError } = await supabase
      .from('documents')
      .select('id, title, type, school, is_approved')
      .limit(5);

    if (docsError) {
      console.error('❌ Documents query error:', docsError.message);
    } else {
      console.log('✅ Documents query successful!');
      console.log(`   Found ${documents?.length || 0} documents`);
    }

    // Test 3: Check notifications table
    console.log('\n🔔 Querying notifications table...');
    const { data: notifications, error: notifError } = await supabase
      .from('notifications')
      .select('id, title, type, is_read')
      .limit(5);

    if (notifError) {
      console.error('❌ Notifications query error:', notifError.message);
    } else {
      console.log('✅ Notifications query successful!');
      console.log(`   Found ${notifications?.length || 0} notifications`);
    }

    // Test 4: Check auth (if using service role)
    console.log('\n👤 Checking users via RPC...');
    const { data: users, error: usersError } = await supabase.rpc('get_users');

    if (usersError) {
      console.log('⚠️  RPC get_users not available (this is normal)');
    } else {
      console.log('✅ Users RPC successful!');
    }

    console.log('\n✅ All connection tests completed!');

  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
  }
}

testConnection();
