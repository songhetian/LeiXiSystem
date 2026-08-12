const getUserPermissions = async (pool, userId) => {
  const [permissions] = await pool.query(`
    SELECT DISTINCT p.code
    FROM permissions p
    JOIN role_permissions rp ON p.id = rp.permission_id
    JOIN user_roles ur ON rp.role_id = ur.role_id
    WHERE ur.user_id = ?
  `, [userId])
  return permissions.map(p => p.code)
}

const hasPermission = (userPermissions, requiredPermission) => {
  return userPermissions.includes(requiredPermission)
}

module.exports = {
  getUserPermissions,
  hasPermission
}
