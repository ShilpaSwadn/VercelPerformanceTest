import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-do-not-use-in-production';

export function signToken(payload) {
    const expiresIn = process.env.JWT_EXPIRES_IN || '24h';
    return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

export function verifyToken(token) {
    return jwt.verify(token, JWT_SECRET);
}
