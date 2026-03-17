import { createRouter, createWebHistory } from 'vue-router'

import { useSession } from '@/features/session/model/session'
import { CuratorDashboardPage } from '@/pages/dashboard-curator'
import { EmployerDashboardPage } from '@/pages/dashboard-employer'
import { ApplicantDashboardPage } from '@/pages/dashboard-applicant'
import { HomePage } from '@/pages/home'
import { LoginPage } from '@/pages/login'
import { OpportunityDetailsPage } from '@/pages/opportunity-details'
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
  ],
})

router.beforeEach(async (to) => {
  const session = useSession()
  const requiredRole = to.meta.requiresRole as string | undefined

  await session.restoreSession()

  if (!requiredRole) {
    return true
  }

  if (!session.isAuthenticated.value) {
    return '/login'
  }

  if (session.role.value !== requiredRole) {
    return '/'
  }

  return true
})

export { router }
