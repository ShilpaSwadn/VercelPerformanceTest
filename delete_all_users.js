// Load environment variables manually
const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());

async function run() {
    const { adminAuth } = await import('./lib/server/config/firebase-admin.js');
    const { query } = await import('./lib/server/config/database.js');
    
    // 1. Delete all Postgres users
    console.log('Truncating Postgres users...');
    try {
        await query('TRUNCATE public.users CASCADE;');
        console.log('Postgres users truncated successfully.');
    } catch (err) {
        console.log('Fallback to DELETE FROM users...');
        await query('DELETE FROM public.users;');
        console.log('Postgres users deleted successfully.');
    }

    // 2. Delete all Firebase users
    console.log('Starting Firebase user deletion...');
    
    const deleteBatch = async (users) => {
        const uids = users.map(user => user.uid);
        if (uids.length > 0) {
            const result = await adminAuth.deleteUsers(uids);
            console.log(`Successfully deleted ${result.successCount} users. Failed: ${result.failureCount}`);
            if (result.errors.length > 0) {
                console.log('Errors:', result.errors);
            }
        }
    };

    let nextPageToken;
    let totalDeleted = 0;
    
    do {
        // Fetch users in batches of 1000
        const listUsersResult = await adminAuth.listUsers(1000, nextPageToken);
        const users = listUsersResult.users;
        
        if (users.length > 0) {
            console.log(`Found batch of ${users.length} users in Firebase, deleting...`);
            await deleteBatch(users);
            totalDeleted += users.length;
        }
        
        nextPageToken = listUsersResult.pageToken;
    } while (nextPageToken);
    
    console.log(`Finished deleting all Firebase users. Total deleted: ${totalDeleted}`);
    process.exit(0);
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
