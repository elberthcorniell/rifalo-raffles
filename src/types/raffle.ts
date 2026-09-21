export type RaffleStatus = 'draft' | 'active' | 'ended' | 'cancelled'
export type TicketStatus = 'available' | 'reserved' | 'sold'
export type PurchaseStatus = 'pending' | 'confirmed' | 'rejected'

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
  created_at?: string
  updated_at?: string
}
