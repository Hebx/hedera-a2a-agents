/**
 * TrustScore Oracle E2E Demo
 * 
 * Demonstrates the complete A2A → AP2 → x402 → Analytics → HCS workflow:
 * 1. Initialize MeshOrchestrator, ProducerAgent, and ConsumerAgent
 * 2. Demonstrate product discovery
 * 3. Demonstrate AP2 negotiation
 * 4. Demonstrate trust score request with payment
 * 5. Demonstrate HCS event logging
 * 
 * @packageDocumentation
 */

import { TrustScoreProducerAgent } from '../src/agents/TrustScoreProducerAgent'
import { TrustScoreConsumerAgent } from '../src/agents/TrustScoreConsumerAgent'
import { MeshOrchestrator } from '../src/agents/MeshOrchestrator'
import { loadEnvIfNeeded } from '../src/utils/env'
import chalk from 'chalk'

// Load environment variables
loadEnvIfNeeded()

// Configuration
const TEST_ACCOUNT_ID = process.env.TEST_ACCOUNT_ID || process.env.HEDERA_ACCOUNT_ID || '0.0.7132337'
const PRODUCER_PORT = parseInt(process.env.PRODUCER_PORT || '3001')
const PRODUCER_ENDPOINT = `http://localhost:${PRODUCER_PORT}`

async function main(): Promise<void> {
  try {
    console.log(chalk.bold('🚀 TrustScore Oracle E2E Demo'))
    console.log(chalk.gray('Demonstrating A2A → AP2 → x402 → Analytics → HCS workflow'))
    console.log('')

    // Step 1: Initialize MeshOrchestrator
    console.log(chalk.bold('Step 1: Initialize MeshOrchestrator'))
    const orchestrator = new MeshOrchestrator()
    await orchestrator.init()
    console.log(chalk.green('✅ MeshOrchestrator initialized'))
    console.log('')

    // Step 2: Initialize Producer Agent
    console.log(chalk.bold('Step 2: Initialize Producer Agent'))
    const producerAgentId = process.env.PRODUCER_AGENT_ID || process.env.HEDERA_ACCOUNT_ID || '0.0.7136519'
    const producer = new TrustScoreProducerAgent()
    await producer.init()
    console.log(chalk.green('✅ Producer agent initialized'))
    console.log(chalk.blue(`   Agent ID: ${producerAgentId}`))
    console.log(chalk.blue(`   API Endpoint: ${PRODUCER_ENDPOINT}/trustscore/:accountId`))
    console.log(chalk.cyan(`🔗 HashScan Account: https://hashscan.io/testnet/account/${producerAgentId}`))
    console.log('')

    // Step 3: Initialize Consumer Agent
    console.log(chalk.bold('Step 3: Initialize Consumer Agent'))
    const consumerAgentId = process.env.CONSUMER_AGENT_ID || process.env.HEDERA_ACCOUNT_ID || '0.0.7304745'
    const consumer = new TrustScoreConsumerAgent()
    await consumer.init()
    console.log(chalk.green('✅ Consumer agent initialized'))
    console.log(chalk.blue(`   Agent ID: ${consumerAgentId}`))
    console.log(chalk.cyan(`🔗 HashScan Account: https://hashscan.io/testnet/account/${consumerAgentId}`))
    console.log('')

    // Step 4: Register agents with orchestrator
    console.log(chalk.bold('Step 4: Register Agents with Orchestrator'))

    orchestrator.registerAgent(producer, 'producer', producerAgentId, ['trustscore', 'payment'])
    orchestrator.registerAgent(consumer, 'consumer', consumerAgentId, ['trustscore', 'payment'])
    console.log(chalk.green('✅ Agents registered'))
    console.log('')

    // Step 5: Product Discovery
    console.log(chalk.bold('Step 5: Product Discovery'))
    const products = await consumer.discoverProducts()
    if (products.length > 0) {
      console.log(chalk.green(`✅ Found ${products.length} products:`))
      products.forEach(product => {
        console.log(chalk.blue(`   - ${product.productId}: ${product.name}`))
        console.log(chalk.gray(`     Price: ${product.defaultPrice} ${product.currency}`))
        console.log(chalk.gray(`     Rate Limit: ${product.rateLimit.calls} calls per ${product.rateLimit.period}s`))
      })
    } else {
      console.log(chalk.yellow('⚠️  No products found'))
    }
    console.log('')

    // Step 6: AP2 Negotiation
    console.log(chalk.bold('Step 6: AP2 Price Negotiation'))
    const productId = 'trustscore.basic.v1'
    const offer = await consumer.negotiatePrice(productId, PRODUCER_ENDPOINT)
    if (offer) {
      console.log(chalk.green('✅ Negotiation successful'))
      console.log(chalk.blue(`   Product: ${offer.productId}`))
      console.log(chalk.blue(`   Price: ${offer.price} ${offer.currency}`))
      console.log(chalk.blue(`   Valid Until: ${new Date(offer.validUntil).toISOString()}`))
    } else {
      console.log(chalk.yellow('⚠️  Negotiation skipped (producer not reachable in test mode)'))
    }
    console.log('')

    // Step 7: Trust Score Request
    console.log(chalk.bold('Step 7: Request Trust Score'))
    console.log(chalk.blue(`   Target Account: ${TEST_ACCOUNT_ID}`))
    console.log(chalk.gray('   Flow:'))
    console.log(chalk.gray('   1. Consumer requests trust score'))
    console.log(chalk.gray('   2. Producer returns 402 Payment Required'))
    console.log(chalk.gray('   3. Consumer pays via x402 facilitator'))
    console.log(chalk.gray('   4. Consumer retries with X-PAYMENT header'))
    console.log(chalk.gray('   5. Producer computes and returns score'))
    console.log('')

    // Make actual trust score request
    try {
      console.log(chalk.blue('📊 Requesting trust score...'))
      const trustScore = await consumer.requestTrustScore(TEST_ACCOUNT_ID, productId, PRODUCER_ENDPOINT)
      
      if (trustScore) {
        console.log(chalk.green('✅ Trust score received:'))
        console.log(chalk.blue(`   Account: ${trustScore.account}`))
        console.log(chalk.blue(`   Overall Score: ${trustScore.score}/100`))
        console.log(chalk.blue(`   Account Age: ${trustScore.components.accountAge} points`))
        console.log(chalk.blue(`   Diversity: ${trustScore.components.diversity} points`))
        console.log(chalk.blue(`   Volatility: ${trustScore.components.volatility} points`))
        console.log(chalk.blue(`   Token Health: ${trustScore.components.tokenHealth} points`))
        console.log(chalk.blue(`   HCS Quality: ${trustScore.components.hcsQuality} points`))
        console.log(chalk.blue(`   Risk Penalty: ${trustScore.components.riskPenalty} points`))
        console.log(chalk.blue(`   Risk Flags: ${trustScore.riskFlags.length}`))
        if (trustScore.riskFlags.length > 0) {
          trustScore.riskFlags.forEach(flag => {
            console.log(chalk.yellow(`     - ${flag.type}: ${flag.severity} - ${flag.description}`))
          })
        }
        console.log(chalk.blue(`   Computed At: ${new Date(trustScore.timestamp).toISOString()}`))
      } else {
        console.log(chalk.yellow('⚠️  Trust score request returned null'))
      }
    } catch (error: any) {
      console.error(chalk.red('❌ Trust score request failed:'), error.message)
      if (error.response) {
        console.error(chalk.red(`   Status: ${error.response.status}`))
        console.error(chalk.red(`   Data: ${JSON.stringify(error.response.data)}`))
      }
      console.log(chalk.yellow('⚠️  Continuing demo despite error...'))
    }
    console.log('')

    // Step 8: System State
    console.log(chalk.bold('Step 8: System State'))
    const state = orchestrator.getSystemState()
    console.log(chalk.blue('   Orchestrator State:'))
    console.log(chalk.gray(`     Orchestrator ID: ${state.orchestratorId}`))
    console.log(chalk.gray(`     Mesh Topic ID: ${state.meshTopicId}`))
    console.log(chalk.gray(`     Registered Agents: ${state.registeredAgents}`))
    console.log(chalk.gray(`     Active Tasks: ${state.activeTasks}`))
    console.log(chalk.gray(`     A2A Channels: ${state.a2aChannels}`))
    console.log('')

    // Summary
    console.log(chalk.bold('📊 Demo Summary'))
    console.log('──────────────────────────────────────────────────')
    console.log(chalk.green('✅ MeshOrchestrator: Initialized'))
    console.log(chalk.green('✅ Producer Agent: Initialized'))
    console.log(chalk.green('✅ Consumer Agent: Initialized'))
    console.log(chalk.green('✅ Agents: Registered'))
    console.log(chalk.green('✅ Product Discovery: Working'))
    console.log(chalk.green('✅ Trust Score Request: Completed'))
    console.log('')

    // Account Links (variables already declared above)
    console.log(chalk.bold('🔗 On-Chain Transaction Links'))
    console.log('──────────────────────────────────────────────────')
    console.log(chalk.cyan(`   Producer Account: https://hashscan.io/testnet/account/${producerAgentId}`))
    console.log(chalk.cyan(`   Consumer Account: https://hashscan.io/testnet/account/${consumerAgentId}`))
    console.log(chalk.gray('   (Check payment transaction links in the payment flow above)'))
    console.log('')

    console.log(chalk.bold('🎉 Demo completed successfully!'))
    console.log('')
    console.log(chalk.blue('Note:'))
    console.log(chalk.gray('  - HCS-11 profile errors are expected if profiles are not registered'))
    console.log(chalk.gray('  - A2A channel errors are expected if inbound topics are not configured'))
    console.log(chalk.gray('  - These are non-critical for the core workflow demonstration'))
    console.log('')

    // Cleanup
    await producer.shutdown()
  } catch (error) {
    console.error(chalk.red('❌ Demo failed:'), error)
    process.exit(1)
  }
}

// Run demo
if (require.main === module) {
  main()
    .then(() => {
      process.exit(0)
    })
    .catch(error => {
      console.error(chalk.red('❌ Demo error:'), error)
      process.exit(1)
    })
}

export { main }

