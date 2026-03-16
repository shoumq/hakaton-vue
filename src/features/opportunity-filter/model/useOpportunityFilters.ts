import { computed, reactive } from 'vue'

import type { Opportunity, OpportunityType, WorkFormat } from '@/entities/opportunity/model/types'

export interface OpportunityFilters {
  query: string
  technology: string
  workFormat: WorkFormat | 'all'
  opportunityType: OpportunityType | 'all'
  salaryFrom: number | null
}

const state = reactive<OpportunityFilters>({
  query: '',
  technology: 'all',
  workFormat: 'all',
  opportunityType: 'all',
  salaryFrom: null,
})

export function useOpportunityFilters(source: Opportunity[]) {
  const filtered = computed(() =>
    source.filter((opportunity) => {
      const normalizedQuery = state.query.trim().toLowerCase()

      const matchesQuery =
        !normalizedQuery ||
        opportunity.title.toLowerCase().includes(normalizedQuery) ||
        opportunity.companyName.toLowerCase().includes(normalizedQuery) ||
        opportunity.location.city.toLowerCase().includes(normalizedQuery)

      const matchesTechnology =
        state.technology === 'all' || opportunity.technologies.includes(state.technology as never)

      const matchesWorkFormat =
        state.workFormat === 'all' || opportunity.workFormat === state.workFormat

      const matchesType =
        state.opportunityType === 'all' || opportunity.type === state.opportunityType

      const matchesSalary =
        state.salaryFrom === null || (opportunity.salaryTo ?? opportunity.salaryFrom ?? 0) >= state.salaryFrom

      return (
        matchesQuery &&
        matchesTechnology &&
        matchesWorkFormat &&
        matchesType &&
        matchesSalary
      )
    }),
  )

  function reset() {
    state.query = ''
    state.technology = 'all'
    state.workFormat = 'all'
    state.opportunityType = 'all'
    state.salaryFrom = null
  }

  return {
    filters: state,
    filtered,
    reset,
  }
}
