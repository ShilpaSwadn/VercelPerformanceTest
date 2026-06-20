import { NextResponse } from 'next/server';
import { signToken } from '@/lib/server/utils/jwt';

export async function POST(request) {
    if (process.env.ENABLE_TEST_LOGIN_ROUTE !== 'true') {
        return NextResponse.json({ success: false, message: 'Test route disabled' }, { status: 404 });
    }

    try {
        const { email, password } = await request.json();

        if (!email || !password) {
            return NextResponse.json({ success: false, message: 'Email and password required' }, { status: 400 });
        }

        const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
        const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            body: JSON.stringify({
                email,
                password,
                returnSecureToken: true
            }),
            headers: { 'Content-Type': 'application/json' }
        });

        const firebaseData = await response.json();

        if (!response.ok) {
            return NextResponse.json({
                success: false,
                message: firebaseData.error?.message || 'Invalid credentials'
            }, { status: 401 });
        }

        const uid = firebaseData.localId;
        const token = signToken({ uid, email, firebaseToken: firebaseData.idToken });

        const redirectResponse = NextResponse.redirect(new URL('/dashboard', request.url), 303);
        redirectResponse.cookies.set('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7 // 7 days
        });

        return redirectResponse;

    } catch (error) {
        console.error('Test Login Redirect error:', error);
        return NextResponse.json({
            success: false,
            message: error.message || 'Error validating credentials'
        }, { status: 500 });
    }
}
