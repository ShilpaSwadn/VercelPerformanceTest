import { verifyToken } from '../utils/jwt.js';

export function getJwtPayload(request) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return null;
        }

        const token = authHeader.split('Bearer ')[1];
        return verifyToken(token);
    } catch (error) {
        console.error('JWT verification failed:', error.message);
        return null;
    }
}
