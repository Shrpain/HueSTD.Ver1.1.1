const https = require('https');

const SUPABASE_URL = 'https://oubkbvypiabgfulnhsnd.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91YmtidnlwaWFiZ2Z1bG5oc25kIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTYwMzAzNiwiZXhwIjoyMDg1MTc5MDM2fQ.o9frJkStEODqbxWezbaSNTE8ZDgCPI_cFu35Pvya05Y';

function request(method, path, body, token) {
    return new Promise((resolve, reject) => {
        const bodyStr = body ? JSON.stringify(body) : null;
        const headers = {
            'apikey': SERVICE_KEY,
            'Authorization': `Bearer ${token || SERVICE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        };
        if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr);
        
        const url = new URL(path, SUPABASE_URL);
        const options = {
            hostname: url.hostname,
            port: 443,
            path: url.pathname + url.search,
            method: method,
            headers: headers
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = data ? JSON.parse(data) : null;
                    resolve({ status: res.statusCode, data: parsed, raw: data });
                } catch {
                    resolve({ status: res.statusCode, data: null, raw: data });
                }
            });
        });
        req.on('error', reject);
        if (bodyStr) req.write(bodyStr);
        req.end();
    });
}

async function run() {
    console.log('=== Supabase AI Tables Migration ===\n');
    console.log('Project: https://oubkbvypiabgfulnhsnd.supabase.co\n');

    // === Step 1: Check existing tables via information_schema ===
    console.log('1. Kiểm tra database (dùng information_schema)...');
    
    const checkTbls = await request('GET', 
        '/rest/v1/?table=information_schema.tables&select=table_name,table_schema&table_schema=eq.public&table_name=in.(user_ai_usages,ai_unlock_requests)'
    );
    
    const existingTables = [];
    if (checkTbls.status === 200 && Array.isArray(checkTbls.data)) {
        checkTbls.data.forEach(t => {
            console.log(`   - ${t.table_schema}.${t.table_name}`);
            existingTables.push(t.table_name);
        });
    }
    
    const hasUserAiUsages = existingTables.includes('user_ai_usages');
    const hasUnlockRequests = existingTables.includes('ai_unlock_requests');

    if (!hasUserAiUsages) {
        console.log('\n2a. Tạo bảng user_ai_usages...');
        console.log('   Cần tạo qua Supabase Dashboard SQL Editor.');
        console.log('   File SQL: HueSTD_Backend/AI_UserLimits_SQL.sql');
    } else {
        console.log('\n2a. Bảng user_ai_usages: ✓ TỒN TẠI');
    }

    if (!hasUnlockRequests) {
        console.log('\n2b. Tạo bảng ai_unlock_requests...');
        console.log('   Cần tạo qua Supabase Dashboard SQL Editor.');
        console.log('   File SQL: HueSTD_Backend/AI_UserLimits_SQL.sql');
    } else {
        console.log('\n2b. Bảng ai_unlock_requests: ✓ TỒN TẠI');
    }

    // === Step 2: Check profiles (always should exist) ===
    console.log('\n3. Kiểm tra bảng profiles...');
    const profiles = await request('GET', '/rest/v1/profiles?select=id,email,full_name&limit=5');
    if (profiles.status === 200 && profiles.data) {
        console.log(`   ✓ Tìm thấy ${profiles.data.length} user:`);
        profiles.data.forEach(p => console.log(`     - ${p.email} (${p.full_name || 'khong co ten'})`));
    }

    // === Step 3: Check api_settings ===
    console.log('\n4. Kiểm tra bảng api_settings...');
    const settings = await request('GET', '/rest/v1/api_settings?select=key_name,key_value');
    if (settings.status === 200 && settings.data) {
        console.log(`   ✓ Tìm thấy ${settings.data.length} settings:`);
        settings.data.forEach(s => {
            const masked = s.key_name === 'ai_api_key' ? '***' + s.key_value?.slice(-4) : s.key_value;
            console.log(`     - ${s.key_name}: ${masked}`);
        });
    }

    // === Step 4: Check user_ai_usages data ===
    console.log('\n5. Kiểm tra dữ liệu user_ai_usages...');
    const usages = await request('GET', '/rest/v1/user_ai_usages?select=id,user_id,messages_used,message_limit,is_unlocked&limit=10');
    if (usages.status === 200 && usages.data) {
        console.log(`   ✓ Tìm thấy ${usages.data.length} bản ghi:`);
        if (usages.data.length > 0) {
            usages.data.forEach(u => console.log(`     - user ${u.user_id}: ${u.messages_used}/${u.message_limit} msg (unlocked: ${u.is_unlocked})`));
        } else {
            console.log('     (chua co du lieu - se tu dong tao khi user dau tien chat)');
        }
    } else {
        console.log(`   ✗ Lỗi truy vấn: HTTP ${usages.status} - ${usages.raw?.substring(0, 200)}`);
        console.log('   --> Bang co the chua duoc khai bao voi PostgREST. Can reload schema cache.');
    }

    // === Step 5: Check ai_unlock_requests data ===
    console.log('\n6. Kiểm tra dữ liệu ai_unlock_requests...');
    const reqs = await request('GET', '/rest/v1/ai_unlock_requests?select=id,user_id,status,message&limit=10');
    if (reqs.status === 200 && reqs.data) {
        console.log(`   ✓ Tìm thấy ${reqs.data.length} yêu cầu:`);
        if (reqs.data.length > 0) {
            reqs.data.forEach(r => console.log(`     - [${r.status}] user ${r.user_id}: ${r.message || '(khong co loi nhan)'}`));
        }
    } else {
        console.log(`   ✗ Lỗi truy vấn: HTTP ${reqs.status} - ${reqs.raw?.substring(0, 200)}`);
    }

    // === Final Summary ===
    console.log('\n' + '='.repeat(50));
    console.log('=== KẾT QUẢ ===\n');

    if (hasUserAiUsages && hasUnlockRequests) {
        console.log('✓ Tất cả bảng đã tồn tại trong database!');
        console.log('✓ Hệ thống AI per-user đã sẵn sàng.');
        
        if (usages.status !== 200) {
            console.log('\n⚠ Lưu ý: Bảng đã tạo nhưng PostgREST chưa nhận (HTTP error).');
            console.log('  --> Hãy reload schema cache trong Supabase Dashboard:');
            console.log('     Database > REST (API) > Reload schema');
        }
    } else {
        console.log('✗ Một số bảng chưa tồn tại trong database.');
        console.log('\n📋 HƯỚNG DẪN TẠO BẢNG:');
        console.log('');
        console.log('  Bước 1: Mở Supabase Dashboard');
        console.log('  https://supabase.com/dashboard/project/oubkbvypiabgfulnhsnd/database/sql');
        console.log('');
        console.log('  Bước 2: Paste toàn bộ nội dung file:');
        console.log('  HueSTD_Backend/AI_UserLimits_SQL.sql');
        console.log('');
        console.log('  Bước 3: Nhấn Run (F5 hoặc nút ▶ Run)');
        console.log('');
        console.log('  Bước 4: Chạy lại script này để xác nhận');
    }
}

run().catch(e => {
    console.error('Lỗi nghiêm trong:', e.message);
    process.exit(1);
});
