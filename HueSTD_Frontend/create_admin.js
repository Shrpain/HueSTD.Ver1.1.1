
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://oubkbvypiabgfulnhsnd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91YmtidnlwaWFiZ2Z1bG5oc25kIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTYwMzAzNiwiZXhwIjoyMDg1MTc5MDM2fQ.o9frJkStEODqbxWezbaSNTE8ZDgCPI_cFu35Pvya05Y';

const supabase = createClient(supabaseUrl, supabaseKey);

async function createAdmin() {
    const email = 'admin@huestd.com';
    const password = 'admin123'; // Min 6 chars

    console.log(`Creating admin user: ${email}...`);

    // 1. Create User
    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: 'Administrator' }
    });

    let userId = userData?.user?.id;

    if (userError) {
        if (userError.message.includes('already registered')) {
            console.log('User already exists. Fetching ID...');
            // Try to get user by list or just sign in to get ID? Admin API allow list?
            const { data: listData } = await supabase.auth.admin.listUsers();
            const existingUser = listData.users.find(u => u.email === email);
            if (existingUser) {
                userId = existingUser.id;
                console.log(`Found existing user ID: ${userId}`);
            } else {
                console.error("Could not find existing user ID.");
                return;
            }
        } else {
            console.error('Error creating user:', userError);
            return;
        }
    } else {
        console.log(`User created. ID: ${userId}`);
    }

    if (!userId) {
        console.error("No User ID found.");
        return;
    }

    // 2. Update Profile Role
    console.log('Updating profile role to admin...');
    // Check if profile exists
    const { data: profileCheck } = await supabase.from('profiles').select('*').eq('id', userId).single();

    if (!profileCheck) {
        // Create profile if not exists (Though trigger should handle it, waiting might be needed)
        console.log('Profile not found, inserting...');
        const { error: insertError } = await supabase.from('profiles').insert({
            id: userId,
            email: email,
            full_name: 'Administrator',
            role: 'admin',
            points: 9999
        });
        if (insertError) console.error('Insert profile error:', insertError);
        else console.log('Profile inserted with admin role.');
    } else {
        // Update
        const { error: updateError } = await supabase.from('profiles').update({ role: 'admin' }).eq('id', userId);
        if (updateError) console.error('Update profile error:', updateError);
        else console.log('Profile role updated to admin.');
    }

    console.log('Admin setup complete.');
}

createAdmin();
