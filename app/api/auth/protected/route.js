import { NextResponse } from 'next/server';
import { getJwtPayload } from '@/lib/server/middleware/jwtMiddleware';

export async function GET(request) {
    const payload = getJwtPayload(request);

    if (!payload) {
        return NextResponse.json({
            success: false,
            message: 'Invalid or expired token'
        }, { status: 401 });
    }

    return NextResponse.json({
        success: true,
        message: 'Access granted to protected resource',
        user: {
            uid: payload.uid,
            email: payload.email
        },
        tokenInfo: {
            issuedAt: new Date(payload.iat * 1000).toISOString(),
            expiresAt: new Date(payload.exp * 1000).toISOString()
        }
    });
}
