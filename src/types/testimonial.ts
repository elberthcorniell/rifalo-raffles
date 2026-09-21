export interface Testimonial {
  id: string
  name: string
  quote: string
  rating: number
  roleLabel: string
  initials: string
  isActive?: boolean
  sortOrder?: number
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
