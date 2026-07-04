import { FastifyRequest } from 'fastify'

export interface AuthUser {
  id: number
  username: string
  realName: string
  departmentId: number | null
  employeeId?: number | null
  roles: string[]
  permissions: string[]
}

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUser
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: AuthUser
  }
}
