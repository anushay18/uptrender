/**
 * Role-based access control middleware
 * Checks if authenticated user has required role(s)
 */
export const roleCheck = (allowedRoles = []) => {
  return (req, res, next) => {
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({ 
        success: false,
        error: 'Unauthorized - Authentication required' 
      });
    }

    // Normalize role comparison to be case-insensitive to avoid
    // mismatches like 'admin' vs 'Admin' coming from different sources.
    const allowedNormalized = allowedRoles.map((r) => String(r).toLowerCase());
    const userRole = String(req.user.role || '').toLowerCase();

    // Check if user has required role (case-insensitive)
    if (!allowedNormalized.includes(userRole)) {
      return res.status(403).json({ 
        success: false,
        error: 'Forbidden - Insufficient permissions',
        requiredRoles: allowedRoles,
        userRole: req.user.role
      });
    }

    // User has required role, proceed
    next();
  };
};

/**
 * Check if user is admin
 */
export const isAdmin = roleCheck(['Admin']);

/**
 * Check if user is admin or manager
 */
export const isAdminOrManager = roleCheck(['Admin', 'Manager']);
