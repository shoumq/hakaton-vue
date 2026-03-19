import { loadFromStorage, saveToStorage } from '@/shared/lib/storage'

const STUDENT_PREVIEWS_KEY = 'profile-preview-students'
const COMPANY_PREVIEWS_KEY = 'profile-preview-companies'

export interface StudentProfilePreview {
  id: string
  displayName: string
  avatarUrl?: string
  headline?: string
  about?: string
  resumeId?: string
  coverLetter?: string
  updatedAt?: string
  sourceOpportunityTitle?: string
}

export interface CompanyProfilePreview {
  id: string
  companyName: string
  avatarUrl?: string
  description?: string
  website?: string
  contacts?: string[]
  industry?: string
  sourceOpportunityTitle?: string
}

function loadStudentPreviews() {
  return loadFromStorage<Record<string, StudentProfilePreview>>(STUDENT_PREVIEWS_KEY, {})
}

function loadCompanyPreviews() {
  return loadFromStorage<Record<string, CompanyProfilePreview>>(COMPANY_PREVIEWS_KEY, {})
}

export function saveStudentProfilePreview(preview: StudentProfilePreview) {
  const items = loadStudentPreviews()
  items[preview.id] = preview
  saveToStorage(STUDENT_PREVIEWS_KEY, items)
}

export function getStudentProfilePreview(id: string) {
  return loadStudentPreviews()[id] ?? null
}

export function saveCompanyProfilePreview(preview: CompanyProfilePreview) {
  const items = loadCompanyPreviews()
  items[preview.id] = preview
  saveToStorage(COMPANY_PREVIEWS_KEY, items)
}

export function getCompanyProfilePreview(id: string) {
  return loadCompanyPreviews()[id] ?? null
}
