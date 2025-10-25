import { HCS10Client } from '@hashgraphonline/standards-agent-kit'
import { processPayment, x402Utils } from 'a2a-x402'
import { Wallet, JsonRpcProvider } from 'ethers'
import chalk from 'chalk'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

export class SettlementAgent {
  private hcsClient: HCS10Client
  private provider: JsonRpcProvider
  private wallet: Wallet
  private x402Utils: typeof x402Utils

  constructor() {
    // Get agent credentials from environment variables
    const agentId = process.env.SETTLEMENT_AGENT_ID
    const privateKey = process.env.SETTLEMENT_PRIVATE_KEY
    const baseRpcUrl = process.env.BASE_RPC_URL
    const walletPrivateKey = process.env.SETTLEMENT_WALLET_PRIVATE_KEY

    if (!agentId || !privateKey || !baseRpcUrl || !walletPrivateKey) {
      throw new Error('Missing required environment variables: SETTLEMENT_AGENT_ID, SETTLEMENT_PRIVATE_KEY, BASE_RPC_URL, and SETTLEMENT_WALLET_PRIVATE_KEY')
    }

    // Check if we have a placeholder private key
    if (privateKey.startsWith('placeholder-key-for-')) {
      console.warn('⚠️  Using placeholder private key. Agent registration may not have captured the actual private key.')
      console.warn('⚠️  For now, we\'ll use the main Hedera account for testing.')
      
      // Use the main Hedera account credentials for testing
      const mainAccountId = process.env.HEDERA_ACCOUNT_ID
      const mainPrivateKey = process.env.HEDERA_PRIVATE_KEY
      
      if (!mainAccountId || !mainPrivateKey) {
        throw new Error('Missing main Hedera credentials for fallback')
      }
      
      // Initialize HCS10Client with main account for now
      this.hcsClient = new HCS10Client(mainAccountId, mainPrivateKey, 'testnet')
    } else {
      // Initialize HCS10Client with actual agent credentials
      this.hcsClient = new HCS10Client(agentId, privateKey, 'testnet')
    }

    // Initialize provider with BASE_RPC_URL
    this.provider = new JsonRpcProvider(baseRpcUrl)

    // Initialize wallet with SETTLEMENT_WALLET_PRIVATE_KEY + provider
    this.wallet = new Wallet(walletPrivateKey, this.provider)

    // Initialize x402Utils
    this.x402Utils = x402Utils
  }

  async init(): Promise<void> {
    try {
      // Get topic ID from environment
      const topicId = process.env.SETTLEMENT_TOPIC_ID
      if (!topicId) {
        throw new Error('Missing required environment variable: SETTLEMENT_TOPIC_ID')
      }

      // Connect hcsClient
      await this.hcsClient.connect()

      // Subscribe to SETTLEMENT_TOPIC_ID
      await this.hcsClient.subscribe(topicId, this.handleMessage.bind(this))

      console.log(chalk.yellow('Listening for approvals...'))
      console.log(`🔗 SettlementAgent initialized for Hedera testnet`)
      console.log(`🆔 Agent ID: ${process.env.SETTLEMENT_AGENT_ID}`)
      console.log(`📡 Topic ID: ${topicId}`)
      console.log(`🌐 RPC URL: ${process.env.BASE_RPC_URL}`)
    } catch (error) {
      console.error('❌ Failed to initialize SettlementAgent:', error)
      throw error
    }
  }

  private async handleMessage(message: any): Promise<void> {
    try {
      // Parse message.contents
      const parsed = JSON.parse(message.contents || message.data || '{}')

      // If type === 'verification_result' && approved
      if (parsed.type === 'verification_result' && parsed.approved) {
        console.log(chalk.yellow('Settlement approved'))
        await this.executeSettlement(parsed)
      }
    } catch (error) {
      console.error('❌ Error handling message:', error)
    }
  }

  private async executeSettlement(verification: any): Promise<void> {
    try {
      console.log(chalk.yellow('Initiating x402 payment...'))

      // Create payment requirements (use a2a-x402 format)
      const requirements = {
        scheme: 'exact',
        network: 'base-sepolia',
        asset: process.env.USDC_CONTRACT,
        payTo: process.env.MERCHANT_WALLET_ADDRESS,
        maxAmountRequired: '10000000', // 10 USDC in atomic units
        resource: '/agent-settlement',
        description: 'A2A agent settlement',
        mimeType: 'application/json',
        maxTimeoutSeconds: 120
      }

      // Call processPayment
      const paymentPayload = await processPayment(requirements, this.wallet)

      // Extract tx hash from paymentPayload
      const txHash = paymentPayload.transactionHash || paymentPayload.txHash

      console.log(chalk.green('✓ Payment complete'), txHash)

      // Call recordSettlement
      await this.recordSettlement(txHash, 10)
    } catch (error) {
      console.error('❌ Error executing settlement:', error)
    }
  }

  private async recordSettlement(txHash: string, amount: number): Promise<void> {
    try {
      // Create settlement object
      const settlement = {
        type: 'settlement_complete',
        txHash,
        amount: `${amount} USDC`,
        timestamp: Date.now()
      }

      // Send via hcsClient.sendMessage to ANALYZER_TOPIC_ID (broadcast)
      const analyzerTopicId = process.env.ANALYZER_TOPIC_ID
      if (!analyzerTopicId) {
        throw new Error('Missing required environment variable: ANALYZER_TOPIC_ID')
      }

      await this.hcsClient.sendMessage(analyzerTopicId, JSON.stringify(settlement))
      console.log(chalk.yellow('→ Recording settlement on HCS'))
    } catch (error) {
      console.error('❌ Error recording settlement:', error)
    }
  }
}
