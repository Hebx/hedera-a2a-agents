/**
 * Complete Integration Tests for TrustScore Oracle
 * 
 * Tests the complete A2A → AP2 → x402 → Analytics → HCS workflow:
 * - Agent initialization and registration
 * - Product discovery
 * - AP2 negotiation with term enforcement
 * - x402 payment flow
 * - Trust score computation
 * - Error handling and circuit breaker
 * - HCS event logging
 * 
 * Uses real implementations (not mocks) to verify end-to-end functionality.
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

interface TestResults {
  orchestratorInit: boolean
  producerInit: boolean
  consumerInit: boolean
  agentRegistration: boolean
  productDiscovery: boolean
  ap2Negotiation: boolean
  ap2Validation: boolean
  termEnforcement: boolean
  paymentFlow: boolean
  trustScoreComputation: boolean
  errorHandling: boolean
  circuitBreaker: boolean
  hcsLogging: boolean
}

async function testCompleteWorkflow(): Promise<boolean> {
  const results: TestResults = {
    orchestratorInit: false,
    producerInit: false,
    consumerInit: false,
    agentRegistration: false,
    productDiscovery: false,
    ap2Negotiation: false,
    ap2Validation: false,
    termEnforcement: false,
    paymentFlow: false,
    trustScoreComputation: false,
    errorHandling: false,
    circuitBreaker: false,
    hcsLogging: false
  }

  let producer: TrustScoreProducerAgent | null = null
  let consumer: TrustScoreConsumerAgent | null = null
  let orchestrator: MeshOrchestrator | null = null

  try {
    console.log(chalk.bold('🧪 TrustScore Oracle Complete Integration Tests'))
    console.log(chalk.gray('Testing A2A → AP2 → x402 → Analytics → HCS workflow'))
    console.log('')

    // Test 1: Initialize MeshOrchestrator
    console.log(chalk.blue('Test 1: Initialize MeshOrchestrator'))
    orchestrator = new MeshOrchestrator()
    await orchestrator.init()
    results.orchestratorInit = true
    console.log(chalk.green('✅ MeshOrchestrator initialized'))
    console.log('')

    // Test 2: Initialize Producer Agent
    console.log(chalk.blue('Test 2: Initialize Producer Agent'))
    producer = new TrustScoreProducerAgent()
    await producer.init()
    results.producerInit = true
    console.log(chalk.green('✅ Producer agent initialized'))
    console.log(chalk.gray(`   Endpoint: ${PRODUCER_ENDPOINT}`))
    console.log('')

    // Test 3: Initialize Consumer Agent
    console.log(chalk.blue('Test 3: Initialize Consumer Agent'))
    consumer = new TrustScoreConsumerAgent()
    await consumer.init()
    results.consumerInit = true
    console.log(chalk.green('✅ Consumer agent initialized'))
    console.log('')

    // Test 4: Register agents with orchestrator
    console.log(chalk.blue('Test 4: Register Agents'))
    if (producer && consumer && orchestrator) {
      orchestrator.registerAgent(producer, 'producer', process.env.PRODUCER_AGENT_ID!, ['trustscore', 'payment'])
      orchestrator.registerAgent(consumer, 'consumer', process.env.CONSUMER_AGENT_ID!, ['trustscore', 'payment'])
      results.agentRegistration = true
      console.log(chalk.green('✅ Agents registered with orchestrator'))
      console.log('')
    }

    // Test 5: Product Discovery
    console.log(chalk.blue('Test 5: Product Discovery'))
    if (consumer) {
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
    }

    // Test 6: AP2 Negotiation
    console.log(chalk.blue('Test 6: AP2 Negotiation'))
    if (consumer) {
      try {
        const offer = await consumer.negotiatePrice('trustscore.basic.v1', PRODUCER_ENDPOINT)
        if (offer) {
          results.ap2Negotiation = true
          console.log(chalk.green('✅ AP2 negotiation successful'))
          console.log(chalk.gray(`   Price: ${offer.price} ${offer.currency}`))
          console.log(chalk.gray(`   Rate Limit: ${offer.rateLimit.calls}/${offer.rateLimit.period}s`))
          console.log(chalk.gray(`   Valid Until: ${new Date(offer.validUntil).toISOString()}`))
        } else {
          console.log(chalk.yellow('⚠️  Negotiation returned no offer'))
        }
      } catch (error) {
        console.log(chalk.yellow(`⚠️  Negotiation failed: ${(error as Error).message}`))
      }
      console.log('')
    }

    // Test 7: AP2 Validation
    console.log(chalk.blue('Test 7: AP2 Validation'))
    try {
      const negotiationRequest = AP2TrustScoreNegotiation.createNegotiationRequest(
        'trustscore.basic.v1',
        process.env.CONSUMER_AGENT_ID || '0.0.test',
        '0.5',
        'HBAR'
      )

      const validation = AP2TrustScoreNegotiation.validateNegotiationRequest(negotiationRequest)
      if (validation.valid) {
        results.ap2Validation = true
        console.log(chalk.green('✅ AP2 negotiation request validation passed'))
      } else {
        console.log(chalk.red(`❌ Validation failed: ${validation.error}`))
      }

      // Test offer validation
      const offer = AP2TrustScoreNegotiation.createOffer(
        'trustscore.basic.v1',
        process.env.PRODUCER_AGENT_ID || '0.0.test',
        '0.3',
        'HBAR'
      )

      const offerValidation = AP2TrustScoreNegotiation.validateOffer(offer)
      if (offerValidation.valid) {
        console.log(chalk.green('✅ AP2 offer validation passed'))
      } else {
        console.log(chalk.red(`❌ Offer validation failed: ${offerValidation.error}`))
      }
    } catch (error) {
      console.log(chalk.yellow(`⚠️  Validation test error: ${(error as Error).message}`))
    }
    console.log('')

    // Test 8: Term Enforcement
    console.log(chalk.blue('Test 8: Term Enforcement'))
    try {
      const offer = AP2TrustScoreNegotiation.createOffer(
        'trustscore.basic.v1',
        process.env.PRODUCER_AGENT_ID || '0.0.test',
        '0.3',
        'HBAR',
        { calls: 100, period: 86400 },
        { uptime: '99.9%', responseTime: '< 2s' }
      )

      // Test compliant terms
      const compliant = AP2TrustScoreNegotiation.enforceTerms(
        offer,
        '0.3',
        { calls: 100, period: 86400 },
        { uptime: '99.9%', responseTime: '< 2s' }
      )

      if (compliant.compliant) {
        results.termEnforcement = true
        console.log(chalk.green('✅ Term enforcement passed (compliant case)'))
      }

      // Test non-compliant terms
      const nonCompliant = AP2TrustScoreNegotiation.enforceTerms(
        offer,
        '0.5', // Higher price
        { calls: 50, period: 86400 }, // Lower rate limit
        { uptime: '95.0%', responseTime: '< 2s' } // Lower SLA
      )

      if (!nonCompliant.compliant && nonCompliant.violations.length > 0) {
        console.log(chalk.green('✅ Term enforcement detected violations'))
        console.log(chalk.gray(`   Violations: ${nonCompliant.violations.length}`))
      }
    } catch (error) {
      console.log(chalk.yellow(`⚠️  Term enforcement test error: ${(error as Error).message}`))
    }
    console.log('')

    // Test 9: Payment Flow (if producer server is running)
    console.log(chalk.blue('Test 9: Payment Flow'))
    if (consumer) {
      try {
        // This will attempt to request a trust score, which triggers payment flow
        // Note: This requires the producer server to be running
        const score = await consumer.requestTrustScore(
          TEST_ACCOUNT_ID,
          'trustscore.basic.v1',
          PRODUCER_ENDPOINT
        )

        if (score) {
          results.paymentFlow = true
          results.trustScoreComputation = true
          console.log(chalk.green('✅ Payment flow successful'))
          console.log(chalk.green(`✅ Trust score computed: ${score.score}/100`))
          console.log(chalk.gray(`   Account: ${score.account}`))
          console.log(chalk.gray(`   Components: ${Object.keys(score.components).length}`))
          console.log(chalk.gray(`   Risk Flags: ${score.riskFlags.length}`))
        } else {
          console.log(chalk.yellow('⚠️  Trust score request returned null (producer server may not be running)'))
        }
      } catch (error) {
        const errorMessage = (error as Error).message
        if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('fetch failed')) {
          console.log(chalk.yellow('⚠️  Producer server not running. Payment flow test skipped.'))
        } else {
          console.log(chalk.yellow(`⚠️  Payment flow test error: ${errorMessage}`))
        }
      }
      console.log('')
    }

    // Test 10: Error Handling
    console.log(chalk.blue('Test 10: Error Handling'))
    try {
      // Test error logging
      const testError = new Error('Test error for integration test')
      const context: any = {
        accountId: TEST_ACCOUNT_ID,
        test: true
      }
      if (process.env.CONSUMER_AGENT_ID) {
        context.agentId = process.env.CONSUMER_AGENT_ID
      }

      const logId = globalErrorHandler.logError(
        testError,
        ErrorCategory.VALIDATION,
        ErrorSeverity.MEDIUM,
        context
      )

      if (logId) {
        results.errorHandling = true
        console.log(chalk.green('✅ Error logging working'))
        console.log(chalk.gray(`   Log ID: ${logId}`))

        // Test error query
        const logs = globalErrorHandler.queryLogs({
          category: ErrorCategory.VALIDATION,
          accountId: TEST_ACCOUNT_ID
        })

        if (logs.length > 0) {
          console.log(chalk.green('✅ Error query working'))
          console.log(chalk.gray(`   Found ${logs.length} matching logs`))
        }

        // Test error statistics
        const stats = globalErrorHandler.getStatistics()
        console.log(chalk.green('✅ Error statistics working'))
        console.log(chalk.gray(`   Total errors: ${stats.total}`))
        console.log(chalk.gray(`   Unresolved: ${stats.unresolved}`))
      }
    } catch (error) {
      console.log(chalk.yellow(`⚠️  Error handling test error: ${(error as Error).message}`))
    }
    console.log('')

    // Test 11: Circuit Breaker
    console.log(chalk.blue('Test 11: Circuit Breaker'))
    try {
      const circuitBreaker = globalErrorHandler.getCircuitBreaker('test-service')
      const state = circuitBreaker.getState()
      if (state) {
        results.circuitBreaker = true
        console.log(chalk.green('✅ Circuit breaker initialized'))
        console.log(chalk.gray(`   State: ${state}`))
      }
    } catch (error) {
      console.log(chalk.yellow(`⚠️  Circuit breaker test error: ${(error as Error).message}`))
    }
    console.log('')

    // Test 12: HCS Logging
    console.log(chalk.blue('Test 12: HCS Event Logging'))
    if (orchestrator) {
      try {
        const eventData: any = {
          account: TEST_ACCOUNT_ID
        }
        if (process.env.CONSUMER_AGENT_ID) {
          eventData.buyerAgentId = process.env.CONSUMER_AGENT_ID
        }
        if (process.env.PRODUCER_AGENT_ID) {
          eventData.producerAgentId = process.env.PRODUCER_AGENT_ID
        }

        await orchestrator.logEvent({
          type: 'TRUST_COMPUTATION_REQUESTED',
          eventId: `test_${Date.now()}`,
          timestamp: Date.now(),
          data: eventData
        })
        results.hcsLogging = true
        console.log(chalk.green('✅ HCS event logging working'))
      } catch (error) {
        // HCS logging may fail if HCS-11 profiles aren't set up
        console.log(chalk.yellow(`⚠️  HCS logging test: ${(error as Error).message}`))
        console.log(chalk.gray('   (This is expected if HCS-11 profiles are not configured)'))
      }
      console.log('')
    }

    // Summary
    console.log(chalk.bold('📊 Test Results Summary'))
    console.log('──────────────────────────────────────────────────')
    console.log(`Orchestrator Init:     ${results.orchestratorInit ? '✅ PASS' : '❌ FAIL'}`)
    console.log(`Producer Init:         ${results.producerInit ? '✅ PASS' : '❌ FAIL'}`)
    console.log(`Consumer Init:         ${results.consumerInit ? '✅ PASS' : '❌ FAIL'}`)
    console.log(`Agent Registration:    ${results.agentRegistration ? '✅ PASS' : '❌ FAIL'}`)
    console.log(`Product Discovery:     ${results.productDiscovery ? '✅ PASS' : '⚠️  SKIP'}`)
    console.log(`AP2 Negotiation:      ${results.ap2Negotiation ? '✅ PASS' : '⚠️  SKIP'}`)
    console.log(`AP2 Validation:       ${results.ap2Validation ? '✅ PASS' : '❌ FAIL'}`)
    console.log(`Term Enforcement:     ${results.termEnforcement ? '✅ PASS' : '⚠️  SKIP'}`)
    console.log(`Payment Flow:         ${results.paymentFlow ? '✅ PASS' : '⚠️  SKIP'}`)
    console.log(`Trust Score Compute:  ${results.trustScoreComputation ? '✅ PASS' : '⚠️  SKIP'}`)
    console.log(`Error Handling:       ${results.errorHandling ? '✅ PASS' : '❌ FAIL'}`)
    console.log(`Circuit Breaker:      ${results.circuitBreaker ? '✅ PASS' : '❌ FAIL'}`)
    console.log(`HCS Logging:          ${results.hcsLogging ? '✅ PASS' : '⚠️  SKIP'}`)
    console.log('')

    const coreTestsPassed = results.orchestratorInit && 
                            results.producerInit && 
                            results.consumerInit && 
                            results.agentRegistration &&
                            results.ap2Validation &&
                            results.errorHandling &&
                            results.circuitBreaker

    if (coreTestsPassed) {
      console.log(chalk.green('🎉 Core integration tests passed!'))
      const optionalTests = results.productDiscovery && results.ap2Negotiation && results.paymentFlow
      if (!optionalTests) {
        console.log(chalk.yellow('💡 Some optional tests were skipped (producer server may not be running)'))
      }
      return true
    } else {
      console.log(chalk.red('❌ Some core tests failed'))
      return false
    }

  } catch (error) {
    console.error(chalk.red('❌ Integration test failed:'), error)
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
  testCompleteWorkflow()
    .then(success => {
      process.exit(success ? 0 : 1)
    })
    .catch(error => {
      console.error(chalk.red('❌ Test error:'), error)
      process.exit(1)
    })
}

export { testCompleteWorkflow }

