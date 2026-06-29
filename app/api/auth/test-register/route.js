import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/server/config/firebase-admin';
import User from '@/lib/server/models/User.js';
import Group from '@/lib/server/models/Group.js';
import { ensureDbInitialized } from '@/lib/server/middleware/dbInit.js';

export async function POST(request) {
    if (process.env.ENABLE_TEST_LOGIN_ROUTE !== 'true') {
        return NextResponse.json({ success: false, message: 'Test route disabled' }, { status: 404 });
    }

    try {
        await ensureDbInitialized();
        const { email, password } = await request.json();

        if (!email || !password) {
            return NextResponse.json({ success: false, message: 'Email and password required' }, { status: 400 });
        }

        const cleanEmail = email.toLowerCase().trim();

        // 1. Create in Firebase
        const firebaseUser = await adminAuth.createUser({
            email: cleanEmail,
            password: password,
            emailVerified: true, // Auto-verify for testing
            displayName: 'Test User'
        });

        // 2. Create in PostgreSQL
        const pgUser = await User.create({
            email: cleanEmail,
            firstName: 'Test',
            lastName: 'User',
            firebaseUid: firebaseUser.uid
        });

        // 3. Create Default Group
        await Group.create(pgUser.id, {
            name: 'default group',
            description: 'default group details',
            isDefault: true
        });

        return NextResponse.json({
            success: true,
            message: 'Registration successful',
            user: {
                uid: firebaseUser.uid,
                email: cleanEmail
            }
        });

    } catch (error) {
        console.error('Test Register error:', error);
        
        // Handle Firebase duplicate email error gracefully
        if (error.code === 'auth/email-already-exists') {
            return NextResponse.json({
                success: false,
                message: 'Email already exists'
            }, { status: 409 });
        }

        return NextResponse.json({
            success: false,
            message: error.message || 'Error during test registration'
        }, { status: 500 });
    }
}
