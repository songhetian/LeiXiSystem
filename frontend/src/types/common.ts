export interface RecordWithEmployee {
  employee?: {
    user?: {
      realName?: string
      department?: {
        name?: string
      }
    }
    employeeNo?: string
  }
}
