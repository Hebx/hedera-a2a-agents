/**
 * Unit Tests for AP2 TrustScore Negotiation Protocol
 * 
 * Tests AP2TrustScoreNegotiation methods:
 * - createNegotiationRequest
 * - createOffer
 * - acceptOffer
 * - validateNegotiationRequest
 * - validateOffer
 * - enforceTerms
 * - isOfferExpired
 * - getTimeRemaining
 */

import { AP2TrustScoreNegotiation } from '../../src/protocols/AP2Protocol'
import { AP2NegotiationRequest, AP2Offer } from '../../src/marketplace/types'
import { describe, it, expect, beforeEach } from '@jest/globals'

describe('AP2TrustScoreNegotiation', () => {
  const buyerAgentId = '0.0.1234567'
  const producerAgentId = '0.0.7654321'
  const productId = 'trustscore.basic.v1'

  describe('createNegotiationRequest', () => {
    it('should create valid negotiation request', () => {
      const request = AP2TrustScoreNegotiation.createNegotiationRequest(
        productId,
        buyerAgentId,
        '0.5',
        'HBAR',
        { calls: 100, period: 86400 }
      )

      expect(request.type).toBe('AP2::NEGOTIATE')
      expect(request.productId).toBe(productId)
      expect(request.maxPrice).toBe('0.5')
      expect(request.currency).toBe('HBAR')
      expect(request.rateLimit.calls).toBe(100)
      expect(request.rateLimit.period).toBe(86400)
      expect(request.metadata.buyerAgentId).toBe(buyerAgentId)
      expect(request.metadata.timestamp).toBeGreaterThan(0)
    })

    it('should use default rate limit if not provided', () => {
      const request = AP2TrustScoreNegotiation.createNegotiationRequest(
        productId,
        buyerAgentId,
        '0.3'
      )

      expect(request.rateLimit.calls).toBe(100)
      expect(request.rateLimit.period).toBe(86400)
    })
  })

  describe('createOffer', () => {
    it('should create valid offer', () => {
      const offer = AP2TrustScoreNegotiation.createOffer(
        productId,
        producerAgentId,
        '0.3',
        'HBAR',
        { calls: 100, period: 86400 },
        { uptime: '99.9%', responseTime: '< 2s' }
      )

      expect(offer.type).toBe('AP2::OFFER')
      expect(offer.productId).toBe(productId)
      expect(offer.price).toBe('0.3')
      expect(offer.currency).toBe('HBAR')
      expect(offer.slippage).toBe('none')
      expect(offer.rateLimit.calls).toBe(100)
      expect(offer.sla.uptime).toBe('99.9%')
      expect(offer.metadata.producerAgentId).toBe(producerAgentId)
      expect(offer.validUntil).toBeGreaterThan(Date.now())
    })

    it('should set validUntil to 5 minutes from now by default', () => {
      const now = Date.now()
      const offer = AP2TrustScoreNegotiation.createOffer(
        productId,
        producerAgentId,
        '0.3'
      )

      const timeRemaining = offer.validUntil - now
      expect(timeRemaining).toBeGreaterThan(290000) // ~5 minutes
      expect(timeRemaining).toBeLessThan(310000)
    })

    it('should accept custom validUntil', () => {
      const customExpiry = Date.now() + 600000 // 10 minutes
      const offer = AP2TrustScoreNegotiation.createOffer(
        productId,
        producerAgentId,
        '0.3',
        'HBAR',
        { calls: 100, period: 86400 },
        { uptime: '99.9%', responseTime: '< 2s' },
        customExpiry
      )

      expect(offer.validUntil).toBe(customExpiry)
    })
  })

  describe('acceptOffer', () => {
    it('should accept valid offer', () => {
      const offer = AP2TrustScoreNegotiation.createOffer(
        productId,
        producerAgentId,
        '0.3'
      )

      const acceptance = AP2TrustScoreNegotiation.acceptOffer(offer, buyerAgentId)

      expect(acceptance.accepted).toBe(true)
      expect(acceptance.offer).toBe(offer)
      expect(acceptance.buyerAgentId).toBe(buyerAgentId)
      expect(acceptance.acceptedAt).toBeGreaterThan(0)
    })

    it('should throw error for expired offer', () => {
      const expiredOffer: AP2Offer = {
        type: 'AP2::OFFER',
        productId,
        price: '0.3',
        currency: 'HBAR',
        slippage: 'none',
        rateLimit: { calls: 100, period: 86400 },
        sla: { uptime: '99.9%', responseTime: '< 2s' },
        validUntil: Date.now() - 1000, // Expired 1 second ago
        metadata: {
          producerAgentId,
          timestamp: Date.now() - 2000
        }
      }

      expect(() => {
        AP2TrustScoreNegotiation.acceptOffer(expiredOffer, buyerAgentId)
      }).toThrow('Offer expired')
    })
  })

  describe('validateNegotiationRequest', () => {
    it('should validate correct request', () => {
      const request = AP2TrustScoreNegotiation.createNegotiationRequest(
        productId,
        buyerAgentId,
        '0.5'
      )

      const validation = AP2TrustScoreNegotiation.validateNegotiationRequest(request)
      expect(validation.valid).toBe(true)
      expect(validation.error).toBeUndefined()
    })

    it('should reject invalid type', () => {
      const invalidRequest: AP2NegotiationRequest = {
        type: 'INVALID_TYPE' as any,
        productId,
        maxPrice: '0.5',
        currency: 'HBAR',
        rateLimit: { calls: 100, period: 86400 },
        metadata: { buyerAgentId, timestamp: Date.now() }
      }

      const validation = AP2TrustScoreNegotiation.validateNegotiationRequest(invalidRequest)
      expect(validation.valid).toBe(false)
      expect(validation.error).toContain('Invalid request type')
    })

    it('should reject empty productId', () => {
      const request = AP2TrustScoreNegotiation.createNegotiationRequest(
        '',
        buyerAgentId,
        '0.5'
      )

      const validation = AP2TrustScoreNegotiation.validateNegotiationRequest(request)
      expect(validation.valid).toBe(false)
      expect(validation.error).toContain('productId')
    })

    it('should reject invalid maxPrice', () => {
      const request = AP2TrustScoreNegotiation.createNegotiationRequest(
        productId,
        buyerAgentId,
        '-1'
      )

      const validation = AP2TrustScoreNegotiation.validateNegotiationRequest(request)
      expect(validation.valid).toBe(false)
      expect(validation.error).toContain('maxPrice')
    })

    it('should reject invalid currency', () => {
      const invalidRequest: AP2NegotiationRequest = {
        type: 'AP2::NEGOTIATE',
        productId,
        maxPrice: '0.5',
        currency: 'INVALID' as any,
        rateLimit: { calls: 100, period: 86400 },
        metadata: { buyerAgentId, timestamp: Date.now() }
      }

      const validation = AP2TrustScoreNegotiation.validateNegotiationRequest(invalidRequest)
      expect(validation.valid).toBe(false)
      expect(validation.error).toContain('currency')
    })

    it('should reject missing buyerAgentId', () => {
      const invalidRequest: AP2NegotiationRequest = {
        type: 'AP2::NEGOTIATE',
        productId,
        maxPrice: '0.5',
        currency: 'HBAR',
        rateLimit: { calls: 100, period: 86400 },
        metadata: { buyerAgentId: '', timestamp: Date.now() }
      }

      const validation = AP2TrustScoreNegotiation.validateNegotiationRequest(invalidRequest)
      expect(validation.valid).toBe(false)
      expect(validation.error).toContain('buyerAgentId')
    })
  })

  describe('validateOffer', () => {
    it('should validate correct offer', () => {
      const offer = AP2TrustScoreNegotiation.createOffer(
        productId,
        producerAgentId,
        '0.3'
      )

      const validation = AP2TrustScoreNegotiation.validateOffer(offer)
      expect(validation.valid).toBe(true)
      expect(validation.error).toBeUndefined()
    })

    it('should reject expired offer', () => {
      const expiredOffer: AP2Offer = {
        type: 'AP2::OFFER',
        productId,
        price: '0.3',
        currency: 'HBAR',
        slippage: 'none',
        rateLimit: { calls: 100, period: 86400 },
        sla: { uptime: '99.9%', responseTime: '< 2s' },
        validUntil: Date.now() - 1000,
        metadata: {
          producerAgentId,
          timestamp: Date.now() - 2000
        }
      }

      const validation = AP2TrustScoreNegotiation.validateOffer(expiredOffer)
      expect(validation.valid).toBe(false)
      expect(validation.error).toContain('expired')
    })

    it('should reject invalid price', () => {
      const invalidOffer: AP2Offer = {
        type: 'AP2::OFFER',
        productId,
        price: '0',
        currency: 'HBAR',
        slippage: 'none',
        rateLimit: { calls: 100, period: 86400 },
        sla: { uptime: '99.9%', responseTime: '< 2s' },
        validUntil: Date.now() + 300000,
        metadata: {
          producerAgentId,
          timestamp: Date.now()
        }
      }

      const validation = AP2TrustScoreNegotiation.validateOffer(invalidOffer)
      expect(validation.valid).toBe(false)
      expect(validation.error).toContain('price')
    })
  })

  describe('enforceTerms', () => {
    it('should pass when terms are compliant', () => {
      const offer = AP2TrustScoreNegotiation.createOffer(
        productId,
        producerAgentId,
        '0.3',
        'HBAR',
        { calls: 100, period: 86400 },
        { uptime: '99.9%', responseTime: '< 2s' }
      )

      const enforcement = AP2TrustScoreNegotiation.enforceTerms(
        offer,
        '0.3', // Same price
        { calls: 100, period: 86400 }, // Same rate limit
        { uptime: '99.9%', responseTime: '< 2s' } // Same SLA
      )

      expect(enforcement.compliant).toBe(true)
      expect(enforcement.violations).toHaveLength(0)
    })

    it('should detect price violation', () => {
      const offer = AP2TrustScoreNegotiation.createOffer(
        productId,
        producerAgentId,
        '0.3'
      )

      const enforcement = AP2TrustScoreNegotiation.enforceTerms(
        offer,
        '0.5', // Higher price than offered
        { calls: 100, period: 86400 },
        { uptime: '99.9%', responseTime: '< 2s' }
      )

      expect(enforcement.compliant).toBe(false)
      expect(enforcement.violations.length).toBeGreaterThan(0)
      expect(enforcement.violations[0]).toContain('Price violation')
    })

    it('should detect rate limit violation', () => {
      const offer = AP2TrustScoreNegotiation.createOffer(
        productId,
        producerAgentId,
        '0.3',
        'HBAR',
        { calls: 100, period: 86400 }
      )

      const enforcement = AP2TrustScoreNegotiation.enforceTerms(
        offer,
        '0.3',
        { calls: 50, period: 86400 }, // Lower calls than offered
        { uptime: '99.9%', responseTime: '< 2s' }
      )

      expect(enforcement.compliant).toBe(false)
      expect(enforcement.violations.length).toBeGreaterThan(0)
      expect(enforcement.violations[0]).toContain('Rate limit violation')
    })

    it('should detect SLA violation', () => {
      const offer = AP2TrustScoreNegotiation.createOffer(
        productId,
        producerAgentId,
        '0.3',
        'HBAR',
        { calls: 100, period: 86400 },
        { uptime: '99.9%', responseTime: '< 2s' }
      )

      const enforcement = AP2TrustScoreNegotiation.enforceTerms(
        offer,
        '0.3',
        { calls: 100, period: 86400 },
        { uptime: '95.0%', responseTime: '< 2s' } // Lower uptime than offered
      )

      expect(enforcement.compliant).toBe(false)
      expect(enforcement.violations.length).toBeGreaterThan(0)
      expect(enforcement.violations[0]).toContain('SLA violation')
    })
  })

  describe('isOfferExpired', () => {
    it('should return false for valid offer', () => {
      const offer = AP2TrustScoreNegotiation.createOffer(
        productId,
        producerAgentId,
        '0.3'
      )

      expect(AP2TrustScoreNegotiation.isOfferExpired(offer)).toBe(false)
    })

    it('should return true for expired offer', () => {
      const expiredOffer: AP2Offer = {
        type: 'AP2::OFFER',
        productId,
        price: '0.3',
        currency: 'HBAR',
        slippage: 'none',
        rateLimit: { calls: 100, period: 86400 },
        sla: { uptime: '99.9%', responseTime: '< 2s' },
        validUntil: Date.now() - 1000,
        metadata: {
          producerAgentId,
          timestamp: Date.now() - 2000
        }
      }

      expect(AP2TrustScoreNegotiation.isOfferExpired(expiredOffer)).toBe(true)
    })
  })

  describe('getTimeRemaining', () => {
    it('should return positive time for valid offer', () => {
      const offer = AP2TrustScoreNegotiation.createOffer(
        productId,
        producerAgentId,
        '0.3'
      )

      const timeRemaining = AP2TrustScoreNegotiation.getTimeRemaining(offer)
      expect(timeRemaining).toBeGreaterThan(0)
      expect(timeRemaining).toBeLessThanOrEqual(300000) // ~5 minutes
    })

    it('should return 0 for expired offer', () => {
      const expiredOffer: AP2Offer = {
        type: 'AP2::OFFER',
        productId,
        price: '0.3',
        currency: 'HBAR',
        slippage: 'none',
        rateLimit: { calls: 100, period: 86400 },
        sla: { uptime: '99.9%', responseTime: '< 2s' },
        validUntil: Date.now() - 1000,
        metadata: {
          producerAgentId,
          timestamp: Date.now() - 2000
        }
      }

      expect(AP2TrustScoreNegotiation.getTimeRemaining(expiredOffer)).toBe(0)
    })
  })
})

