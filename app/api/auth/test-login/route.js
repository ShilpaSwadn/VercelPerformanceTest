import { NextResponse } from 'next/server';

export async function POST(request) {
    // Easily enable/disable via environment variable to protect production
    if (process.env.ENABLE_TEST_LOGIN_ROUTE !== 'true') {
        return NextResponse.json({ success: false, message: 'Test route disabled' }, { status: 404 });
    }

    try {
        const { email, password } = await request.json();

        if (!email || !password) {
            return NextResponse.json({ success: false, message: 'Email and password required' }, { status: 400 });
        }

        // Validate credentials directly with Firebase REST API
        const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
        const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            body: JSON.stringify({
                email,
                password,
                returnSecureToken: false // Phase 1: Do not generate/return tokens
            }),
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            const data = await response.json();
            return NextResponse.json({
                success: false,
                message: data.error?.message || 'Invalid credentials'
            }, { status: 401 });
        }

        // Phase 1 Goal: Return HTTP 200 success response only
        // - No JWT tokens
        // - No sessions
        // - No dashboard redirection
        // - No post-login operations
        return NextResponse.json({
            success: true,
            message: 'Login successful'
        });

    } catch (error) {
        console.error('Test Login error:', error);
        return NextResponse.json({
            success: false,
            message: error.message || 'Error validating credentials'
        }, { status: 500 });
    }
}
