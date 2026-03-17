export type UserRole = 'guest' | 'student' | 'employer' | 'curator'

export interface PlatformUser {
  id: string
  email: string
  displayName: string
  avatarUrl?: string
  role: Exclude<UserRole, 'guest'>
}
