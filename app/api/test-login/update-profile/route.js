import { NextResponse } from 'next/server';
import authService from '@/lib/server/services/authService.js';
import { ensureDbInitialized } from '@/lib/server/middleware/dbInit.js';
import { adminAuth } from '@/lib/server/config/firebase-admin.js';

export async function PUT(request) {
    if (process.env.ENABLE_TEST_LOGIN_ROUTE !== 'true') {
        return NextResponse.json({ success: false, message: 'Test route disabled' }, { status: 404 });
    }

    try {
        await ensureDbInitialized();
        
        // Parse request body
        const body = await request.json();
        const { email, uid, ...updates } = body;

        if (!email && !uid) {
            return NextResponse.json({ success: false, message: 'Email or uid is required' }, { status: 400 });
        }

        let userUid = uid;

        if (!userUid) {
            // Find user by email in Firebase to get UID
            try {
                const firebaseUser = await adminAuth.getUserByEmail(email);
                userUid = firebaseUser.uid;
            } catch (err) {
                return NextResponse.json({ success: false, message: 'User not found in Firebase' }, { status: 404 });
            }
        }

        // Call service to update user profile using Firebase UID, exactly like normal profile API
        const user = await authService.updateProfile(userUid, updates);

        // Return success response matching normal API
        return NextResponse.json({
            success: true,
            message: 'Profile updated successfully',
            data: { user }
        });

    } catch (error) {
        console.error('Update profile error:', error);

        // Handle specific error cases matching normal API
        if (error.message === 'Email already registered') {
            return NextResponse.json({
                success: false,
                message: error.message
            }, { status: 409 });
        }

        if (error.message === 'User not found') {
            return NextResponse.json({
                success: false,
                message: error.message
            }, { status: 404 });
        }

        return NextResponse.json({
            success: false,
            message: 'Error updating profile',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        }, { status: 500 });
    }
}
