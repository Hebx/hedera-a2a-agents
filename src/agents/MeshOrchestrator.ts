/**
 * Mesh Orchestrator
 * 
 * Manages agent registration, A2A communication channels, HCS logging,
 * task issuance, and system state for the TrustScore Oracle.
 * 
 * @packageDocumentation
 */

import { HCS10Client } from '@hashgraphonline/standards-agent-kit'
import { A2AProtocol } from '../protocols/A2AProtocol'
import { HCS10ConnectionManager, Connection } from '../protocols/HCS10ConnectionManager'
import { TrustScoreEvent, TrustScoreEventType } from '../marketplace/types'
import { TrustScoreProducerAgent } from './TrustScoreProducerAgent'
import { TrustScoreConsumerAgent } from './TrustScoreConsumerAgent'
import { loadEnvIfNeeded } from '../utils/env'
import chalk from 'chalk'
import axios from 'axios'

// Load environment variables
loadEnvIfNeeded()

/**
 * Agent Registration Entry
 */
interface AgentRegistration {
  agentId: string
  agentType: 'producer' | 'consumer'
  agent: TrustScoreProducerAgent | TrustScoreConsumerAgent
  registeredAt: number
  capabilities: string[]
}

/**
 * Task Entry
 */
interface Task {
  taskId: string
  type: 'trust_score_request'
  consumerAgentId: string
  accountId: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  createdAt: number
  completedAt?: number
  result?: any
  error?: string
}

/**
 * Mesh Orchestrator
 * 
 * Responsibilities:
 * - Register and track ConsumerAgent and ProducerAgent instances
 * - Issue tasks for ConsumerAgent
 * - Log events to HCS topic
 * - Verify on-chain payment transactions
 * - Maintain A2A communication channels
 * - Track system state
 */
export class MeshOrchestrator {
  private hcsClient: HCS10Client
  private orchestratorId: string
  private meshTopicId: string
  private a2a: A2AProtocol
  private connectionManager: HCS10ConnectionManager
  private agents: Map<string, AgentRegistration> = new Map()
  private tasks: Map<string, Task> = new Map()
  private a2aChannels: Map<string, Connection> = new Map()

  constructor() {
    // Get orchestrator credentials
    const orchestratorId = process.env.ORCHESTRATOR_AGENT_ID || process.env.HEDERA_ACCOUNT_ID
    const privateKey = process.env.ORCHESTRATOR_PRIVATE_KEY || process.env.HEDERA_PRIVATE_KEY
    const meshTopicId = process.env.MESH_TOPIC_ID

    if (!orchestratorId || !privateKey) {
      throw new Error('Missing required environment variables: ORCHESTRATOR_AGENT_ID/ORCHESTRATOR_PRIVATE_KEY or HEDERA_ACCOUNT_ID/HEDERA_PRIVATE_KEY')
    }

    if (!meshTopicId) {
      throw new Error('Missing required environment variable: MESH_TOPIC_ID')
    }

    this.orchestratorId = orchestratorId
    this.meshTopicId = meshTopicId

    // Initialize HCS client
    this.hcsClient = new HCS10Client(orchestratorId, privateKey, 'testnet')

    // Initialize A2A protocol
    this.a2a = new A2AProtocol(this.hcsClient, orchestratorId, ['orchestration', 'tasking', 'logging'])

    // Initialize connection manager
    this.connectionManager = new HCS10ConnectionManager(this.hcsClient, orchestratorId)
  }

  /**
   * Initialize orchestrator
   */
  async init(): Promise<void> {
    try {
      console.log(chalk.blue(`🚀 Initializing MeshOrchestrator: ${this.orchestratorId}`))
      console.log(chalk.blue(`📡 Mesh Topic ID: ${this.meshTopicId}`))

      // Establish HCS-10 connection
      await this.establishHCSConnection()

      console.log(chalk.green(`✅ MeshOrchestrator initialized successfully`))
    } catch (error) {
      console.error(chalk.red(`❌ Failed to initialize MeshOrchestrator:`), error)
      throw error
    }
  }

  /**
   * Register an agent with the orchestrator
   */
  registerAgent(
    agent: TrustScoreProducerAgent | TrustScoreConsumerAgent,
    agentType: 'producer' | 'consumer',
    agentId: string,
    capabilities: string[] = []
  ): void {
    const registration: AgentRegistration = {
      agentId,
      agentType,
      agent,
      registeredAt: Date.now(),
      capabilities: capabilities.length > 0 ? capabilities : ['trustscore']
    }

    this.agents.set(agentId, registration)

    // Register agent with orchestrator
    if (agentType === 'producer') {
      (agent as TrustScoreProducerAgent).registerOrchestrator(this)
    } else {
      (agent as TrustScoreConsumerAgent).registerOrchestrator(this)
    }

    // Establish A2A channel (async, don't await to avoid blocking)
    this.establishA2AChannel(agentId).catch(err => {
      console.error(chalk.yellow(`⚠️  A2A channel establishment deferred for ${agentId}`))
    })

    console.log(chalk.green(`✅ Agent registered: ${agentId} (${agentType})`))
  }

  /**
   * Issue a trust score task to a consumer agent
   */
  async issueTrustScoreTask(
    consumerAgentId: string,
    accountId: string,
    producerEndpoint: string
  ): Promise<string> {
    const taskId = `task-${Date.now()}-${Math.random().toString(36).substring(7)}`

    const task: Task = {
      taskId,
      type: 'trust_score_request',
      consumerAgentId,
      accountId,
      status: 'pending',
      createdAt: Date.now()
    }

    this.tasks.set(taskId, task)

    // Log task creation
    await this.logEvent({
      type: 'TRUST_COMPUTATION_REQUESTED',
      eventId: `event-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      timestamp: Date.now(),
      data: {
        taskId,
        consumerAgentId,
        accountId,
        producerEndpoint
      }
    })

    console.log(chalk.blue(`📋 Task issued: ${taskId} for account ${accountId}`))

    return taskId
  }

  /**
   * Log event to HCS topic
   */
  async logEvent(event: TrustScoreEvent): Promise<void> {
    try {
      const eventMessage = JSON.stringify({
        type: event.type,
        eventId: event.eventId,
        timestamp: event.timestamp,
        data: event.data,
        orchestratorId: this.orchestratorId
      })

      // Publish to HCS topic
      await this.hcsClient.sendMessage(this.meshTopicId, eventMessage)

      console.log(chalk.gray(`📝 Event logged to HCS: ${event.type} (${event.eventId})`))
    } catch (error) {
      console.error(chalk.red(`❌ Failed to log event to HCS:`), error)
      // Don't throw - logging failures shouldn't break the system
    }
  }

  /**
   * Verify on-chain payment transaction
   */
  async verifyPaymentReceipt(
    transactionIdOrHash: string,
    expectedAmount: string,
    expectedRecipient: string
  ): Promise<boolean> {
    try {
      console.log(chalk.blue(`🔍 Verifying payment receipt: ${transactionIdOrHash}`))

      if (!transactionIdOrHash || transactionIdOrHash.length < 5) {
        return false
      }

      // Use Hedera Mirror Node to verify transaction
      // Try testnet mirror node first
      const mirrorNodeUrl = 'https://testnet.mirrornode.hedera.com'
      
      try {
        // The input could be a Transaction ID (0.0.x@s.n) or a Hash
        // Mirror node accepts both in /api/v1/transactions/{idOrHash}
        const response = await axios.get(`${mirrorNodeUrl}/api/v1/transactions/${transactionIdOrHash}`)
        
        const transaction = response.data.transactions?.[0]
        
        if (!transaction) {
          console.warn(chalk.yellow(`⚠️ Transaction not found on mirror node: ${transactionIdOrHash}`))
          return false
        }

        // 1. Verify status
        if (transaction.result !== 'SUCCESS') {
          console.warn(chalk.yellow(`⚠️ Transaction status is not SUCCESS: ${transaction.result}`))
          return false
        }

        // 2. Verify recipient and amount
        // Transfers are in transaction.transfers array
        const transfers = transaction.transfers || []
        
        // Find transfer to expected recipient
        // expectedAmount is in tinybars (or smallest unit)
        // transfers array items have: account, amount
        
        const recipientTransfer = transfers.find((t: any) => t.account === expectedRecipient && t.amount > 0)
        
        if (!recipientTransfer) {
          console.warn(chalk.yellow(`⚠️ No transfer found to recipient ${expectedRecipient}`))
          return false
        }

        // Check amount (allow for small float differences if string parsing)
        // But HBAR amounts are integers (tinybars)
        if (recipientTransfer.amount.toString() !== expectedAmount) {
          console.warn(chalk.yellow(`⚠️ Amount mismatch. Expected: ${expectedAmount}, Found: ${recipientTransfer.amount}`))
          return false
        }

        console.log(chalk.green(`✅ Payment receipt verified on-chain: ${transactionIdOrHash}`))
        return true
        
      } catch (error: any) {
        if (error.response?.status === 404) {
          console.warn(chalk.yellow(`⚠️ Transaction not found: ${transactionIdOrHash}`))
          return false
        }
        throw error
      }
    } catch (error) {
      console.error(chalk.red(`❌ Payment verification failed:`), error)
      return false
    }
  }

  /**
   * Establish A2A communication channel with an agent
   */
  private async establishA2AChannel(agentId: string): Promise<void> {
    try {
      // Request A2A connection via connection manager
      const connection = await this.connectionManager.requestConnection(agentId)
      this.a2aChannels.set(agentId, connection)

      console.log(chalk.blue(`🔗 A2A channel established with agent: ${agentId}`))
    } catch (error) {
      console.error(chalk.red(`❌ Failed to establish A2A channel:`), error)
      // Don't throw - channel establishment failure shouldn't break registration
    }
  }

  /**
   * Establish HCS-10 connection
   */
  private async establishHCSConnection(): Promise<void> {
    try {
      // Test connection by publishing a heartbeat message
      const heartbeat = JSON.stringify({
        type: 'ORCHESTRATOR_HEARTBEAT',
        orchestratorId: this.orchestratorId,
        timestamp: Date.now()
      })

      await this.hcsClient.sendMessage(this.meshTopicId, heartbeat)

      console.log(chalk.green(`✅ HCS-10 connection established`))
    } catch (error) {
      // HCS-10 connection may fail if HCS-11 profile is not registered
      // This is acceptable for testing - we'll log but not fail
      console.warn(chalk.yellow(`⚠️  HCS-10 connection warning: ${(error as Error).message}`))
      console.warn(chalk.yellow(`   HCS-11 profile may not be registered. Continuing without HCS logging.`))
      // Don't throw - allow orchestrator to function without HCS logging
    }
  }

  /**
   * Get current system state
   */
  getSystemState(): {
    orchestratorId: string
    meshTopicId: string
    registeredAgents: number
    activeTasks: number
    a2aChannels: number
    agents: Array<{ agentId: string; agentType: string; registeredAt: number }>
    tasks: Array<{ taskId: string; type: string; status: string }>
  } {
    return {
      orchestratorId: this.orchestratorId,
      meshTopicId: this.meshTopicId,
      registeredAgents: this.agents.size,
      activeTasks: Array.from(this.tasks.values()).filter(t => t.status === 'pending' || t.status === 'in_progress').length,
      a2aChannels: this.a2aChannels.size,
      agents: Array.from(this.agents.values()).map(a => ({
        agentId: a.agentId,
        agentType: a.agentType,
        registeredAt: a.registeredAt
      })),
      tasks: Array.from(this.tasks.values()).map(t => ({
        taskId: t.taskId,
        type: t.type,
        status: t.status
      }))
    }
  }

  /**
   * Update task status
   */
  updateTaskStatus(taskId: string, status: Task['status'], result?: any, error?: string): void {
    const task = this.tasks.get(taskId)
    if (task) {
      task.status = status
      if (result) {
        task.result = result
      }
      if (error) {
        task.error = error
      }
      if (status === 'completed' || status === 'failed') {
        task.completedAt = Date.now()
      }
      this.tasks.set(taskId, task)
    }
  }
}

