// Load environment variables manually
const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());

async function run() {
    const { adminAuth } = await import('./lib/server/config/firebase-admin.js');
    const { default: User } = await import('./lib/server/models/User.js');
    const { default: Group } = await import('./lib/server/models/Group.js');
    const { query } = await import('./lib/server/config/database.js');
    
    // We already deleted users, but let's just make sure we truncate postgres to be safe
    console.log('Ensuring Postgres is empty...');
    try {
        await query('TRUNCATE public.users CASCADE;');
    } catch (err) {
        await query('DELETE FROM public.users;');
    }

    // Since Firebase deletion takes a long time, we will skip re-deleting Firebase 
    // and just let it throw 'already exists' for the first 2000 we created.
    
    // 3. SEED 10000 USERS
    const count = 10000;
    const batchSize = 100; // Do 100 at a time
    let created = 0;
    let alreadyExisted = 0;

    console.log(`Starting to seed ${count} users incredibly fast...`);

    for (let i = 0; i < count; i += batchSize) {
        const usersToCreate = [];
        for (let j = 0; j < batchSize && i + j < count; j++) {
            const userIndex = i + j + 1;
            usersToCreate.push({
                index: userIndex,
                email: `user${userIndex}@gmail.com`,
                password: `password${userIndex}`
            });
        }
        
        // 1. Create in Firebase concurrently
        const firebasePromises = usersToCreate.map(u => 
            adminAuth.createUser({
                uid: `test-uid-${u.index}`, // Provide predefined UID so we can sync easily if it exists
                email: u.email,
                password: u.password,
                emailVerified: true,
                displayName: `Test User ${u.index}`
            }).catch(async (e) => {
                if (e.code === 'auth/email-already-exists' || e.code === 'auth/uid-already-exists') {
                    // Try to fetch existing uid
                    try {
                        const existing = await adminAuth.getUserByEmail(u.email);
                        return existing;
                    } catch (fetchErr) {
                        return { uid: `test-uid-${u.index}`, email: u.email, exists: true };
                    }
                }
                throw e;
            })
        );

        const firebaseResults = await Promise.all(firebasePromises);

        // 2. Create in DB sequentially in chunks of 5 to avoid pool timeout
        const chunkSize = 5;
        for (let k = 0; k < firebaseResults.length; k += chunkSize) {
            const chunk = firebaseResults.slice(k, k + chunkSize);
            const dbPromises = chunk.map(async (fbUser, idx) => {
                const uInfo = usersToCreate[k + idx];
                try {
                    // Create in PostgreSQL
                    const pgUser = await User.create({
                        email: uInfo.email,
                        firstName: 'Test',
                        lastName: `User ${uInfo.index}`,
                        firebaseUid: fbUser.uid
                    });

                    // Create Default Group
                    await Group.create(pgUser.id, {
                        name: 'default group',
                        description: 'default group details',
                        isDefault: true
                    });
                    return { success: true };
                } catch (e) {
                    if (e.message.includes('duplicate key value') || e.code === '23505') {
                        return { alreadyExists: true };
                    }
                    console.error(`DB error for ${uInfo.email}:`, e.message);
                    return { error: e.message };
                }
            });

            const dbResults = await Promise.all(dbPromises);
            for (const res of dbResults) {
                if (res.success) created++;
                else if (res.alreadyExists) alreadyExisted++;
            }
        }

        console.log(`Progress: ${Math.min(i + batchSize, count)} / ${count} processed. (Created in DB: ${created}, Existed in DB: ${alreadyExisted})`);
    }

    console.log('Seeding completely finished!');
    process.exit(0);
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
