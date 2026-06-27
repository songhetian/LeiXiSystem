import React from 'react'
import AccessControl from '@/components/AccessControl'

interface PermissionGateProps {
  permission: string
  children: React.ReactNode
  fallback?: React.ReactNode
}

function PermissionGate({ permission, children, fallback = null }: PermissionGateProps) {
  return (
    <AccessControl permission={permission} fallback={fallback}>
      {children}
    </AccessControl>
  )
}

export default PermissionGate
