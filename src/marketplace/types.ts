/**
 * Marketplace type definitions
 * 
 * @packageDocumentation
 */

/**
 * Product Registry Entry
 */
export interface ProductRegistryEntry {
  productId: string            // e.g., "trustscore.basic.v1"
  version: string              // e.g., "v1"
  name: string                 // Human-readable name
  description: string          // Product description
  producerAgentId: string      // Agent providing the service
  endpoint: string              // API endpoint path
  defaultPrice: string         // Default price in HBAR
  currency: 'HBAR' | 'USDC'     // Payment currency
  network: 'hedera-testnet' | 'hedera-mainnet'
  rateLimit: {
    calls: number              // Max calls
    period: number             // Time period in seconds
  }
  sla: {
    uptime: string             // e.g., "99.9%"
    responseTime: string       // e.g., "< 2s"
  }
  createdAt: number
  updatedAt: number
}

/**
 * AP2 Negotiation Request
 */
export interface AP2NegotiationRequest {
  type: 'AP2::NEGOTIATE'
  productId: string            // Product being negotiated
  maxPrice: string             // Maximum price buyer will pay
  currency: 'HBAR' | 'USDC'
  rateLimit: {
    calls: number
    period: number
  }
  metadata: {
    buyerAgentId: string
    timestamp: number
  }
}

/**
 * AP2 Offer
 */
export interface AP2Offer {
  type: 'AP2::OFFER'
  productId: string
  price: string                // Offered price
  currency: 'HBAR' | 'USDC'
  slippage: string            // e.g., "none", "0.1%"
  rateLimit: {
    calls: number
    period: number
  }
  sla: {
    uptime: string
    responseTime: string
  }
  validUntil: number          // Offer expiration timestamp
  metadata: {
    producerAgentId: string
    timestamp: number
  }
}

/**
 * Trust Score Event Types
 */
export type TrustScoreEventType =
  | 'TRUST_NEGOTIATION_STARTED'
  | 'TRUST_NEGOTIATION_AGREED'
  | 'TRUST_COMPUTATION_REQUESTED'
  | 'TRUST_SCORE_DELIVERED'
  | 'PAYMENT_VERIFIED'

/**
 * Trust Score Event
 */
export interface TrustScoreEvent {
  type: TrustScoreEventType
  eventId: string              // Unique event identifier
  timestamp: number
  data: {
    // Event-specific data
    account?: string           // Target account for scoring
    buyerAgentId?: string      // Consumer agent ID
    producerAgentId?: string   // Producer agent ID
    score?: number             // Computed score
    paymentTxHash?: string     // Payment transaction hash
    amount?: string            // Payment amount
    [key: string]: any
  }
}

/**
 * Payment Requirements
 */
export interface PaymentRequirements {
  scheme: 'exact'
  network: 'hedera-testnet' | 'base-sepolia'
  asset: string                // 'HBAR' or USDC contract address
  payTo: string                // Recipient account/address
  maxAmountRequired: string    // Amount in smallest unit (tinybars/wei)
  resource: string              // Resource path
  description: string          // Payment description
  mimeType: string             // Response content type
  maxTimeoutSeconds: number    // Payment validity period
}

