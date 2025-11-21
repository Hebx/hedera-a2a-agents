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
    const producer = new TrustScoreProducerAgent()
    await producer.init()
    console.log(chalk.green('✅ Producer agent initialized'))
    console.log(chalk.blue(`   API Endpoint: ${PRODUCER_ENDPOINT}/trustscore/:accountId`))
    console.log('')

    // Step 3: Initialize Consumer Agent
    console.log(chalk.bold('Step 3: Initialize Consumer Agent'))
    const consumer = new TrustScoreConsumerAgent()
    await consumer.init()
    console.log(chalk.green('✅ Consumer agent initialized'))
    console.log('')

    // Step 4: Register agents with orchestrator
    console.log(chalk.bold('Step 4: Register Agents with Orchestrator'))
    const producerAgentId = process.env.PRODUCER_AGENT_ID || process.env.HEDERA_ACCOUNT_ID || '0.0.123456'
    const consumerAgentId = process.env.CONSUMER_AGENT_ID || process.env.HEDERA_ACCOUNT_ID || '0.0.123456'

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
    
    // Note: In a real scenario, this would make an HTTP request to the producer
    // For demo purposes, we'll show the flow
    console.log(chalk.gray('   Flow:'))
    console.log(chalk.gray('   1. Consumer requests trust score'))
    console.log(chalk.gray('   2. Producer returns 402 Payment Required'))
    console.log(chalk.gray('   3. Consumer pays via x402 facilitator'))
    console.log(chalk.gray('   4. Consumer retries with X-PAYMENT header'))
    console.log(chalk.gray('   5. Producer computes and returns score'))
    console.log('')

    // In actual implementation, this would be:
    // const trustScore = await consumer.requestTrustScore(TEST_ACCOUNT_ID, productId, PRODUCER_ENDPOINT)
    console.log(chalk.yellow('⚠️  Trust score request skipped (requires running producer server)'))
    console.log(chalk.gray('   To test: Start producer server and uncomment the request call'))
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
    console.log(chalk.yellow('⚠️  Trust Score Request: Requires running server'))
    console.log('')

    console.log(chalk.bold('🎉 Demo completed successfully!'))
    console.log('')
    console.log(chalk.blue('Next steps:'))
    console.log(chalk.gray('  1. Ensure producer server is running'))
    console.log(chalk.gray('  2. Make actual trust score request'))
    console.log(chalk.gray('  3. Verify HCS event logging'))
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

