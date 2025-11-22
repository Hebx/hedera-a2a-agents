/**
 * TrustScore Producer Agent
 * 
 * Autonomous agent that computes and sells trust scores using Arkhia analytics.
 * Exposes x402-protected REST API endpoint and participates in AP2 negotiations.
 * 
 * @packageDocumentation
 */

import { HCS10Client } from '@hashgraphonline/standards-agent-kit'
import express, { Express } from 'express'
import { X402FacilitatorServer } from '../facilitator/X402FacilitatorServer'
import { ArkhiaAnalyticsService } from '../services/analytics/ArkhiaAnalyticsService'
import { TrustScoreComputationEngine } from '../services/analytics/TrustScoreComputationEngine'
import { ProductRegistry } from '../marketplace/ProductRegistry'
import { TrustScoreRoute } from '../resource-server/routes/trustScoreRoute'
import { A2AProtocol } from '../protocols/A2AProtocol'
import { AP2Protocol, AP2TrustScoreNegotiation } from '../protocols/AP2Protocol'
import { A2ANegotiation } from '../protocols/A2ANegotiation'
import { 
  ProductRegistryEntry, 
  AP2NegotiationRequest, 
  AP2Offer,
  TrustScoreEvent,
  TrustScoreEventType
} from '../marketplace/types'
import { loadEnvIfNeeded } from '../utils/env'
import chalk from 'chalk'

// Load environment variables
loadEnvIfNeeded()

/**
 * TrustScore Producer Agent
 * 
 * Responsibilities:
 * - Expose x402-protected REST API endpoint `/trustscore/:accountId`
 * - Query Arkhia API for account analytics
 * - Compute trust scores using weighted formula
 * - Enforce payment requirements via x402
 * - Participate in AP2 price negotiation
 * - Log all computations to HCS via MeshOrchestrator
 */
export class TrustScoreProducerAgent {
  private hcsClient: HCS10Client
  private agentId: string
  private app: Express
  private server: any
  private facilitator: X402FacilitatorServer
  private arkhiaService: ArkhiaAnalyticsService
  private computationEngine: TrustScoreComputationEngine
  private productRegistry: ProductRegistry
  private a2a: A2AProtocol
  private a2aNegotiation: A2ANegotiation
  private trustScoreRoute: TrustScoreRoute
  private meshOrchestrator?: any // Will be set when registered
  private rateLimitMap: Map<string, { count: number; resetAt: number }> = new Map()

  constructor() {
    // Get agent credentials
    const agentId = process.env.PRODUCER_AGENT_ID || process.env.HEDERA_ACCOUNT_ID
    const privateKey = process.env.PRODUCER_PRIVATE_KEY || process.env.HEDERA_PRIVATE_KEY

    if (!agentId || !privateKey) {
      throw new Error('Missing required environment variables: PRODUCER_AGENT_ID/PRODUCER_PRIVATE_KEY or HEDERA_ACCOUNT_ID/HEDERA_PRIVATE_KEY')
    }

    this.agentId = agentId

    // Initialize HCS client
    this.hcsClient = new HCS10Client(agentId, privateKey, 'testnet')

    // Initialize services
    this.facilitator = new X402FacilitatorServer()
    this.arkhiaService = new ArkhiaAnalyticsService({
      network: (process.env.HEDERA_NETWORK || 'testnet') as 'testnet' | 'mainnet'
    })
    this.computationEngine = new TrustScoreComputationEngine()
    this.productRegistry = new ProductRegistry()

    // Initialize A2A protocol
    this.a2a = new A2AProtocol(this.hcsClient, agentId, ['trustscore', 'payment', 'negotiation'])
    this.a2aNegotiation = new A2ANegotiation(this.a2a)

    // Initialize Express app
    this.app = express()
    this.app.use(express.json())

    // Initialize route handler
    this.trustScoreRoute = new TrustScoreRoute(
      this.facilitator,
      this.arkhiaService,
      this.computationEngine,
      this.productRegistry
    )

    // Register route
    this.app.get('/trustscore/:accountId', async (req, res) => {
      await this.trustScoreRoute.getTrustScore(req, res)
    })

    // AP2 negotiation endpoint
    this.app.post('/ap2/negotiate', async (req, res) => {
      await this.handleNegotiationRequest(req, res)
    })

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ status: 'healthy', agentId: this.agentId })
    })
  }

  /**
   * Initialize agent and start API server
   */
  async init(): Promise<void> {
    try {
      console.log(chalk.blue(`🚀 Initializing TrustScoreProducerAgent: ${this.agentId}`))

      // Ensure default product is registered
      const defaultProduct = this.productRegistry.getProduct('trustscore.basic.v1')
      if (!defaultProduct) {
        this.productRegistry.registerProduct({
          productId: 'trustscore.basic.v1',
          version: 'v1',
          name: 'Basic Trust Score',
          description: 'Standard trust score computation for Hedera accounts',
          producerAgentId: this.agentId,
          endpoint: '/trustscore/:accountId',
          defaultPrice: process.env.TRUST_SCORE_PRICE || '0.3', // HBAR format
          currency: 'HBAR',
          network: 'hedera-testnet',
          rateLimit: {
            calls: 100,
            period: 3600 // 1 hour
          },
          sla: {
            uptime: '99.9%',
            responseTime: '< 2s'
          },
          createdAt: Date.now(),
          updatedAt: Date.now()
        })
        console.log(chalk.green('✅ Default product registered'))
      }

      // Start Express server
      const port = parseInt(process.env.PRODUCER_PORT || '3001')
      this.server = this.app.listen(port, () => {
        console.log(chalk.green(`✅ TrustScore API server listening on port ${port}`))
        console.log(chalk.blue(`   Endpoint: http://localhost:${port}/trustscore/:accountId`))
        console.log(chalk.blue(`   Health: http://localhost:${port}/health`))
      })

      // Log initialization event
      await this.logEvent('TRUST_COMPUTATION_REQUESTED', {
        producerAgentId: this.agentId,
        message: 'Producer agent initialized'
      })

      console.log(chalk.green(`✅ TrustScoreProducerAgent initialized successfully`))
    } catch (error) {
      console.error(chalk.red(`❌ Failed to initialize TrustScoreProducerAgent:`), error)
      throw error
    }
  }

  /**
   * Handle AP2 negotiation request
   */
  async handleNegotiationRequest(req: express.Request, res: express.Response): Promise<void> {
    try {
      const negotiationRequest: AP2NegotiationRequest = req.body

      console.log(chalk.blue(`💬 Received AP2 negotiation request for product: ${negotiationRequest.productId}`))

      // Validate request using AP2TrustScoreNegotiation
      const validation = AP2TrustScoreNegotiation.validateNegotiationRequest(negotiationRequest)
      if (!validation.valid) {
        res.status(400).json({
          error: {
            code: 'INVALID_NEGOTIATION_REQUEST',
            message: validation.error
          }
        })
        return
      }

      // Get product from registry
      const product = this.productRegistry.getProduct(negotiationRequest.productId)
      if (!product) {
        res.status(404).json({
          error: {
            code: 'PRODUCT_NOT_FOUND',
            message: `Product ${negotiationRequest.productId} not found`
          }
        })
        return
      }

      // Check if buyer's max price is acceptable
      const requestedPrice = parseFloat(negotiationRequest.maxPrice)
      const productPrice = parseFloat(product.defaultPrice)

      if (requestedPrice < productPrice) {
        res.status(400).json({
          error: {
            code: 'PRICE_TOO_LOW',
            message: `Requested price ${requestedPrice} is below minimum ${productPrice}`
          }
        })
        return
      }

      // Create offer using AP2TrustScoreNegotiation
      const offer = AP2TrustScoreNegotiation.createOffer(
        product.productId,
        this.agentId,
        product.defaultPrice,
        negotiationRequest.currency || product.currency,
        negotiationRequest.rateLimit || product.rateLimit,
        product.sla
      )

      // Log negotiation event
      await this.logEvent('TRUST_NEGOTIATION_STARTED', {
        buyerAgentId: negotiationRequest.metadata.buyerAgentId,
        producerAgentId: this.agentId,
        productId: product.productId,
        requestedPrice: negotiationRequest.maxPrice,
        offeredPrice: offer.price
      })

      res.json(offer)
      console.log(chalk.green(`✅ AP2 offer sent: ${JSON.stringify(offer)}`))
    } catch (error) {
      console.error(chalk.red(`❌ Negotiation error:`), error)
      res.status(500).json({
        error: {
          code: 'NEGOTIATION_ERROR',
          message: (error as Error).message
        }
      })
    }
  }

  /**
   * Get product registry entry
   */
  getProductInfo(): ProductRegistryEntry | null {
    return this.productRegistry.getProduct('trustscore.basic.v1')
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
    console.log(chalk.blue(`🔗 Producer agent registered with MeshOrchestrator`))
  }

  /**
   * Shutdown agent and server
   */
  async shutdown(): Promise<void> {
    if (this.server) {
      this.server.close()
      console.log(chalk.yellow(`🛑 TrustScore API server stopped`))
    }
  }
}

