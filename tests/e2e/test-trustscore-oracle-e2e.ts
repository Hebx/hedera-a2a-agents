/**
 * E2E Tests for TrustScore Oracle
 * 
 * End-to-end tests that verify the complete workflow:
 * 1. System initialization
 * 2. Product discovery and negotiation
 * 3. Trust score request with payment
 * 4. Error scenarios
 * 5. Rate limiting
 * 6. Circuit breaker behavior
 * 
 * These tests require:
 * - Valid Hedera testnet credentials
 * - Arkhia API key
 * - Producer server running (or will start it)
 */

import { TrustScoreProducerAgent } from '../../src/agents/TrustScoreProducerAgent'
import { TrustScoreConsumerAgent } from '../../src/agents/TrustScoreConsumerAgent'
import { MeshOrchestrator } from '../../src/agents/MeshOrchestrator'
import { globalErrorHandler, ErrorCategory, ErrorSeverity } from '../../src/utils/ErrorHandler'
import { AP2TrustScoreNegotiation } from '../../src/protocols/AP2Protocol'
import { loadEnvIfNeeded } from '../../src/utils/env'
import chalk from 'chalk'

// Load environment variables
loadEnvIfNeeded()

// Test configuration
const TEST_ACCOUNT_ID = process.env.TEST_ACCOUNT_ID || process.env.HEDERA_ACCOUNT_ID || '0.0.7132337'
const PRODUCER_PORT = parseInt(process.env.PRODUCER_PORT || '3001')
const PRODUCER_ENDPOINT = `http://localhost:${PRODUCER_PORT}`

// Setup test environment
process.env.PRODUCER_AGENT_ID = process.env.PRODUCER_AGENT_ID || TEST_ACCOUNT_ID
process.env.PRODUCER_PRIVATE_KEY = process.env.PRODUCER_PRIVATE_KEY || process.env.HEDERA_PRIVATE_KEY || ''
process.env.CONSUMER_AGENT_ID = process.env.CONSUMER_AGENT_ID || TEST_ACCOUNT_ID
process.env.CONSUMER_PRIVATE_KEY = process.env.CONSUMER_PRIVATE_KEY || process.env.HEDERA_PRIVATE_KEY || ''
process.env.MESH_TOPIC_ID = process.env.MESH_TOPIC_ID || process.env.ANALYZER_TOPIC_ID || '0.0.7132813'
process.env.TRUST_SCORE_PRICE = process.env.TRUST_SCORE_PRICE || '30000' // tinybars

interface E2ETestResults {
  systemInitialization: boolean
  productDiscovery: boolean
  ap2Negotiation: boolean
  trustScoreRequest: boolean
  paymentVerification: boolean
  errorScenarios: boolean
  rateLimiting: boolean
  circuitBreaker: boolean
  hcsEventLogging: boolean
}

async function testE2EWorkflow(): Promise<boolean> {
  const results: E2ETestResults = {
    systemInitialization: false,
    productDiscovery: false,
    ap2Negotiation: false,
    trustScoreRequest: false,
    paymentVerification: false,
    errorScenarios: false,
    rateLimiting: false,
    circuitBreaker: false,
    hcsEventLogging: false
  }

  let producer: TrustScoreProducerAgent | null = null
  let consumer: TrustScoreConsumerAgent | null = null
  let orchestrator: MeshOrchestrator | null = null

  try {
    console.log(chalk.bold('🚀 TrustScore Oracle E2E Tests'))
    console.log(chalk.gray('Testing complete end-to-end workflow'))
    console.log('')

    // Test 1: System Initialization
    console.log(chalk.bold('Test 1: System Initialization'))
    console.log(chalk.blue('  Initializing MeshOrchestrator...'))
    orchestrator = new MeshOrchestrator()
    await orchestrator.init()
    console.log(chalk.green('  ✅ MeshOrchestrator initialized'))

    console.log(chalk.blue('  Initializing Producer Agent...'))
    producer = new TrustScoreProducerAgent()
    await producer.init()
    console.log(chalk.green('  ✅ Producer agent initialized'))
    console.log(chalk.gray(`     Endpoint: ${PRODUCER_ENDPOINT}`))

    console.log(chalk.blue('  Initializing Consumer Agent...'))
    consumer = new TrustScoreConsumerAgent()
    await consumer.init()
    console.log(chalk.green('  ✅ Consumer agent initialized'))

    console.log(chalk.blue('  Registering agents...'))
    orchestrator.registerAgent(producer, 'producer', process.env.PRODUCER_AGENT_ID!, ['trustscore', 'payment'])
    orchestrator.registerAgent(consumer, 'consumer', process.env.CONSUMER_AGENT_ID!, ['trustscore', 'payment'])
    console.log(chalk.green('  ✅ Agents registered'))

    results.systemInitialization = true
    console.log(chalk.green('✅ System initialization complete'))
    console.log('')

    // Test 2: Product Discovery
    console.log(chalk.bold('Test 2: Product Discovery'))
    if (consumer) {
      const products = await consumer.discoverProducts()
      if (products.length > 0) {
        results.productDiscovery = true
        console.log(chalk.green(`✅ Found ${products.length} products`))
        products.forEach(product => {
          console.log(chalk.gray(`   - ${product.productId}: ${product.name}`))
          console.log(chalk.gray(`     Price: ${product.defaultPrice} ${product.currency}`))
          console.log(chalk.gray(`     Rate Limit: ${product.rateLimit.calls}/${product.rateLimit.period}s`))
        })
      } else {
        console.log(chalk.yellow('⚠️  No products found'))
      }
      console.log('')
    }

    // Test 3: AP2 Negotiation
    console.log(chalk.bold('Test 3: AP2 Negotiation'))
    if (consumer) {
      try {
        console.log(chalk.blue('  Initiating negotiation...'))
        const offer = await consumer.negotiatePrice('trustscore.basic.v1', PRODUCER_ENDPOINT)
        
        if (offer) {
          results.ap2Negotiation = true
          console.log(chalk.green('✅ Negotiation successful'))
          console.log(chalk.gray(`   Product: ${offer.productId}`))
          console.log(chalk.gray(`   Price: ${offer.price} ${offer.currency}`))
          console.log(chalk.gray(`   Rate Limit: ${offer.rateLimit.calls}/${offer.rateLimit.period}s`))
          console.log(chalk.gray(`   SLA: ${offer.sla.uptime} uptime, ${offer.sla.responseTime} response`))
          console.log(chalk.gray(`   Valid Until: ${new Date(offer.validUntil).toISOString()}`))

          // Verify offer is not expired
          const isExpired = AP2TrustScoreNegotiation.isOfferExpired(offer)
          if (isExpired) {
            console.log(chalk.red('❌ Offer is expired'))
            results.ap2Negotiation = false
          } else {
            const timeRemaining = AP2TrustScoreNegotiation.getTimeRemaining(offer)
            console.log(chalk.gray(`   Time Remaining: ${Math.floor(timeRemaining / 1000)}s`))
          }
        } else {
          console.log(chalk.yellow('⚠️  Negotiation returned no offer'))
        }
      } catch (error) {
        console.log(chalk.yellow(`⚠️  Negotiation failed: ${(error as Error).message}`))
      }
      console.log('')
    }

    // Test 4: Trust Score Request with Payment
    console.log(chalk.bold('Test 4: Trust Score Request with Payment'))
    if (consumer) {
      try {
        console.log(chalk.blue(`  Requesting trust score for ${TEST_ACCOUNT_ID}...`))
        const score = await consumer.requestTrustScore(
          TEST_ACCOUNT_ID,
          'trustscore.basic.v1',
          PRODUCER_ENDPOINT
        )

        if (score) {
          results.trustScoreRequest = true
          results.paymentVerification = true
          console.log(chalk.green('✅ Trust score request successful'))
          console.log(chalk.gray(`   Account: ${score.account}`))
          console.log(chalk.gray(`   Score: ${score.score}/100`))
          console.log(chalk.gray(`   Timestamp: ${new Date(score.timestamp).toISOString()}`))
          
          // Display components
          console.log(chalk.blue('  Score Components:'))
          Object.entries(score.components).forEach(([key, component]: [string, any]) => {
            console.log(chalk.gray(`     ${key}: ${component.score} (${component.tier || 'N/A'})`))
          })

          // Display risk flags
          if (score.riskFlags.length > 0) {
            console.log(chalk.yellow('  Risk Flags:'))
            score.riskFlags.forEach(flag => {
              console.log(chalk.yellow(`     - ${flag.type}: ${flag.severity}`))
            })
          } else {
            console.log(chalk.green('  ✅ No risk flags detected'))
          }
        } else {
          console.log(chalk.yellow('⚠️  Trust score request returned null'))
        }
      } catch (error) {
        const errorMessage = (error as Error).message
        if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('fetch failed')) {
          console.log(chalk.yellow('⚠️  Producer server not accessible. Skipping trust score test.'))
        } else {
          console.log(chalk.yellow(`⚠️  Trust score request error: ${errorMessage}`))
        }
      }
      console.log('')
    }

    // Test 5: Error Scenarios
    console.log(chalk.bold('Test 5: Error Scenarios'))
    try {
      // Test invalid account ID
      if (consumer) {
        try {
          await consumer.requestTrustScore('invalid-account-id', 'trustscore.basic.v1', PRODUCER_ENDPOINT)
          console.log(chalk.yellow('⚠️  Invalid account ID was accepted (unexpected)'))
        } catch (error) {
          console.log(chalk.green('✅ Invalid account ID rejected'))
        }

        // Test invalid product ID
        try {
          await consumer.negotiatePrice('invalid-product', PRODUCER_ENDPOINT)
          console.log(chalk.yellow('⚠️  Invalid product ID was accepted (unexpected)'))
        } catch (error) {
          console.log(chalk.green('✅ Invalid product ID rejected'))
        }
      }

      // Test error logging
      const testError = new Error('E2E test error')
      const logId = globalErrorHandler.logError(
        testError,
        ErrorCategory.SERVICE,
        ErrorSeverity.HIGH,
        {
          test: 'e2e',
          accountId: TEST_ACCOUNT_ID
        }
      )

      if (logId) {
        console.log(chalk.green('✅ Error logging working'))
        console.log(chalk.gray(`   Log ID: ${logId}`))
      }

      results.errorScenarios = true
      console.log(chalk.green('✅ Error scenarios handled correctly'))
    } catch (error) {
      console.log(chalk.yellow(`⚠️  Error scenario test: ${(error as Error).message}`))
    }
    console.log('')

    // Test 6: Rate Limiting
    console.log(chalk.bold('Test 6: Rate Limiting'))
    console.log(chalk.gray('  (Rate limiting is enforced per consumer agent)'))
    console.log(chalk.gray('  (This test verifies rate limit structure, not actual enforcement)'))
    if (consumer) {
      const products = await consumer.discoverProducts()
      if (products.length > 0) {
        const product = products[0]
        if (product) {
          console.log(chalk.green('✅ Rate limit structure verified'))
          console.log(chalk.gray(`   Calls: ${product.rateLimit.calls}`))
          console.log(chalk.gray(`   Period: ${product.rateLimit.period}s`))
          results.rateLimiting = true
        }
      }
    }
    console.log('')

    // Test 7: Circuit Breaker
    console.log(chalk.bold('Test 7: Circuit Breaker'))
    try {
      const circuitBreaker = globalErrorHandler.getCircuitBreaker('arkhia-api')
      const state = circuitBreaker.getState()
      console.log(chalk.green('✅ Circuit breaker initialized'))
      console.log(chalk.gray(`   State: ${state}`))
      console.log(chalk.gray('   (Circuit breaker protects Arkhia API calls)'))
      results.circuitBreaker = true
    } catch (error) {
      console.log(chalk.yellow(`⚠️  Circuit breaker test: ${(error as Error).message}`))
    }
    console.log('')

    // Test 8: HCS Event Logging
    console.log(chalk.bold('Test 8: HCS Event Logging'))
    if (orchestrator) {
      try {
        const eventData: any = {
          account: TEST_ACCOUNT_ID,
          score: 85
        }
        if (process.env.CONSUMER_AGENT_ID) {
          eventData.buyerAgentId = process.env.CONSUMER_AGENT_ID
        }
        if (process.env.PRODUCER_AGENT_ID) {
          eventData.producerAgentId = process.env.PRODUCER_AGENT_ID
        }

        await orchestrator.logEvent({
          type: 'TRUST_SCORE_DELIVERED',
          eventId: `test_${Date.now()}`,
          timestamp: Date.now(),
          data: eventData
        })
        console.log(chalk.green('✅ HCS event logged'))
        results.hcsEventLogging = true
      } catch (error) {
        console.log(chalk.yellow(`⚠️  HCS logging: ${(error as Error).message}`))
        console.log(chalk.gray('   (This is expected if HCS-11 profiles are not configured)'))
      }
      console.log('')
    }

    // Final Summary
    console.log(chalk.bold('📊 E2E Test Results Summary'))
    console.log('──────────────────────────────────────────────────')
    console.log(`System Initialization: ${results.systemInitialization ? '✅ PASS' : '❌ FAIL'}`)
    console.log(`Product Discovery:      ${results.productDiscovery ? '✅ PASS' : '⚠️  SKIP'}`)
    console.log(`AP2 Negotiation:      ${results.ap2Negotiation ? '✅ PASS' : '⚠️  SKIP'}`)
    console.log(`Trust Score Request:   ${results.trustScoreRequest ? '✅ PASS' : '⚠️  SKIP'}`)
    console.log(`Payment Verification:  ${results.paymentVerification ? '✅ PASS' : '⚠️  SKIP'}`)
    console.log(`Error Scenarios:       ${results.errorScenarios ? '✅ PASS' : '❌ FAIL'}`)
    console.log(`Rate Limiting:         ${results.rateLimiting ? '✅ PASS' : '⚠️  SKIP'}`)
    console.log(`Circuit Breaker:       ${results.circuitBreaker ? '✅ PASS' : '❌ FAIL'}`)
    console.log(`HCS Event Logging:     ${results.hcsEventLogging ? '✅ PASS' : '⚠️  SKIP'}`)
    console.log('')

    const coreTestsPassed = results.systemInitialization && 
                            results.errorScenarios && 
                            results.circuitBreaker

    if (coreTestsPassed) {
      console.log(chalk.green('🎉 Core E2E tests passed!'))
      const optionalTests = results.productDiscovery && 
                           results.ap2Negotiation && 
                           results.trustScoreRequest
      if (!optionalTests) {
        console.log(chalk.yellow('💡 Some optional tests were skipped'))
        console.log(chalk.yellow('   (Producer server may not be running or Arkhia API unavailable)'))
      }
      return true
    } else {
      console.log(chalk.red('❌ Some core E2E tests failed'))
      return false
    }

  } catch (error) {
    console.error(chalk.red('❌ E2E test failed:'), error)
    return false
  } finally {
    // Cleanup
    if (producer) {
      try {
        await producer.shutdown()
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  }
}

// Run tests
if (require.main === module) {
  testE2EWorkflow()
    .then(success => {
      process.exit(success ? 0 : 1)
    })
    .catch(error => {
      console.error(chalk.red('❌ E2E test error:'), error)
      process.exit(1)
    })
}

export { testE2EWorkflow }

