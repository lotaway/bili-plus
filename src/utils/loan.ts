export const calcMonthlyPayment = (principal: number, monthlyRate: number, months: number): number => {
  if (monthlyRate === 0) return principal / months
  const r = monthlyRate
  const n = months
  return principal * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1)
}
