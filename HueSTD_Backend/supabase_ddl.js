const https = require("https");

const PROJECT_REF = "oubkbvypiabgfulnhsnd";

function runSql(sql, pat) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({ query: sql });
        const options = {
            hostname: "api.supabase.com",
            port: 443,
            path: "/v1/projects/" + PROJECT_REF + "/database/query",
            method: "POST",
            headers: {
                Authorization: "Bearer " + pat,
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(body)
            }
        };
        const req = https.request(options, res => {
            let d = "";
            res.on("data", c => d += c);
            res.on("end", () => resolve({ status: res.statusCode, body: d }));
        });
        req.on("error", reject);
        req.write(body);
        req.end();
    });
}

async function main() {
    const pat = process.argv[2];
    if (!pat) {
        console.log("Usage: node supabase_ddl.js <PAT_TOKEN>");
        console.log("Get PAT at: https://supabase.com/dashboard/account/tokens");
        console.log("Note: Service Role Key does NOT work with the Management API. You need a Personal Access Token (PAT).");
        process.exit(1);
    }

    console.log("Creating page_views table...\n");
    const r1 = await runSql(
        "CREATE TABLE IF NOT EXISTS page_views (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), page_path TEXT NOT NULL DEFAULT '/', visited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), ip_hash TEXT, user_agent TEXT)",
        pat
    );
    console.log("Create table:", r1.status, r1.body.slice(0, 300));

    if (r1.status === 200) {
        console.log("\nCreating index...");
        const r2 = await runSql(
            "CREATE INDEX IF NOT EXISTS idx_page_views_visited_at ON page_views(visited_at DESC)",
            pat
        );
        console.log("Create index:", r2.status, r2.body.slice(0, 200));

        console.log("\nDisabling RLS...");
        const r3 = await runSql(
            "ALTER TABLE page_views DISABLE ROW LEVEL SECURITY",
            pat
        );
        console.log("Disable RLS:", r3.status, r3.body.slice(0, 200));

        console.log("\nDone! Now rebuild and restart the backend.");
    } else {
        console.log("\nFailed. Check your PAT token and try again.");
    }
}

main().catch(console.error);
