// Load environment variables manually
const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());

// We can use dynamic import to load our ESM modules
async function run() {
    const { adminAuth } = await import('./lib/server/config/firebase-admin.js');
    const { default: User } = await import('./lib/server/models/User.js');
    const { default: Group } = await import('./lib/server/models/Group.js');
    
    const count = 1000;
    const batchSize = 10;
    let created = 0;
    let alreadyExisted = 0;

    console.log(`Starting to seed ${count} users with format userX@gmail.com and pwdX...`);

    for (let i = 0; i < count; i += batchSize) {
        const batch = [];
        for (let j = 0; j < batchSize && i + j < count; j++) {
            const userIndex = i + j + 1;
            const email = `user${userIndex}@gmail.com`;
            // Firebase requires passwords to be at least 6 characters long
            const userPassword = `password${userIndex}`;
            
            const createUserTask = async () => {
                try {
                    // 1. Create in Firebase
                    const firebaseUser = await adminAuth.createUser({
                        email,
                        password: userPassword,
                        emailVerified: true,
                        displayName: `Test User ${userIndex}`
                    });

                    // 2. Create in PostgreSQL
                    const pgUser = await User.create({
                        email,
                        firstName: 'Test',
                        lastName: `User ${userIndex}`,
                        firebaseUid: firebaseUser.uid
                    });

                    // 3. Create Default Group
                    await Group.create(pgUser.id, {
                        name: 'default group',
                        description: 'default group details',
                        isDefault: true
                    });

                    return { success: true };
                } catch (e) {
                    if (e.code === 'auth/email-already-exists') {
                        return { alreadyExists: true };
                    }
                    console.error(`Failed to create ${email}:`, e.message);
                    return { error: e.message };
                }
            };

            batch.push(createUserTask());
        }
        
        const results = await Promise.all(batch);
        
        for (const res of results) {
            if (res.success) created++;
            else if (res.alreadyExists) alreadyExisted++;
        }

        console.log(`Progress: ${Math.min(i + batchSize, count)} / ${count} processed. (Created: ${created}, Existed: ${alreadyExisted})`);
    }

    console.log('Seeding complete!');
    process.exit(0);
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
