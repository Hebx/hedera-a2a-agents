/**
 * Trust Score API Route
 * 
 * Express route handler for x402 payment-gated trust score endpoint.
 * Based on x402-hedera Express server pattern.
 * 
 * @packageDocumentation
 */

import { Request, Response } from 'express'
import { X402FacilitatorServer } from '../../facilitator/X402FacilitatorServer'
import { ArkhiaAnalyticsService } from '../../services/analytics/ArkhiaAnalyticsService'
import { TrustScoreComputationEngine } from '../../services/analytics/TrustScoreComputationEngine'
import { ProductRegistry } from '../../marketplace/ProductRegistry'
import { PaymentRequirements } from '../../marketplace/types'
import chalk from 'chalk'

/**
 * Trust Score Route Handler
 */
export class TrustScoreRoute {
  private facilitator: X402FacilitatorServer
  private arkhiaService: ArkhiaAnalyticsService
  private computationEngine: TrustScoreComputationEngine
  private productRegistry: ProductRegistry
  private defaultPrice: string // in HBAR (tinybars)

  constructor(
    facilitator: X402FacilitatorServer,
    arkhiaService: ArkhiaAnalyticsService,
    computationEngine: TrustScoreComputationEngine,
    productRegistry: ProductRegistry
  ) {
    this.facilitator = facilitator
    this.arkhiaService = arkhiaService
    this.computationEngine = computationEngine
    this.productRegistry = productRegistry
    
    // Default price: 0.3 HBAR (for testing, use small amount like 0.0003 HBAR)
    // Get from product registry if available, otherwise use env or default
    const defaultProduct = this.productRegistry.getProduct('trustscore.basic.v1')
    this.defaultPrice = process.env.TRUST_SCORE_PRICE || defaultProduct?.defaultPrice || '0.3' // HBAR format
  }

  /**
   * GET /trustscore/:accountId
   * 
   * Returns trust score for a Hedera account.
   * Requires x402 payment via X-PAYMENT header.
   */
  async getTrustScore(req: Request, res: Response): Promise<void> {
    try {
      const accountId = req.params.accountId

      // Validate account ID format
      if (!accountId || !this.isValidAccountId(accountId)) {
        res.status(400).json({
          error: {
            code: 'INVALID_ACCOUNT_ID',
            message: 'Invalid Hedera account ID format. Expected format: 0.0.xxxxx',
            timestamp: Date.now()
          }
        })
        return
      }

      // Check for payment header
      const paymentHeader = req.headers['x-payment'] as string | undefined

      if (!paymentHeader) {
        // Return 402 Payment Required
        const paymentRequirements = this.createPaymentRequirements(accountId)
        
        res.status(402).json({
          error: {
            code: 'PAYMENT_REQUIRED',
            message: 'Payment required to access trust score',
            payment: paymentRequirements,
            timestamp: Date.now()
          }
        })
        return
      }

      // Verify payment (paymentHeader is guaranteed to be string here)
      const paymentRequirements = this.createPaymentRequirements(accountId)
      const verificationResult = await this.facilitator.verify(paymentHeader as string, paymentRequirements)

      if (!verificationResult.isValid) {
        res.status(402).json({
          error: {
            code: 'PAYMENT_VERIFICATION_FAILED',
            message: 'Payment verification failed',
            reason: verificationResult.invalidReason || 'Invalid payment',
            payment: paymentRequirements,
            timestamp: Date.now()
          }
        })
        return
      }

      // Payment verified - compute trust score
      console.log(chalk.blue(`📊 Computing trust score for ${accountId}...`))

      try {
        // Fetch data from Arkhia
        const accountInfo = await this.arkhiaService.getAccountInfo(accountId)
        const transactions = await this.arkhiaService.getTransactions(accountId, 100)
        const tokenBalances = await this.arkhiaService.getTokenBalances(accountId)
        const hcsMessages = await this.arkhiaService.getHCSMessages(accountId)

        // Compute trust score
        const trustScore = await this.computationEngine.computeScore(
          accountInfo,
          transactions,
          tokenBalances,
          hcsMessages
        )

        // Return trust score with payment receipt
        res.status(200).json({
          account: trustScore.account,
          score: trustScore.score,
          components: trustScore.components,
          riskFlags: trustScore.riskFlags,
          timestamp: trustScore.timestamp,
          payment: {
            verified: true,
            amount: this.defaultPrice,
            currency: 'HBAR'
          }
        })

        console.log(chalk.green(`✅ Trust score delivered for ${accountId}: ${trustScore.score}/100`))

      } catch (error: any) {
        // Handle Arkhia API failures
        console.error(chalk.red(`❌ Error computing trust score: ${error.message}`))
        
        res.status(503).json({
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Trust score computation service unavailable',
            details: error.message,
            timestamp: Date.now()
          }
        })
      }

    } catch (error: any) {
      console.error(chalk.red(`❌ Trust score route error: ${error.message}`))
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
          timestamp: Date.now()
        }
      })
    }
  }

  /**
   * Create payment requirements for trust score request
   */
  private createPaymentRequirements(accountId: string): PaymentRequirements {
    const hederaAccountId = process.env.HEDERA_ACCOUNT_ID
    if (!hederaAccountId) {
      throw new Error('HEDERA_ACCOUNT_ID environment variable is required')
    }

    // Get price from product registry (preferred) or use default
    const defaultProduct = this.productRegistry.getProduct('trustscore.basic.v1')
    const price = defaultProduct?.defaultPrice || process.env.TRUST_SCORE_PRICE || '0.3' // HBAR format

    return {
      scheme: 'exact',
      network: 'hedera-testnet',
      asset: 'HBAR',
      payTo: hederaAccountId,
      maxAmountRequired: price, // HBAR format (e.g., "0.3")
      resource: `/trustscore/${accountId}`,
      description: `Trust score for account ${accountId}`,
      mimeType: 'application/json',
      maxTimeoutSeconds: 300 // 5 minutes
    }
  }

  /**
   * Validate Hedera account ID format
   */
  private isValidAccountId(accountId: string): boolean {
    // Format: 0.0.xxxxx where x is a digit
    const accountIdPattern = /^0\.0\.\d+$/
    return accountIdPattern.test(accountId)
  }
}

