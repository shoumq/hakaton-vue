import { createRouter, createWebHistory } from 'vue-router'

import { useSession } from '@/features/session/model/session'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/pages/home/ui/HomePage.vue'),
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/pages/login/ui/LoginPage.vue'),
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/pages/register/ui/RegisterPage.vue'),
    },
    {
      path: '/opportunities/:id',
      name: 'opportunity-details',
      component: () => import('@/pages/opportunity-details/ui/OpportunityDetailsPage.vue'),
    },
    {
      path: '/profile',
      name: 'profile-settings',
      component: () => import('@/pages/profile-settings/ui/ProfileSettingsPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/profiles/students/:id',
      name: 'public-student-profile',
      component: () => import('@/pages/public-student-profile/ui/PublicStudentProfilePage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/profiles/students/:userId/resumes/:resumeId',
      name: 'public-resume',
      component: () => import('@/pages/public-resume/ui/PublicResumePage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/profiles/companies/:id',
      name: 'public-company-profile',
      component: () => import('@/pages/public-company-profile/ui/PublicCompanyProfilePage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/notifications',
      name: 'notifications',
      component: () => import('@/pages/notifications/ui/NotificationsPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/chats/:id?',
      name: 'chats',
      component: () => import('@/pages/chats/ui/ChatsPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/contacts',
      name: 'contacts',
      component: () => import('@/pages/contacts/ui/ContactsPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/networking',
      name: 'networking',
      component: () => import('@/pages/networking/ui/NetworkingPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/dashboard/applicant',
      name: 'dashboard-applicant',
      component: () => import('@/pages/dashboard-applicant/ui/ApplicantDashboardPage.vue'),
      meta: { requiresRole: 'student' },
    },
    {
      path: '/dashboard/employer',
      name: 'dashboard-employer',
      component: () => import('@/pages/dashboard-employer/ui/EmployerDashboardPage.vue'),
      meta: { requiresRole: 'employer' },
    },
    {
      path: '/dashboard/curator',
      name: 'dashboard-curator',
      component: () => import('@/pages/dashboard-curator/ui/CuratorDashboardPage.vue'),
      meta: { requiresRole: 'curator' },
    },
    {
      path: '/dashboard/curator/companies/:id',
      name: 'curator-company-details',
      component: () => import('@/pages/curator-company-details/ui/CuratorCompanyDetailsPage.vue'),
      meta: { requiresRole: 'curator' },
    },
  ],
})

router.beforeEach(async (to) => {
  const session = useSession()
  const requiredRole = to.meta.requiresRole as string | undefined
  const requiresAuth = Boolean(to.meta.requiresAuth) || Boolean(requiredRole)

  await session.restoreSession()

  if (!requiresAuth) return true
  if (!session.isAuthenticated.value) return '/login'
  if (requiredRole && session.role.value !== requiredRole) return '/'

  return true
})

export { router }
