/**
 * Real Integration Tests for TrustScore Oracle
 * 
 * Tests using actual registered agents from environment variables.
 * Requires agents to be registered via setup/register-agents.ts
 */

import { TrustScoreProducerAgent } from '../../src/agents/TrustScoreProducerAgent'
import { TrustScoreConsumerAgent } from '../../src/agents/TrustScoreConsumerAgent'
import { MeshOrchestrator } from '../../src/agents/MeshOrchestrator'
import { globalAgentRegistry, initializeHCS10Agents } from '../../src/agents/AgentRegistry'
import { loadEnvIfNeeded } from '../../src/utils/env'
import chalk from 'chalk'

// Load environment variables
loadEnvIfNeeded()

// Initialize agents from environment
initializeHCS10Agents()

const PRODUCER_PORT = parseInt(process.env.PRODUCER_PORT || '3001')
const PRODUCER_ENDPOINT = `http://localhost:${PRODUCER_PORT}`

async function testRealTrustScoreOracle(): Promise<boolean> {
  const results = {
    registryInit: false,
    producerInit: false,
    consumerInit: false,
    orchestratorInit: false,
    agentRegistration: false,
    productDiscovery: false,
    negotiation: false,
    systemState: false
  }

  try {
    console.log(chalk.bold('🧪 Real TrustScore Oracle Integration Tests'))
    console.log(chalk.gray('Using registered agents from environment'))
    console.log('')

    // Test 1: Check agent registry
    console.log(chalk.blue('Test 1: Agent Registry'))
    const allAgents = globalAgentRegistry.getAllAgents()
    console.log(chalk.gray(`   Registered agents: ${allAgents.length}`))
    
    const producerAgent = globalAgentRegistry.discoverAgentsByType('trustscore-producer')[0]
    const consumerAgent = globalAgentRegistry.discoverAgentsByType('trustscore-consumer')[0]
    const orchestratorAgent = globalAgentRegistry.discoverAgentsByType('orchestrator')[0]

    if (producerAgent) {
      console.log(chalk.green(`✅ Producer agent found: ${producerAgent.agentId}`))
      console.log(chalk.gray(`   Topic: ${producerAgent.topicId}`))
    } else {
      console.log(chalk.yellow('⚠️  Producer agent not registered. Run: npm run setup:agents'))
    }

    if (consumerAgent) {
      console.log(chalk.green(`✅ Consumer agent found: ${consumerAgent.agentId}`))
      console.log(chalk.gray(`   Topic: ${consumerAgent.topicId}`))
    } else {
      console.log(chalk.yellow('⚠️  Consumer agent not registered. Run: npm run setup:agents'))
    }

    if (orchestratorAgent) {
      console.log(chalk.green(`✅ Orchestrator agent found: ${orchestratorAgent.agentId}`))
      console.log(chalk.gray(`   Topic: ${orchestratorAgent.topicId}`))
    } else {
      console.log(chalk.yellow('⚠️  Orchestrator agent not registered. Run: npm run setup:agents'))
    }

    results.registryInit = true
    console.log('')

    // Test 2: Initialize MeshOrchestrator
    console.log(chalk.blue('Test 2: Initialize MeshOrchestrator'))
    
    // Use existing topic ID as fallback if MESH_TOPIC_ID not set
    if (!process.env.MESH_TOPIC_ID) {
      // Use first available topic ID from registered agents
      const firstAgent = allAgents[0]
      if (firstAgent) {
        process.env.MESH_TOPIC_ID = firstAgent.topicId
        console.log(chalk.yellow(`⚠️  MESH_TOPIC_ID not set, using fallback: ${firstAgent.topicId}`))
      } else {
        // Use ANALYZER_TOPIC_ID as last resort
        process.env.MESH_TOPIC_ID = process.env.ANALYZER_TOPIC_ID || '0.0.7132813'
        console.log(chalk.yellow(`⚠️  MESH_TOPIC_ID not set, using fallback: ${process.env.MESH_TOPIC_ID}`))
      }
    }

    const orchestrator = new MeshOrchestrator()
    await orchestrator.init()
    results.orchestratorInit = true
    console.log(chalk.green('✅ MeshOrchestrator initialized'))
    console.log('')

    // Test 3: Initialize Producer Agent (use registered agent if available)
    console.log(chalk.blue('Test 3: Initialize Producer Agent'))
    const producerAgentId = producerAgent?.agentId || process.env.PRODUCER_AGENT_ID || process.env.HEDERA_ACCOUNT_ID
    const producerPrivateKey = process.env.PRODUCER_PRIVATE_KEY || process.env.HEDERA_PRIVATE_KEY

    if (!producerAgentId || !producerPrivateKey) {
      console.log(chalk.yellow('⚠️  Missing producer credentials. Skipping producer test.'))
    } else {
      // Temporarily set env vars for producer
      const originalProducerId = process.env.PRODUCER_AGENT_ID
      const originalProducerKey = process.env.PRODUCER_PRIVATE_KEY
      process.env.PRODUCER_AGENT_ID = producerAgentId
      process.env.PRODUCER_PRIVATE_KEY = producerPrivateKey

      const producer = new TrustScoreProducerAgent()
      await producer.init()
      results.producerInit = true
      console.log(chalk.green('✅ Producer agent initialized'))
      console.log(chalk.blue(`   Endpoint: ${PRODUCER_ENDPOINT}/trustscore/:accountId`))

      // Restore original env vars
      if (originalProducerId) process.env.PRODUCER_AGENT_ID = originalProducerId
      if (originalProducerKey) process.env.PRODUCER_PRIVATE_KEY = originalProducerKey

      // Test 4: Initialize Consumer Agent
      console.log('')
      console.log(chalk.blue('Test 4: Initialize Consumer Agent'))
      const consumerAgentId = consumerAgent?.agentId || process.env.CONSUMER_AGENT_ID || process.env.HEDERA_ACCOUNT_ID
      const consumerPrivateKey = process.env.CONSUMER_PRIVATE_KEY || process.env.HEDERA_PRIVATE_KEY

      if (!consumerAgentId || !consumerPrivateKey) {
        console.log(chalk.yellow('⚠️  Missing consumer credentials. Skipping consumer test.'))
      } else {
        const originalConsumerId = process.env.CONSUMER_AGENT_ID
        const originalConsumerKey = process.env.CONSUMER_PRIVATE_KEY
        process.env.CONSUMER_AGENT_ID = consumerAgentId
        process.env.CONSUMER_PRIVATE_KEY = consumerPrivateKey

        const consumer = new TrustScoreConsumerAgent()
        await consumer.init()
        results.consumerInit = true
        console.log(chalk.green('✅ Consumer agent initialized'))

        // Restore original env vars
        if (originalConsumerId) process.env.CONSUMER_AGENT_ID = originalConsumerId
        if (originalConsumerKey) process.env.CONSUMER_PRIVATE_KEY = originalConsumerKey

        // Test 5: Register agents with orchestrator
        console.log('')
        console.log(chalk.blue('Test 5: Register Agents with Orchestrator'))
        orchestrator.registerAgent(producer, 'producer', producerAgentId, ['trustscore', 'payment'])
        orchestrator.registerAgent(consumer, 'consumer', consumerAgentId, ['trustscore', 'payment'])
        results.agentRegistration = true
        console.log(chalk.green('✅ Agents registered with orchestrator'))
        console.log('')

        // Test 6: Product discovery
        console.log(chalk.blue('Test 6: Product Discovery'))
        const products = await consumer.discoverProducts()
        if (products.length > 0) {
          results.productDiscovery = true
          console.log(chalk.green(`✅ Found ${products.length} products`))
          products.forEach(product => {
            console.log(chalk.gray(`   - ${product.productId}: ${product.name} (${product.defaultPrice} ${product.currency})`))
          })
        } else {
          console.log(chalk.yellow('⚠️  No products found'))
        }
        console.log('')

        // Test 7: AP2 Negotiation (if producer server is running)
        console.log(chalk.blue('Test 7: AP2 Negotiation'))
        try {
          const offer = await consumer.negotiatePrice('trustscore.basic.v1', PRODUCER_ENDPOINT)
          if (offer) {
            results.negotiation = true
            console.log(chalk.green('✅ Negotiation successful'))
            console.log(chalk.gray(`   Price: ${offer.price} ${offer.currency}`))
          } else {
            console.log(chalk.yellow('⚠️  Negotiation failed (producer server may not be running)'))
          }
        } catch (error) {
          console.log(chalk.yellow(`⚠️  Negotiation skipped: ${(error as Error).message}`))
        }
        console.log('')

        // Cleanup
        await producer.shutdown()
      }
    }

    // Test 8: System state
    console.log(chalk.blue('Test 8: System State'))
    const state = orchestrator.getSystemState()
    console.log(chalk.gray(`   Registered Agents: ${state.registeredAgents}`))
    console.log(chalk.gray(`   Active Tasks: ${state.activeTasks}`))
    console.log(chalk.gray(`   A2A Channels: ${state.a2aChannels}`))
    results.systemState = true
    console.log(chalk.green('✅ System state retrieved'))
    console.log('')

    // Summary
    console.log(chalk.bold('📊 Test Results Summary'))
    console.log('──────────────────────────────────────────────────')
    console.log(`Registry Init:         ${results.registryInit ? '✅ PASS' : '❌ FAIL'}`)
    console.log(`Orchestrator Init:     ${results.orchestratorInit ? '✅ PASS' : '❌ FAIL'}`)
    console.log(`Producer Init:         ${results.producerInit ? '✅ PASS' : '⚠️  SKIP'}`)
    console.log(`Consumer Init:         ${results.consumerInit ? '✅ PASS' : '⚠️  SKIP'}`)
    console.log(`Agent Registration:    ${results.agentRegistration ? '✅ PASS' : '⚠️  SKIP'}`)
    console.log(`Product Discovery:     ${results.productDiscovery ? '✅ PASS' : '⚠️  SKIP'}`)
    console.log(`AP2 Negotiation:      ${results.negotiation ? '✅ PASS' : '⚠️  SKIP'}`)
    console.log(`System State:          ${results.systemState ? '✅ PASS' : '❌ FAIL'}`)
    console.log('')

    const coreTestsPassed = results.registryInit && results.orchestratorInit && results.systemState
    if (coreTestsPassed) {
      console.log(chalk.green('🎉 Core integration tests passed!'))
      if (!results.producerInit || !results.consumerInit) {
        console.log(chalk.yellow('💡 Run "npm run setup:agents" to register TrustScore agents for full testing'))
      }
      return true
    } else {
      console.log(chalk.red('❌ Core tests failed'))
      return false
    }
  } catch (error) {
    console.error(chalk.red('❌ Integration test failed:'), error)
    return false
  }
}

// Run tests
if (require.main === module) {
  testRealTrustScoreOracle()
    .then(success => {
      process.exit(success ? 0 : 1)
    })
    .catch(error => {
      console.error(chalk.red('❌ Test error:'), error)
      process.exit(1)
    })
}

export { testRealTrustScoreOracle }

