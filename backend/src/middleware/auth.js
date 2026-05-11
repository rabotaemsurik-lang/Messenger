const jwt = require('jsonwebtoken');

// Minimal JWT auth middleware.
// Expects: Authorization: Bearer <token>
module.exports = function auth(req, res, next) {
    try {
        const header = req.headers.authorization;
        const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
        if (!token) return res.status(401).json({ error: 'Немає токену' });

        const secret = process.env.JWT_SECRET;
        if (!secret) return res.status(500).json({ error: 'JWT secret is not configured' });

        const decoded = jwt.verify(token, secret);
        req.user = { id: decoded.id, username: decoded.username };
        return next();
    } catch {
        return res.status(401).json({ error: 'Недійсний токен' });
    }
};

