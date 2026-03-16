import type {
  ApplicantApplication,
  ApplicantProfile,
  CandidatePipelineItem,
  ContactProfile,
  CuratorProfile,
  EmployerProfile,
  Opportunity,
} from './types'

export const opportunities: Opportunity[] = [
  {
    id: 'opp-1',
    title: 'Frontend Internship / Vue',
    summary:
      'Стажировка для студентов 3-4 курса: работа над внутренним design system, поддержка пользовательских сценариев и базовая аналитика.',
    companyId: 'company-aurora',
    companyName: 'Aurora Cloud',
    companyDescription: 'Платформа для инженерных команд, развивающая облачные сервисы и tooling.',
    companyWebsite: 'https://aurora.example.com',
    type: 'internship',
    workFormat: 'hybrid',
    location: {
      city: 'Москва',
      address: 'Ленинградский проспект, 39',
      latitude: 55.7904,
      longitude: 37.5468,
      placementLabel: 'Москва, офис Aurora Cloud',
    },
    publishedAt: '2026-03-01',
    expiresAt: '2026-04-10',
    salaryFrom: 70000,
    salaryTo: 90000,
    technologies: ['Vue', 'TypeScript', 'JavaScript'],
    levels: ['Intern', 'Junior'],
    employment: 'part-time',
    contacts: ['internships@aurora.example.com', '@aurora_hr'],
    resources: ['https://aurora.example.com/careers/frontend-intern'],
    media: [{ kind: 'image', label: 'Команда продукта', url: '/favicon.svg' }],
    status: 'active',
  },
  {
    id: 'opp-2',
    title: 'Junior Python Backend Engineer',
    summary:
      'Разработка API для платформы рекомендаций. Нужны основы асинхронного Python, SQL и понимание CI/CD.',
    companyId: 'company-nebula',
    companyName: 'Nebula AI',
    companyDescription: 'Команда AI-платформы для рекомендательных систем и корпоративных данных.',
    companyWebsite: 'https://nebula.example.com',
    type: 'vacancy',
    workFormat: 'remote',
    location: {
      city: 'Санкт-Петербург',
      latitude: 59.9343,
      longitude: 30.3351,
      placementLabel: 'Санкт-Петербург, штаб-квартира Nebula AI',
    },
    publishedAt: '2026-02-26',
    expiresAt: '2026-03-30',
    salaryFrom: 140000,
    salaryTo: 180000,
    technologies: ['Python', 'SQL', 'Docker'],
    levels: ['Junior'],
    employment: 'full-time',
    contacts: ['jobs@nebula.example.com'],
    resources: ['https://nebula.example.com/jobs/python-junior'],
    media: [{ kind: 'video', label: 'Видео о продукте', url: 'https://nebula.example.com/video' }],
    status: 'active',
  },
  {
    id: 'opp-3',
    title: 'Mentorship Program: Data Engineering Track',
    summary:
      '12-недельная программа с менторами из индустрии, code review, карьерные консультации и защита capstone-проекта.',
    companyId: 'company-lattice',
    companyName: 'Lattice Data',
    companyDescription: 'Консалтинг и продуктовая разработка в области data engineering и observability.',
    companyWebsite: 'https://lattice.example.com',
    type: 'mentorship',
    workFormat: 'remote',
    location: {
      city: 'Казань',
      latitude: 55.7961,
      longitude: 49.1064,
      placementLabel: 'Казань, город менторской программы',
    },
    publishedAt: '2026-03-05',
    expiresAt: '2026-04-25',
    technologies: ['Python', 'SQL', 'Data Science'],
    levels: ['Junior', 'Middle'],
    employment: 'project',
    contacts: ['mentors@lattice.example.com'],
    resources: ['https://lattice.example.com/mentorship'],
    media: [{ kind: 'image', label: 'Программа менторства', url: '/favicon.svg' }],
    status: 'active',
  },
  {
    id: 'opp-4',
    title: 'Open Tech Day / Hackathon Weekend',
    summary:
      'Очный карьерный день с зонами компаний, хакатоном и лекциями по backend, mobile и product engineering.',
    companyId: 'company-vector',
    companyName: 'Vector Labs',
    companyDescription: 'R&D-команда, занимающаяся enterprise-интеграциями и промышленным софтом.',
    companyWebsite: 'https://vector.example.com',
    type: 'event',
    workFormat: 'office',
    location: {
      city: 'Екатеринбург',
      address: 'ул. Бориса Ельцина, 3',
      latitude: 56.8431,
      longitude: 60.5917,
      placementLabel: 'Екатеринбург, площадка мероприятия',
    },
    publishedAt: '2026-03-09',
    expiresAt: '2026-05-14',
    technologies: ['Java', 'Go', 'C#'],
    levels: ['Intern', 'Junior', 'Middle'],
    employment: 'project',
    contacts: ['events@vector.example.com'],
    resources: ['https://vector.example.com/opentechday'],
    media: [{ kind: 'image', label: 'Программа мероприятия', url: '/favicon.svg' }],
    status: 'planned',
  },
  {
    id: 'opp-5',
    title: 'QA Automation Engineer',
    summary:
      'Автоматизация end-to-end регресса, интеграция с пайплайнами и поддержка тестовой архитектуры продукта.',
    companyId: 'company-orbit',
    companyName: 'Orbit Fintech',
    companyDescription: 'Финтех-платформа для платежной аналитики и B2B-расчётов.',
    companyWebsite: 'https://orbit.example.com',
    type: 'vacancy',
    workFormat: 'office',
    location: {
      city: 'Новосибирск',
      address: 'Красный проспект, 25',
      latitude: 55.0302,
      longitude: 82.9204,
      placementLabel: 'Новосибирск, офис Orbit Fintech',
    },
    publishedAt: '2026-02-20',
    expiresAt: '2026-03-21',
    salaryFrom: 160000,
    salaryTo: 220000,
    technologies: ['QA Automation', 'Java', 'Docker'],
    levels: ['Junior', 'Middle'],
    employment: 'full-time',
    contacts: ['qa@orbit.example.com'],
    resources: ['https://orbit.example.com/jobs/qa-automation'],
    media: [{ kind: 'image', label: 'QA стек', url: '/favicon.svg' }],
    status: 'active',
  },
  {
    id: 'opp-6',
    title: 'Junior Fullstack Developer',
    summary:
      'Разработка интерфейсов, внутренних сервисов и документации. Хороший старт для инженера с pet-проектами и стажировками.',
    companyId: 'company-aurora',
    companyName: 'Aurora Cloud',
    companyDescription: 'Платформа для инженерных команд, развивающая облачные сервисы и tooling.',
    companyWebsite: 'https://aurora.example.com',
    type: 'vacancy',
    workFormat: 'remote',
    location: {
      city: 'Москва',
      latitude: 55.7558,
      longitude: 37.6173,
      placementLabel: 'Москва, удалённая команда Aurora Cloud',
    },
    publishedAt: '2026-03-10',
    expiresAt: '2026-04-15',
    salaryFrom: 170000,
    salaryTo: 230000,
    technologies: ['Vue', 'Node.js', 'TypeScript', 'PostgreSQL'],
    levels: ['Junior'],
    employment: 'full-time',
    contacts: ['career@aurora.example.com'],
    resources: ['https://aurora.example.com/jobs/fullstack-junior'],
    media: [{ kind: 'image', label: 'Команда fullstack', url: '/favicon.svg' }],
    status: 'active',
  },
]

export const applicantProfile: ApplicantProfile = {
  fullName: 'Мария Соколова',
  university: 'ИТМО',
  graduationYear: 2027,
  skills: ['Python', 'Vue', 'TypeScript', 'SQL'],
  portfolioLinks: ['https://github.com/maria-sokolova', 'https://maria.dev/portfolio'],
  privacy: 'network-only',
  careerInterests: ['Frontend', 'Platform Engineering', 'Developer Experience'],
}

export const applicantApplications: ApplicantApplication[] = [
  { opportunityId: 'opp-1', status: 'review', updatedAt: '2026-03-08' },
  { opportunityId: 'opp-2', status: 'applied', updatedAt: '2026-03-10' },
  { opportunityId: 'opp-3', status: 'accepted', updatedAt: '2026-03-12' },
]

export const applicantSavedOpportunityIds = ['opp-4', 'opp-6']

export const applicantContacts: ContactProfile[] = [
  {
    id: 'contact-1',
    name: 'Илья Петров',
    title: 'Backend Student @ MIPT',
    interests: ['Go', 'Distributed Systems', 'Hackathons'],
    recommendedOpportunityId: 'opp-4',
  },
  {
    id: 'contact-2',
    name: 'Анна Ким',
    title: 'Frontend Intern @ Aurora Cloud',
    interests: ['Vue', 'Design Systems'],
    recommendedOpportunityId: 'opp-1',
  },
]

export const employerProfile: EmployerProfile = {
  companyName: 'Aurora Cloud',
  description: 'Облачная платформа для инженерных команд и внутренних DevEx-инструментов.',
  industry: 'B2B SaaS / Cloud',
  website: 'https://aurora.example.com',
  socials: ['https://t.me/auroracloud', 'https://www.linkedin.com/company/aurora-cloud'],
  verification: {
    status: 'verified',
    method: 'Проверка корпоративной почты + ИНН + сайт компании',
    details:
      'Работодатель получает право публикации после подтверждения домена электронной почты, ИНН и ручной проверки куратора.',
  },
}

export const employerOpportunityIds = ['opp-1', 'opp-6']

export const employerCandidates: CandidatePipelineItem[] = [
  {
    id: 'candidate-1',
    name: 'Мария Соколова',
    targetTitle: 'Frontend Internship / Vue',
    status: 'review',
    note: 'Сильное портфолио и живой GitHub. Нужен технический скрининг.',
  },
  {
    id: 'candidate-2',
    name: 'Егор Романов',
    targetTitle: 'Junior Fullstack Developer',
    status: 'reserve',
    note: 'Хороший стек, но пока слабая архитектурная база.',
  },
]

export const curatorProfile: CuratorProfile = {
  displayName: 'Администратор платформы',
  queueSize: 7,
  permissions: [
    'Создание учётных записей кураторов',
    'Модерация карточек возможностей',
    'Ревизия кабинетов работодателей и соискателей',
    'Подтверждение верификации компаний',
  ],
}

export const curatorModerationQueue = [
  {
    id: 'mod-1',
    entity: 'company',
    target: 'Vector Labs',
    action: 'Проверить документы компании и домен корпоративной почты',
    priority: 'high',
  },
  {
    id: 'mod-2',
    entity: 'opportunity',
    target: 'Open Tech Day / Hackathon Weekend',
    action: 'Уточнить программу мероприятия и дедлайн регистрации',
    priority: 'medium',
  },
  {
    id: 'mod-3',
    entity: 'applicant',
    target: 'Мария Соколова',
    action: 'Проверить публичность профиля и ссылки на портфолио',
    priority: 'low',
  },
]
