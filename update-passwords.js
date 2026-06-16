const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());

async function run() {
    const { adminAuth } = await import('./lib/server/config/firebase-admin.js');

    if (!adminAuth) {
        console.error('Firebase Admin not initialized. Check your .env file.');
        process.exit(1);
    }

    const count = 1000;
    const batchSize = 10;
    let updated = 0;
    let notFound = 0;

    console.log(`Updating passwords for ${count} users (userX@gmail.com -> passwordX)...`);

    for (let i = 0; i < count; i += batchSize) {
        const batch = [];
        for (let j = 0; j < batchSize && i + j < count; j++) {
            const userIndex = i + j + 1;
            const email = `user${userIndex}@gmail.com`;
            const password = `password${userIndex}`;

            const task = async () => {
                try {
                    const existingUser = await adminAuth.getUserByEmail(email);
                    await adminAuth.updateUser(existingUser.uid, { password });
                    return { success: true };
                } catch (e) {
                    if (e.code === 'auth/user-not-found') {
                        return { notFound: true };
                    }
                    console.error(`Failed to update ${email}:`, e.message);
                    return { error: e.message };
                }
            };

            batch.push(task());
        }

        const results = await Promise.all(batch);
        for (const res of results) {
            if (res.success) updated++;
            else if (res.notFound) notFound++;
        }

        console.log(`Progress: ${Math.min(i + batchSize, count)} / ${count} | Updated: ${updated} | Not found: ${notFound}`);
    }

    console.log(`\nDone! Updated: ${updated}, Not found: ${notFound}`);
    process.exit(0);
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
