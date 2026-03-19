import { createRouter, createWebHistory } from 'vue-router'

import { useSession } from '@/features/session/model/session'
import { ChatsPage } from '@/pages/chats'
import { CuratorDashboardPage } from '@/pages/dashboard-curator'
import { CuratorCompanyDetailsPage } from '@/pages/curator-company-details'
import { EmployerDashboardPage } from '@/pages/dashboard-employer'
import { ApplicantDashboardPage } from '@/pages/dashboard-applicant'
import { HomePage } from '@/pages/home'
import { LoginPage } from '@/pages/login'
import { NotificationsPage } from '@/pages/notifications'
import { OpportunityDetailsPage } from '@/pages/opportunity-details'
import { ProfileSettingsPage } from '@/pages/profile-settings'
import { PublicCompanyProfilePage } from '@/pages/public-company-profile'
import { PublicStudentProfilePage } from '@/pages/public-student-profile'
import { RegisterPage } from '@/pages/register'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomePage,
    },
    {
      path: '/login',
      name: 'login',
      component: LoginPage,
    },
    {
      path: '/register',
      name: 'register',
      component: RegisterPage,
    },
    {
      path: '/opportunities/:id',
      name: 'opportunity-details',
      component: OpportunityDetailsPage,
    },
    {
      path: '/profile',
      name: 'profile-settings',
      component: ProfileSettingsPage,
      meta: { requiresAuth: true },
    },
    {
      path: '/profiles/students/:id',
      name: 'public-student-profile',
      component: PublicStudentProfilePage,
      meta: { requiresAuth: true },
    },
    {
      path: '/profiles/companies/:id',
      name: 'public-company-profile',
      component: PublicCompanyProfilePage,
      meta: { requiresAuth: true },
    },
    {
      path: '/notifications',
      name: 'notifications',
      component: NotificationsPage,
      meta: { requiresAuth: true },
    },
    {
      path: '/chats/:id?',
      name: 'chats',
      component: ChatsPage,
      meta: { requiresAuth: true },
    },
    {
      path: '/dashboard/applicant',
      name: 'dashboard-applicant',
      component: ApplicantDashboardPage,
      meta: { requiresRole: 'student' },
    },
    {
      path: '/dashboard/employer',
      name: 'dashboard-employer',
      component: EmployerDashboardPage,
      meta: { requiresRole: 'employer' },
    },
    {
      path: '/dashboard/curator',
      name: 'dashboard-curator',
      component: CuratorDashboardPage,
      meta: { requiresRole: 'curator' },
    },
    {
      path: '/dashboard/curator/companies/:id',
      name: 'curator-company-details',
      component: CuratorCompanyDetailsPage,
      meta: { requiresRole: 'curator' },
    },
  ],
})

router.beforeEach(async (to) => {
  const session = useSession()
  const requiredRole = to.meta.requiresRole as string | undefined
  const requiresAuth = Boolean(to.meta.requiresAuth) || Boolean(requiredRole)

  await session.restoreSession()

  if (!requiresAuth) {
    return true
  }

  if (!session.isAuthenticated.value) {
    return '/login'
  }

  if (requiredRole && session.role.value !== requiredRole) {
    return '/'
  }

  return true
})

export { router }
