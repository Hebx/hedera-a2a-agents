/**
 * AP2 Payment Protocol Implementation
 * 
 * AP2 (A2A Payment Protocol) is used for agent-to-agent payments
 * on the Hedera network. This protocol extends the A2A standard
 * with payment-specific functionality.
 * 
 * @see https://github.com/a2aproject/A2A
 */

import { A2AMessage } from './A2AProtocol'
import chalk from 'chalk'

/**
 * AP2 Payment Request
 */
export interface AP2PaymentRequest {
  protocol: "AP2"
  version: "1.0"
  paymentId: string
  amount: string
  currency: "HBAR" | "USDC"
  recipient: string
  network: "hedera-testnet" | "base-sepolia" | "ethereum-sepolia"
  metadata: {
    purpose: string
    reference: string
    description?: string
  }
  expiry: number
  signature?: string
}

/**
 * AP2 Payment Response
 */
export interface AP2PaymentResponse {
  paymentId: string
  status: "pending" | "processing" | "completed" | "failed" | "rejected"
  transactionHash?: string
  error?: string
  timestamp: number
}

/**
 * AP2 Protocol Implementation
 */
export class AP2Protocol {
  /**
   * Create an AP2 payment request
   */
  static createPaymentRequest(
    paymentId: string,
    amount: string,
    currency: "HBAR" | "USDC",
    recipient: string,
    network: "hedera-testnet" | "base-sepolia" | "ethereum-sepolia",
    metadata: { purpose: string; reference: string; description?: string }
  ): AP2PaymentRequest {
    const request: AP2PaymentRequest = {
      protocol: "AP2",
      version: "1.0",
      paymentId,
      amount,
      currency,
      recipient,
      network,
      metadata,
      expiry: Date.now() + 300000 // 5 minutes
    }

    console.log(chalk.blue(`💳 Creating AP2 payment request: ${JSON.stringify(request)}`))

    return request
  }

  /**
   * Validate an AP2 payment request
   */
  static validatePaymentRequest(request: AP2PaymentRequest): { valid: boolean; error?: string } {
    // Check protocol
    if (request.protocol !== "AP2") {
      return { valid: false, error: "Invalid protocol (expected AP2)" }
    }

    // Check version
    if (request.version !== "1.0") {
      return { valid: false, error: "Invalid version (expected 1.0)" }
    }

    // Check amount
    const amount = parseFloat(request.amount)
    if (isNaN(amount) || amount <= 0) {
      return { valid: false, error: "Invalid amount" }
    }

    // Check expiry
    if (request.expiry < Date.now()) {
      return { valid: false, error: "Payment request expired" }
    }

    // Check metadata
    if (!request.metadata.purpose || !request.metadata.reference) {
      return { valid: false, error: "Missing required metadata (purpose or reference)" }
    }

    console.log(chalk.green(`✅ AP2 payment request validation passed`))

    return { valid: true }
  }

  /**
   * Create AP2 payment message for A2A protocol
   */
  static createAP2Message(paymentRequest: AP2PaymentRequest): any {
    return {
      type: "ap2_payment",
      data: paymentRequest
    }
  }

  /**
   * Parse AP2 payment from A2A message
   */
  static parseAP2Message(message: A2AMessage): AP2PaymentRequest | null {
    if (!message.payload || message.payload.type !== "ap2_payment") {
      return null
    }

    return message.payload.data as AP2PaymentRequest
  }

  /**
   * Create payment response
   */
  static createPaymentResponse(
    paymentId: string,
    status: "pending" | "processing" | "completed" | "failed" | "rejected",
    transactionHash?: string,
    error?: string
  ): AP2PaymentResponse {
    const response: AP2PaymentResponse = {
      paymentId,
      status,
      ...(transactionHash !== undefined && { transactionHash }),
      ...(error !== undefined && { error }),
      timestamp: Date.now()
    }

    console.log(chalk.blue(`📋 AP2 payment response: ${JSON.stringify(response)}`))

    return response
  }

  /**
   * Format payment amount for display
   */
  static formatAmount(amount: string, currency: string): string {
    const numAmount = parseFloat(amount)
    
    if (currency === "HBAR") {
      return `${numAmount} ${currency}`
    } else if (currency === "USDC") {
      return `${numAmount} ${currency}`
    }
    
    return `${amount} ${currency}`
  }

  /**
   * Check if payment request matches response
   */
  static matches(request: AP2PaymentRequest, response: AP2PaymentResponse): boolean {
    return request.paymentId === response.paymentId
  }
}

/**
 * TrustScore-specific AP2 Negotiation Methods
 */

import { AP2NegotiationRequest, AP2Offer } from '../marketplace/types'

/**
 * Extended AP2Protocol with TrustScore negotiation support
 */
export namespace AP2TrustScoreNegotiation {
  /**
   * Default negotiation timeout (5 minutes)
   */
  export const DEFAULT_NEGOTIATION_TIMEOUT = 300000 // 5 minutes

  /**
   * Create AP2 negotiation request for TrustScore products
   * 
   * @param productId - Product identifier (e.g., "trustscore.basic.v1")
   * @param buyerAgentId - Consumer agent ID
   * @param maxPrice - Maximum price buyer is willing to pay
   * @param currency - Payment currency (HBAR or USDC)
   * @param rateLimit - Requested rate limit (calls per period)
   * @returns AP2NegotiationRequest
   */
  export function createNegotiationRequest(
    productId: string,
    buyerAgentId: string,
    maxPrice: string,
    currency: 'HBAR' | 'USDC' = 'HBAR',
    rateLimit: { calls: number; period: number } = { calls: 100, period: 86400 }
  ): AP2NegotiationRequest {
    const request: AP2NegotiationRequest = {
      type: 'AP2::NEGOTIATE',
      productId,
      maxPrice,
      currency,
      rateLimit,
      metadata: {
        buyerAgentId,
        timestamp: Date.now()
      }
    }

    console.log(chalk.blue(`💬 Creating AP2 negotiation request: ${JSON.stringify(request)}`))

    return request
  }

  /**
   * Create AP2 offer response for TrustScore products
   * 
   * @param productId - Product identifier
   * @param producerAgentId - Producer agent ID
   * @param price - Offered price
   * @param currency - Payment currency
   * @param rateLimit - Rate limit terms
   * @param sla - Service level agreement terms
   * @param validUntil - Offer expiration timestamp (default: 5 minutes from now)
   * @returns AP2Offer
   */
  export function createOffer(
    productId: string,
    producerAgentId: string,
    price: string,
    currency: 'HBAR' | 'USDC' = 'HBAR',
    rateLimit: { calls: number; period: number } = { calls: 100, period: 86400 },
    sla: { uptime: string; responseTime: string } = { uptime: '99.9%', responseTime: '< 2s' },
    validUntil?: number
  ): AP2Offer {
    const offer: AP2Offer = {
      type: 'AP2::OFFER',
      productId,
      price,
      currency,
      slippage: 'none',
      rateLimit,
      sla,
      validUntil: validUntil || (Date.now() + DEFAULT_NEGOTIATION_TIMEOUT),
      metadata: {
        producerAgentId,
        timestamp: Date.now()
      }
    }

    console.log(chalk.blue(`📋 Creating AP2 offer: ${JSON.stringify(offer)}`))

    return offer
  }

  /**
   * Accept an AP2 offer (creates acceptance confirmation)
   * 
   * @param offer - The AP2 offer to accept
   * @param buyerAgentId - Consumer agent ID accepting the offer
   * @returns Acceptance confirmation object
   */
  export function acceptOffer(
    offer: AP2Offer,
    buyerAgentId: string
  ): { accepted: boolean; offer: AP2Offer; acceptedAt: number; buyerAgentId: string } {
    // Validate offer is still valid
    if (offer.validUntil < Date.now()) {
      throw new Error(`Offer expired at ${new Date(offer.validUntil).toISOString()}`)
    }

    const acceptance = {
      accepted: true,
      offer,
      acceptedAt: Date.now(),
      buyerAgentId
    }

    console.log(chalk.green(`✅ AP2 offer accepted: ${JSON.stringify(acceptance)}`))

    return acceptance
  }

  /**
   * Validate AP2 negotiation request
   * 
   * @param request - Negotiation request to validate
   * @returns Validation result
   */
  export function validateNegotiationRequest(
    request: AP2NegotiationRequest
  ): { valid: boolean; error?: string } {
    if (request.type !== 'AP2::NEGOTIATE') {
      return { valid: false, error: 'Invalid request type (expected AP2::NEGOTIATE)' }
    }

    if (!request.productId || request.productId.trim() === '') {
      return { valid: false, error: 'Missing or empty productId' }
    }

    const maxPrice = parseFloat(request.maxPrice)
    if (isNaN(maxPrice) || maxPrice <= 0) {
      return { valid: false, error: 'Invalid maxPrice (must be positive number)' }
    }

    if (!['HBAR', 'USDC'].includes(request.currency)) {
      return { valid: false, error: 'Invalid currency (must be HBAR or USDC)' }
    }

    if (!request.rateLimit || request.rateLimit.calls <= 0 || request.rateLimit.period <= 0) {
      return { valid: false, error: 'Invalid rateLimit (calls and period must be positive)' }
    }

    if (!request.metadata?.buyerAgentId) {
      return { valid: false, error: 'Missing buyerAgentId in metadata' }
    }

    return { valid: true }
  }

  /**
   * Validate AP2 offer
   * 
   * @param offer - Offer to validate
   * @returns Validation result
   */
  export function validateOffer(
    offer: AP2Offer
  ): { valid: boolean; error?: string } {
    if (offer.type !== 'AP2::OFFER') {
      return { valid: false, error: 'Invalid offer type (expected AP2::OFFER)' }
    }

    if (!offer.productId || offer.productId.trim() === '') {
      return { valid: false, error: 'Missing or empty productId' }
    }

    const price = parseFloat(offer.price)
    if (isNaN(price) || price <= 0) {
      return { valid: false, error: 'Invalid price (must be positive number)' }
    }

    if (!['HBAR', 'USDC'].includes(offer.currency)) {
      return { valid: false, error: 'Invalid currency (must be HBAR or USDC)' }
    }

    if (offer.validUntil < Date.now()) {
      return { valid: false, error: 'Offer has expired' }
    }

    if (!offer.metadata?.producerAgentId) {
      return { valid: false, error: 'Missing producerAgentId in metadata' }
    }

    return { valid: true }
  }

  /**
   * Enforce negotiated terms (price, rate limits, SLA)
   * 
   * @param offer - The accepted offer
   * @param actualPrice - Actual price charged
   * @param actualRateLimit - Actual rate limit applied
   * @param actualSla - Actual SLA provided
   * @returns Enforcement result
   */
  export function enforceTerms(
    offer: AP2Offer,
    actualPrice: string,
    actualRateLimit: { calls: number; period: number },
    actualSla: { uptime: string; responseTime: string }
  ): { compliant: boolean; violations: string[] } {
    const violations: string[] = []

    // Check price compliance
    const offerPrice = parseFloat(offer.price)
    const chargedPrice = parseFloat(actualPrice)
    if (chargedPrice > offerPrice) {
      violations.push(`Price violation: charged ${chargedPrice} ${offer.currency}, offered ${offerPrice} ${offer.currency}`)
    }

    // Check rate limit compliance
    if (actualRateLimit.calls < offer.rateLimit.calls || actualRateLimit.period > offer.rateLimit.period) {
      violations.push(`Rate limit violation: actual ${actualRateLimit.calls}/${actualRateLimit.period}s, offered ${offer.rateLimit.calls}/${offer.rateLimit.period}s`)
    }

    // Check SLA compliance (basic validation - actual monitoring would be more complex)
    const offerUptime = parseFloat(offer.sla.uptime.replace('%', ''))
    const actualUptime = parseFloat(actualSla.uptime.replace('%', ''))
    if (actualUptime < offerUptime) {
      violations.push(`SLA violation: actual uptime ${actualSla.uptime}, offered ${offer.sla.uptime}`)
    }

    const compliant = violations.length === 0

    if (compliant) {
      console.log(chalk.green(`✅ Terms enforcement passed for offer ${offer.productId}`))
    } else {
      console.log(chalk.red(`❌ Terms enforcement failed for offer ${offer.productId}: ${violations.join(', ')}`))
    }

    return { compliant, violations }
  }

  /**
   * Check if offer is expired
   * 
   * @param offer - Offer to check
   * @returns True if expired
   */
  export function isOfferExpired(offer: AP2Offer): boolean {
    return offer.validUntil < Date.now()
  }

  /**
   * Get time remaining until offer expires
   * 
   * @param offer - Offer to check
   * @returns Milliseconds remaining (0 if expired)
   */
  export function getTimeRemaining(offer: AP2Offer): number {
    const remaining = offer.validUntil - Date.now()
    return remaining > 0 ? remaining : 0
  }
}

/**
 * AP2 Payment Flow:
 * 
 * 1. Agent A creates AP2 payment request
 *    → createsPaymentRequest({ amount: "1000000", currency: "USDC", ... })
 * 
 * 2. Agent A sends AP2 message via A2A protocol
 *    → wraps payment request in A2A message
 *    → sends to Agent B
 * 
 * 3. Agent B receives AP2 payment request
 *    → validates request
 *    → processes payment (or rejects)
 *    → sends AP2 payment response
 * 
 * 4. Agent A receives AP2 payment response
 *    → checks status (completed/failed/rejected)
 *    → records transaction hash if completed
 * 
 * TrustScore Negotiation Flow:
 * 
 * 1. ConsumerAgent creates negotiation request
 *    → AP2TrustScoreNegotiation.createNegotiationRequest(...)
 * 
 * 2. ConsumerAgent sends request to ProducerAgent
 *    → HTTP POST to /ap2/negotiate
 * 
 * 3. ProducerAgent creates offer
 *    → AP2TrustScoreNegotiation.createOffer(...)
 * 
 * 4. ConsumerAgent accepts offer
 *    → AP2TrustScoreNegotiation.acceptOffer(...)
 * 
 * 5. Terms are enforced during service delivery
 *    → AP2TrustScoreNegotiation.enforceTerms(...)
 */

