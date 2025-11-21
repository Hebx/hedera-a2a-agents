/**
 * Trust Score Oracle Resource Server
 * 
 * Express server implementing x402 payment-gated trust score API.
 * Based on x402-hedera Express server pattern.
 * 
 * @packageDocumentation
 */

import express, { Express } from 'express'
import { X402FacilitatorServer } from '../facilitator/X402FacilitatorServer'
import { ArkhiaAnalyticsService } from '../services/analytics/ArkhiaAnalyticsService'
import { TrustScoreComputationEngine } from '../services/analytics/TrustScoreComputationEngine'
import { ProductRegistry } from '../marketplace/ProductRegistry'
import { TrustScoreRoute } from './routes/trustScoreRoute'
import { loadEnvIfNeeded } from '../utils/env'
import chalk from 'chalk'

// Load environment variables
loadEnvIfNeeded()

/**
 * Trust Score Resource Server
 */
export class TrustScoreResourceServer {
  private app: Express
  private port: number
  private facilitator: X402FacilitatorServer
  private arkhiaService: ArkhiaAnalyticsService
  private computationEngine: TrustScoreComputationEngine
  private productRegistry: ProductRegistry
  private trustScoreRoute: TrustScoreRoute

  constructor() {
    this.app = express()
    this.port = parseInt(process.env.TRUST_SCORE_SERVER_PORT || '4021')

    // Initialize services
    this.facilitator = new X402FacilitatorServer()
    this.arkhiaService = new ArkhiaAnalyticsService({}) // Uses ARKHIA_API_KEY from env
    this.computationEngine = new TrustScoreComputationEngine()
    this.productRegistry = new ProductRegistry()

    // Initialize route handler
    this.trustScoreRoute = new TrustScoreRoute(
      this.facilitator,
      this.arkhiaService,
      this.computationEngine,
      this.productRegistry
    )

    this.setupMiddleware()
    this.setupRoutes()
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // JSON body parser
    this.app.use(express.json())

    // Request logging
    this.app.use((req, res, next) => {
      console.log(chalk.gray(`${req.method} ${req.path}`))
      next()
    })
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Health check endpoint (free)
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        service: 'TrustScore Oracle',
        timestamp: Date.now()
      })
    })

    // Product registry endpoint (free)
    this.app.get('/products', (req, res) => {
      const products = this.productRegistry.getAllProducts()
      res.json({
        products,
        count: products.length
      })
    })

    // Trust score endpoint (payment-gated)
    this.app.get('/trustscore/:accountId', async (req, res) => {
      await this.trustScoreRoute.getTrustScore(req, res)
    })
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(this.port, () => {
        console.log(chalk.green(`✅ Trust Score Resource Server listening on http://localhost:${this.port}`))
        console.log(chalk.blue(`📊 Endpoints:`))
        console.log(chalk.gray(`   GET /health - Health check (free)`))
        console.log(chalk.gray(`   GET /products - Product registry (free)`))
        console.log(chalk.gray(`   GET /trustscore/:accountId - Trust score (payment-gated)`))
        resolve()
      })
    })
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    // Graceful shutdown would be implemented here
    console.log(chalk.yellow('🛑 Stopping Trust Score Resource Server...'))
  }
}

// Export for use in other modules
export default TrustScoreResourceServer

