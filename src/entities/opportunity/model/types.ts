import type { employmentTags, levelTags, opportunityTypes, technologyTags, workFormats } from '@/shared/config/tags'

export type OpportunityType = (typeof opportunityTypes)[number]
export type WorkFormat = (typeof workFormats)[number]
export type TechnologyTag = (typeof technologyTags)[number]
export type LevelTag = (typeof levelTags)[number]
export type EmploymentTag = (typeof employmentTags)[number]

export type OpportunityStatus = 'active' | 'planned' | 'closed'
export type ApplicationStatus = 'applied' | 'review' | 'accepted' | 'rejected' | 'reserve'

export interface OpportunityLocation {
  city: string
  address?: string
  latitude: number
  longitude: number
  placementLabel: string
}

export interface OpportunityMedia {
  kind: 'image' | 'video'
  label: string
  url: string
}

export interface Opportunity {
  id: string
  title: string
  summary: string
  companyId: string
  companyName: string
  companyAvatarUrl?: string
  companyDescription: string
  companyWebsite: string
  type: OpportunityType
  workFormat: WorkFormat
  location: OpportunityLocation
  publishedAt: string
  expiresAt: string
  salaryFrom?: number
  salaryTo?: number
  technologies: TechnologyTag[]
  levels: LevelTag[]
  employment: EmploymentTag
  contacts: string[]
  resources: string[]
  media: OpportunityMedia[]
  status: OpportunityStatus
}

export interface ApplicantProfile {
  fullName: string
  university: string
  graduationYear: number
  skills: TechnologyTag[]
  portfolioLinks: string[]
  privacy: 'network-only' | 'public' | 'private'
  careerInterests: string[]
}

export interface ContactProfile {
  id: string
  name: string
  title: string
  interests: string[]
  recommendedOpportunityId: string
}

export interface EmployerProfile {
  companyName: string
  description: string
  industry: string
  website: string
  socials: string[]
  verification: {
    status: 'verified' | 'pending'
    method: string
    details: string
  }
}

export interface CuratorProfile {
  displayName: string
  queueSize: number
  permissions: string[]
}

export interface ApplicantApplication {
  opportunityId: string
  status: ApplicationStatus
  updatedAt: string
}

export interface CandidatePipelineItem {
  id: string
  name: string
  targetTitle: string
  status: ApplicationStatus
  note: string
}
