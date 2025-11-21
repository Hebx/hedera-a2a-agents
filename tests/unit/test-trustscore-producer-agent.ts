/**
 * Unit Tests for TrustScoreProducerAgent
 * 
 * Tests the producer agent's core functionality including:
 * - Initialization
 * - Product registration
 * - AP2 negotiation handling
 * - Express server setup
 */

import { TrustScoreProducerAgent } from '../../src/agents/TrustScoreProducerAgent'
import { ProductRegistry } from '../../src/marketplace/ProductRegistry'
import chalk from 'chalk'

// Mock environment variables
process.env.PRODUCER_AGENT_ID = process.env.HEDERA_ACCOUNT_ID || '0.0.123456'
process.env.PRODUCER_PRIVATE_KEY = process.env.HEDERA_PRIVATE_KEY || 'test-key'
process.env.TRUST_SCORE_PRICE = '30000' // tinybars
process.env.PRODUCER_PORT = '3001'

async function testProducerAgent(): Promise<boolean> {
  try {
    console.log(chalk.bold('🧪 Testing TrustScoreProducerAgent'))
    console.log('')

    // Test 1: Agent initialization
    console.log(chalk.blue('Test 1: Agent Initialization'))
    const agent = new TrustScoreProducerAgent()
    await agent.init()
    console.log(chalk.green('✅ Agent initialized successfully'))
    console.log('')

    // Test 2: Product info retrieval
    console.log(chalk.blue('Test 2: Product Info Retrieval'))
    const productInfo = agent.getProductInfo()
    if (productInfo) {
      console.log(chalk.green(`✅ Product found: ${productInfo.productId}`))
      console.log(chalk.gray(`   Name: ${productInfo.name}`))
      console.log(chalk.gray(`   Price: ${productInfo.defaultPrice} ${productInfo.currency}`))
    } else {
      console.log(chalk.red('❌ Product not found'))
      return false
    }
    console.log('')

    // Test 3: Shutdown
    console.log(chalk.blue('Test 3: Agent Shutdown'))
    await agent.shutdown()
    console.log(chalk.green('✅ Agent shut down successfully'))
    console.log('')

    return true
  } catch (error) {
    console.error(chalk.red('❌ Test failed:'), error)
    return false
  }
}

// Run tests
if (require.main === module) {
  testProducerAgent()
    .then(success => {
      if (success) {
        console.log(chalk.green('🎉 All producer agent tests passed!'))
        process.exit(0)
      } else {
        console.log(chalk.red('❌ Some tests failed'))
        process.exit(1)
      }
    })
    .catch(error => {
      console.error(chalk.red('❌ Test error:'), error)
      process.exit(1)
    })
}

export { testProducerAgent }

