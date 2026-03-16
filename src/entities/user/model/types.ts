export type UserRole = 'guest' | 'applicant' | 'employer' | 'curator'

export interface PlatformUser {
  id: string
  email: string
  password: string
  displayName: string
  role: Exclude<UserRole, 'guest'>
}
