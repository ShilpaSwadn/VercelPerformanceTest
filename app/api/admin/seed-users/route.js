import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/server/config/firebase-admin.js';
import User from '@/lib/server/models/User.js';
import Group from '@/lib/server/models/Group.js';
import { ensureDbInitialized } from '@/lib/server/middleware/dbInit.js';

export async function POST(request) {
    // Security check: Never run this in production!
    if (process.env.NODE_ENV === 'production' && process.env.ENABLE_SEED_ROUTE !== 'true') {
        return NextResponse.json({ error: 'Seed route disabled in production' }, { status: 403 });
    }

    try {
        await ensureDbInitialized();
        
        const { count = 1000, password = 'password123', prefix = 'testuser' } = await request.json();
        
        // We will process in small batches to avoid rate limits and memory issues
        const batchSize = 10;
        let created = 0;
        let alreadyExisted = 0;

        console.log(`Starting to seed ${count} users...`);

        for (let i = 0; i < count; i += batchSize) {
            const batch = [];
            for (let j = 0; j < batchSize && i + j < count; j++) {
                const userIndex = i + j + 1;
                const email = `user${userIndex}@gmail.com`;
                // Firebase requires minimum 6 characters for login. 'pwd1' is 4 chars and will fail.
                const userPassword = `passwd${userIndex}`; 
                
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

                        // 3. Create Default Group (required for Phase 3/4)
                        await Group.create(pgUser.id, {
                            name: 'default group',
                            description: 'default group details',
                            isDefault: true
                        });

                        return { success: true };
                    } catch (e) {
                        if (e.code === 'auth/email-already-exists') {
                            // Update the existing user's password to ensure it matches what we expect
                            try {
                                const existingUser = await adminAuth.getUserByEmail(email);
                                await adminAuth.updateUser(existingUser.uid, { password: userPassword });
                                return { alreadyExists: true, passwordUpdated: true };
                            } catch (updateErr) {
                                console.error(`Failed to update password for ${email}:`, updateErr.message);
                                return { error: updateErr.message };
                            }
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

        return NextResponse.json({ 
            success: true, 
            message: 'Seeding completed',
            stats: {
                requested: count,
                created,
                alreadyExisted
            }
        });
    } catch (error) {
        console.error('Seeding error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
