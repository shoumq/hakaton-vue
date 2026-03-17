import type { PlatformUser } from './types'

export const users: PlatformUser[] = [
  {
    id: 'user-applicant',
    email: 'applicant@career.local',
    displayName: 'Мария Соколова',
    role: 'student',
  },
  {
    id: 'user-employer',
    email: 'employer@career.local',
    displayName: 'Aurora HR',
    role: 'employer',
  },
  {
    id: 'user-curator',
    email: 'admin@career.local',
    displayName: 'Администратор',
    role: 'curator',
  },
]
