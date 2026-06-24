import React from 'react'
import { Button } from '@arco-design/web-react'

interface PermissionGateProps {
  permission: string
  children: React.ReactNode
  fallback?: React.ReactNode
}

function PermissionGate({ permission, children, fallback = null }: PermissionGateProps) {
  const hasPermission = true

  if (!hasPermission) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

export default PermissionGate
