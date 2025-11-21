/**
 * TrustScore Consumer Agent
 * 
 * Autonomous agent that purchases and consumes trust scores for risk assessment.
 * Discovers products, negotiates prices, makes payments, and requests scores.
 * 
 * @packageDocumentation
 */

import { HCS10Client } from '@hashgraphonline/standards-agent-kit'
import axios, { AxiosInstance } from 'axios'
import { ethers } from 'ethers'
import { processPayment } from 'a2a-x402'
import { X402FacilitatorServer } from '../facilitator/X402FacilitatorServer'
import { ProductRegistry } from '../marketplace/ProductRegistry'
import { A2AProtocol } from '../protocols/A2AProtocol'
import { AP2Protocol, AP2TrustScoreNegotiation } from '../protocols/AP2Protocol'
import { A2ANegotiation } from '../protocols/A2ANegotiation'
import { 
  ProductRegistryEntry, 
  AP2NegotiationRequest, 
  AP2Offer,
  TrustScoreEvent,
  TrustScoreEventType,
  PaymentRequirements
} from '../marketplace/types'
import { TrustScore } from '../services/analytics/types'
import { loadEnvIfNeeded } from '../utils/env'
import chalk from 'chalk'

// Load environment variables
loadEnvIfNeeded()

/**
 * TrustScore Consumer Agent
 * 
 * Responsibilities:
 * - Discover available trust score products
 * - Initiate AP2 negotiation with producers
 * - Make x402 payments for API access
 * - Request trust scores for target accounts
 * - Validate and consume trust score responses
 * - Report results to MeshOrchestrator
 */
export class TrustScoreConsumerAgent {
  private hcsClient: HCS10Client
  private agentId: string
  private facilitator: X402FacilitatorServer
  private productRegistry: ProductRegistry
  private a2a: A2AProtocol
  private a2aNegotiation: A2ANegotiation
  private httpClient: AxiosInstance
  private meshOrchestrator?: any // Will be set when registered
  private negotiatedOffers: Map<string, AP2Offer> = new Map() // productId -> offer
  private wallet?: ethers.Wallet // For EVM-based payments (USDC)
  private provider?: ethers.JsonRpcProvider

  constructor() {
    // Get agent credentials
    const agentId = process.env.CONSUMER_AGENT_ID || process.env.HEDERA_ACCOUNT_ID
    const privateKey = process.env.CONSUMER_PRIVATE_KEY || process.env.HEDERA_PRIVATE_KEY

    if (!agentId || !privateKey) {
      throw new Error('Missing required environment variables: CONSUMER_AGENT_ID/CONSUMER_PRIVATE_KEY or HEDERA_ACCOUNT_ID/HEDERA_PRIVATE_KEY')
    }

    this.agentId = agentId

    // Initialize HCS client
    this.hcsClient = new HCS10Client(agentId, privateKey, 'testnet')

    // Initialize services
    this.facilitator = new X402FacilitatorServer()
    this.productRegistry = new ProductRegistry()

    // Initialize wallet for EVM-based payments (if needed)
    const baseRpcUrl = process.env.BASE_RPC_URL
    const walletPrivateKey = process.env.SETTLEMENT_WALLET_PRIVATE_KEY || process.env.CONSUMER_WALLET_PRIVATE_KEY
    if (baseRpcUrl && walletPrivateKey) {
      this.provider = new ethers.JsonRpcProvider(baseRpcUrl)
      this.wallet = new ethers.Wallet(walletPrivateKey, this.provider)
    }

    // Initialize A2A protocol
    this.a2a = new A2AProtocol(this.hcsClient, agentId, ['trustscore', 'payment', 'negotiation'])
    this.a2aNegotiation = new A2ANegotiation(this.a2a)

    // Initialize HTTP client for API requests
    this.httpClient = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }

  /**
   * Initialize agent
   */
  async init(): Promise<void> {
    try {
      console.log(chalk.blue(`🚀 Initializing TrustScoreConsumerAgent: ${this.agentId}`))
      console.log(chalk.green(`✅ TrustScoreConsumerAgent initialized successfully`))
    } catch (error) {
      console.error(chalk.red(`❌ Failed to initialize TrustScoreConsumerAgent:`), error)
      throw error
    }
  }

  /**
   * Discover available products from registry
   */
  async discoverProducts(): Promise<ProductRegistryEntry[]> {
    try {
      console.log(chalk.blue(`🔍 Discovering trust score products...`))
      
      const products = this.productRegistry.getAllProducts()
      
      console.log(chalk.green(`✅ Found ${products.length} products`))
      products.forEach(product => {
        console.log(chalk.gray(`   - ${product.productId}: ${product.name} (${product.defaultPrice} ${product.currency})`))
      })

      return products
    } catch (error) {
      console.error(chalk.red(`❌ Product discovery failed:`), error)
      throw error
    }
  }

  /**
   * Initiate AP2 negotiation with producer
   */
  async negotiatePrice(
    productId: string,
    producerEndpoint: string,
    maxPrice?: string
  ): Promise<AP2Offer | undefined> {
    try {
      console.log(chalk.blue(`💬 Initiating AP2 negotiation for product: ${productId}`))

      // Get product info
      const product = this.productRegistry.getProduct(productId)
      if (!product) {
        throw new Error(`Product ${productId} not found`)
      }

      // Create negotiation request using AP2TrustScoreNegotiation
      const negotiationRequest = AP2TrustScoreNegotiation.createNegotiationRequest(
        product.productId,
        this.agentId,
        maxPrice || product.defaultPrice,
        product.currency,
        product.rateLimit
      )

      // Send negotiation request to producer
      const negotiateUrl = `${producerEndpoint}/ap2/negotiate`
      const response = await this.httpClient.post(negotiateUrl, negotiationRequest)

      const offer: AP2Offer = response.data

      // Validate offer using AP2TrustScoreNegotiation
      const validation = AP2TrustScoreNegotiation.validateOffer(offer)
      if (!validation.valid) {
        throw new Error(`Invalid offer: ${validation.error}`)
      }

      if (offer.type !== 'AP2::OFFER' || offer.productId !== productId) {
        throw new Error('Invalid offer received')
      }

      // Check if offer is expired
      if (AP2TrustScoreNegotiation.isOfferExpired(offer)) {
        throw new Error('Offer has expired')
      }

      // Accept the offer
      const acceptance = AP2TrustScoreNegotiation.acceptOffer(offer, this.agentId)

      // Store negotiated offer
      this.negotiatedOffers.set(productId, offer)

      // Log negotiation event
      await this.logEvent('TRUST_NEGOTIATION_AGREED', {
        buyerAgentId: this.agentId,
        producerAgentId: offer.metadata.producerAgentId,
        productId: productId,
        price: offer.price,
        currency: offer.currency
      })

      console.log(chalk.green(`✅ Negotiation successful: ${offer.price} ${offer.currency}`))
      return offer
    } catch (error) {
      console.error(chalk.red(`❌ Negotiation failed:`), error)
      return undefined
    }
  }

  /**
   * Request trust score for an account
   * 
   * Main method that handles the complete flow:
   * 1. Request score
   * 2. Handle 402 Payment Required
   * 3. Pay via x402 facilitator
   * 4. Retry request with payment header
   * 5. Return score
   */
  async requestTrustScore(
    accountId: string,
    productId: string = 'trustscore.basic.v1',
    producerEndpoint: string
  ): Promise<TrustScore | null> {
    try {
      // Validate account ID format
      if (!this.isValidAccountId(accountId)) {
        throw new Error(`Invalid account ID format: ${accountId}. Expected format: 0.0.xxxxx`)
      }

      console.log(chalk.blue(`📊 Requesting trust score for account: ${accountId}`))

      // Get negotiated offer or use default
      let offer = this.negotiatedOffers.get(productId)
      if (!offer) {
        // Try to negotiate first
        offer = await this.negotiatePrice(productId, producerEndpoint)
        if (!offer) {
          throw new Error('Failed to negotiate price')
        }
      }

      // Create payment requirements
      const paymentRequirements = this.createPaymentRequirements(accountId, offer)

      // Make initial request (will likely get 402)
      const scoreUrl = `${producerEndpoint}/trustscore/${accountId}`
      let response
      try {
        response = await this.httpClient.get(scoreUrl)
      } catch (error: any) {
        if (error.response?.status === 402) {
          // Expected: 402 Payment Required
          console.log(chalk.yellow(`💳 Payment required. Processing payment...`))

          // Pay for access
          const paymentHeader = await this.payForAccess(paymentRequirements)
          if (!paymentHeader) {
            throw new Error('Payment failed')
          }

          // Retry request with payment header
          response = await this.httpClient.get(scoreUrl, {
            headers: {
              'X-PAYMENT': paymentHeader
            }
          })
        } else {
          throw error
        }
      }

      const trustScore: TrustScore = response.data

      // Validate response
      if (!trustScore || typeof trustScore.score !== 'number') {
        throw new Error('Invalid trust score response')
      }

      // Log score delivery event
      await this.logEvent('TRUST_SCORE_DELIVERED', {
        buyerAgentId: this.agentId,
        account: accountId,
        score: trustScore.score,
        productId: productId
      })

      console.log(chalk.green(`✅ Trust score received: ${trustScore.score}/100`))
      return trustScore
    } catch (error) {
      console.error(chalk.red(`❌ Trust score request failed:`), error)
      return null
    }
  }

  /**
   * Pay for API access using x402 facilitator
   * 
   * Uses proper x402 protocol flow:
   * 1. Create payment authorization using processPayment (for EVM) or Hedera SDK (for Hedera)
   * 2. Verify payment via facilitator
   * 3. Settle payment via facilitator (executes actual transfer)
   */
  private async payForAccess(paymentRequirements: PaymentRequirements): Promise<string | null> {
    try {
      const amount = paymentRequirements.maxAmountRequired
      const network = paymentRequirements.network
      
      console.log(chalk.blue(`💳 Paying ${amount} ${paymentRequirements.asset} for access on ${network}...`))

      let paymentPayload: any
      let paymentHeader: string

      // Create payment authorization based on network
      if (network === 'hedera-testnet') {
        // For Hedera, create payment payload manually (Hedera doesn't use EVM wallets)
        // The facilitator will handle the actual Hedera transfer
        paymentPayload = {
          x402Version: 1,
          scheme: paymentRequirements.scheme,
          network: paymentRequirements.network,
          payload: {
            authorization: {
              from: this.agentId, // Hedera account ID
              value: paymentRequirements.maxAmountRequired,
              to: paymentRequirements.payTo,
              validBefore: Math.floor(Date.now() / 1000) + paymentRequirements.maxTimeoutSeconds
            }
          }
        }
        paymentHeader = Buffer.from(JSON.stringify(paymentPayload)).toString('base64')
      } else {
        // For EVM networks (Base Sepolia, etc.), use processPayment from a2a-x402
        if (!this.wallet) {
          throw new Error('Wallet not initialized. Set BASE_RPC_URL and SETTLEMENT_WALLET_PRIVATE_KEY for EVM payments.')
        }

        // Convert requirements to x402 format
        const x402Requirements = {
          scheme: paymentRequirements.scheme,
          network: paymentRequirements.network,
          asset: paymentRequirements.asset,
          payTo: paymentRequirements.payTo,
          maxAmountRequired: paymentRequirements.maxAmountRequired,
          resource: paymentRequirements.resource,
          description: paymentRequirements.description,
          mimeType: paymentRequirements.mimeType,
          maxTimeoutSeconds: paymentRequirements.maxTimeoutSeconds
        }

        // Create payment authorization using x402 protocol
        paymentPayload = await processPayment(x402Requirements as any, this.wallet)
        paymentHeader = Buffer.from(JSON.stringify(paymentPayload)).toString('base64')
      }

      // Verify payment via facilitator
      console.log(chalk.blue('🔍 Verifying payment...'))
      const verificationResult = await this.facilitator.verify(paymentHeader, paymentRequirements)
      
      if (!verificationResult.isValid) {
        throw new Error(`Payment verification failed: ${verificationResult.invalidReason}`)
      }
      console.log(chalk.green('✅ Payment verification successful'))

      // Settle payment via facilitator (executes actual transfer)
      console.log(chalk.blue('🏦 Settling payment...'))
      const paymentResult = await this.facilitator.settle(
        paymentHeader,
        paymentRequirements
      )

      if (!paymentResult || !paymentResult.success || !paymentResult.txHash) {
        throw new Error(`Payment settlement failed: ${paymentResult?.error || 'Unknown error'}`)
      }

      // Log payment verification
      await this.logEvent('PAYMENT_VERIFIED', {
        buyerAgentId: this.agentId,
        amount: paymentRequirements.maxAmountRequired,
        currency: paymentRequirements.asset,
        transactionHash: paymentResult.txHash
      })

      console.log(chalk.green(`✅ Payment successful: ${paymentResult.txHash}`))
      console.log(chalk.gray(`   Network: ${paymentResult.networkId}`))
      return paymentHeader
    } catch (error) {
      console.error(chalk.red(`❌ Payment failed:`), error)
      return null
    }
  }

  /**
   * Create payment requirements from offer
   */
  private createPaymentRequirements(accountId: string, offer: AP2Offer): PaymentRequirements {
    const hederaAccountId = process.env.HEDERA_ACCOUNT_ID
    if (!hederaAccountId) {
      throw new Error('HEDERA_ACCOUNT_ID environment variable is required')
    }

    return {
      scheme: 'exact',
      network: 'hedera-testnet',
      asset: offer.currency === 'HBAR' ? 'HBAR' : 'USDC',
      payTo: offer.metadata.producerAgentId || hederaAccountId,
      maxAmountRequired: offer.price,
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
    const accountIdRegex = /^0\.0\.\d+$/
    return accountIdRegex.test(accountId)
  }

  /**
   * Log event to MeshOrchestrator (if registered)
   */
  private async logEvent(
    eventType: TrustScoreEventType,
    data: any
  ): Promise<void> {
    if (this.meshOrchestrator) {
      await this.meshOrchestrator.logEvent({
        type: eventType,
        eventId: `event-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        timestamp: Date.now(),
        data
      })
    } else {
      // Log locally if orchestrator not available
      console.log(chalk.gray(`📝 Event: ${eventType}`, JSON.stringify(data)))
    }
  }

  /**
   * Register with MeshOrchestrator
   */
  registerOrchestrator(orchestrator: any): void {
    this.meshOrchestrator = orchestrator
    console.log(chalk.blue(`🔗 Consumer agent registered with MeshOrchestrator`))
  }
}

