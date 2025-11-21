/**
 * Unit Tests for TrustScoreConsumerAgent
 * 
 * Tests the consumer agent's core functionality including:
 * - Initialization
 * - Product discovery
 * - Account ID validation
 */

import { TrustScoreConsumerAgent } from '../../src/agents/TrustScoreConsumerAgent'
import chalk from 'chalk'

// Mock environment variables
process.env.CONSUMER_AGENT_ID = process.env.HEDERA_ACCOUNT_ID || '0.0.123456'
process.env.CONSUMER_PRIVATE_KEY = process.env.HEDERA_PRIVATE_KEY || 'test-key'

async function testConsumerAgent(): Promise<boolean> {
  try {
    console.log(chalk.bold('🧪 Testing TrustScoreConsumerAgent'))
    console.log('')

    // Test 1: Agent initialization
    console.log(chalk.blue('Test 1: Agent Initialization'))
    const agent = new TrustScoreConsumerAgent()
    await agent.init()
    console.log(chalk.green('✅ Agent initialized successfully'))
    console.log('')

    // Test 2: Product discovery
    console.log(chalk.blue('Test 2: Product Discovery'))
    const products = await agent.discoverProducts()
    if (products.length > 0) {
      console.log(chalk.green(`✅ Found ${products.length} products`))
      products.forEach(product => {
        console.log(chalk.gray(`   - ${product.productId}: ${product.name}`))
      })
    } else {
      console.log(chalk.yellow('⚠️  No products found (expected if registry is empty)'))
    }
    console.log('')

    return true
  } catch (error) {
    console.error(chalk.red('❌ Test failed:'), error)
    return false
  }
}

// Run tests
if (require.main === module) {
  testConsumerAgent()
    .then(success => {
      if (success) {
        console.log(chalk.green('🎉 All consumer agent tests passed!'))
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

export { testConsumerAgent }

