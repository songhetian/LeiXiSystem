import type { ReactNode } from 'react'
import { useUserStore } from '@/store/user'

type AccessControlProps = {
  permission?: string
  anyOf?: string[]
  fallback?: ReactNode
  children: ReactNode
}

export function hasClientPermission(input: {
  roles?: string[]
  permissions?: string[]
  permission?: string
  anyOf?: string[]
}) {
  const roles = input.roles || []
  const permissions = input.permissions || []
  const required = input.anyOf?.length ? input.anyOf : input.permission ? [input.permission] : []

  if (!required.length) return true
  if (roles.includes('超级管理员') || permissions.includes('*')) return true

  return required.some((permission) => permissions.includes(permission))
}

function AccessControl({ permission, anyOf, fallback = null, children }: AccessControlProps) {
  const permissions = useUserStore((state) => state.permissions)
  const user = useUserStore((state) => state.user)

  const allowed = hasClientPermission({
    roles: user?.roles,
    permissions,
    permission,
    anyOf,
  })

  return allowed ? <>{children}</> : <>{fallback}</>
}

export function Forbidden() {
  return <div style={{ padding: 40, textAlign: 'center' }}><h3>403 没有权限访问该页面</h3></div>
}

export function RouteGuard({ permission, anyOf, children }: AccessControlProps) {
  return (
    <AccessControl permission={permission} anyOf={anyOf} fallback={<Forbidden />}>
      {children}
    </AccessControl>
  )
}

export default AccessControl
