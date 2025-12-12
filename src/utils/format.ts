export const parseNumber = (v: string | number): number => {
  if (typeof v === 'number') return v
  return Number(String(v).replace(/[^0-9.]/g, ''))
}

export const formatCurrency = (v: number): string => {
  if (!v && v !== 0) return ''
  return 'R ' + parseNumber(v).toLocaleString('en-ZA')
}
