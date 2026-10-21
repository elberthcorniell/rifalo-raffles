export type RaffleStatus = 'draft' | 'active' | 'ended' | 'cancelled'
export type RaffleVerificationStatus = 'none' | 'pending' | 'verified' | 'rejected'
export type TicketStatus = 'available' | 'reserved' | 'sold'
export type PurchaseStatus = 'pending' | 'confirmed' | 'rejected'

export type TicketBundleBadge = '' | 'best' | 'vip'

export interface TicketBundle {
  id: string
  quantity: number
  price: number
  label?: string
  badge?: TicketBundleBadge
}

export interface Raffle {
  id: string
  title: string
  image: string
  description: string
  ticketPrice: number
  minTickets: number
  totalTickets: number
  soldTickets: number
  timeLeft: string
  featured?: boolean
  status?: RaffleStatus
  endDate?: string | null
  bundles?: TicketBundle[]
  verificationStatus?: RaffleVerificationStatus
  verificationNote?: string | null
  verificationRequestedAt?: string | null
  verificationReviewedAt?: string | null
  referralEnabled?: boolean
  referralRewardTickets?: number
}

export interface BankAccount {
  id: string
  name: string
  bank: string
  accountNumber: string
  accountType: string
  currency: string
  holderName?: string
  cedula?: string
  isActive?: boolean
  sortOrder?: number
}

export interface DbRaffle {
  id: string
  org_id?: string
  title: string
  description: string
  image_path: string | null
  ticket_price: number
  min_tickets: number
  currency: string
  end_date: string | null
  featured: boolean
  status: RaffleStatus
  verification_status?: RaffleVerificationStatus
  verification_requested_at?: string | null
  verification_reviewed_at?: string | null
  verification_note?: string | null
  referral_enabled?: boolean
  referral_reward_tickets?: number
  created_at?: string
  updated_at?: string
}
