import type { PlatformUser } from './types'

export const users: PlatformUser[] = [
  {
    id: 'user-applicant',
    email: 'applicant@career.local',
    password: 'demo123',
    displayName: 'Мария Соколова',
    role: 'applicant',
  },
  {
    id: 'user-employer',
    email: 'employer@career.local',
    password: 'demo123',
    displayName: 'Aurora HR',
    role: 'employer',
  },
  {
    id: 'user-curator',
    email: 'admin@career.local',
    password: 'admin123',
    displayName: 'Администратор',
    role: 'curator',
  },
]
