import jwt from 'jsonwebtoken';
import process from 'process';

// Middleware to authenticate JWT tokens
const authenticate = (req, res, next) => {
  const authHeader = req.header('Authorization');
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, role, iat, exp }
    
    // MASQUERADE PATTERN: Check for impersonation header
    // Only admins can impersonate other users
    const impersonateUserId = req.header('X-Impersonate-User');
    if (impersonateUserId && decoded.role === 'admin') {
      // Store the original admin info for audit purposes
      req.originalAdmin = { ...decoded };
      // Override the user ID to the impersonated user
      req.user = {
        ...decoded,
        id: parseInt(impersonateUserId, 10),
        isImpersonated: true,
        impersonatedBy: decoded.id
      };
      console.log(`[Auth] Admin ${decoded.id} impersonating user ${impersonateUserId}`);
    }
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Middleware to authorize based on roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // If impersonating, check the ORIGINAL admin's role, not the impersonated user's role
    const roleToCheck = req.originalAdmin ? req.originalAdmin.role : req.user.role;
    
    if (!roles.includes(roleToCheck)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

export { authenticate, authorize };