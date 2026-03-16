export function formatMoneyRange(from?: number, to?: number, currency = 'RUB') {
  const formatter = new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  })

  if (from && to) {
    return `${formatter.format(from)} - ${formatter.format(to)}`
  }

  if (from) {
    return `от ${formatter.format(from)}`
  }

  if (to) {
    return `до ${formatter.format(to)}`
  }

  return 'Не указано'
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date))
}

export function pluralize(count: number, one: string, few: string, many: string) {
  const mod10 = count % 10
  const mod100 = count % 100

  if (mod10 === 1 && mod100 !== 11) {
    return one
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return few
  }

  return many
}
