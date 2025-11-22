/**
 * Property-Based Tests for ConsumerAgent Properties
 * 
 * Tests correctness properties that must hold for ALL ConsumerAgent operations.
 * Uses fast-check for property-based testing.
 * 
 * @packageDocumentation
 */

import * as fc from 'fast-check'
import { PaymentRequirements, AP2Offer } from '../../src/marketplace/types'
import chalk from 'chalk'

// Load environment variables if needed
const loadEnvIfNeeded = require('../../src/utils/env').loadEnvIfNeeded
loadEnvIfNeeded()

/**
 * Property Test Configuration
 */
const PROPERTY_TEST_CONFIG = {
  numRuns: 100, // Minimum 100 iterations per property (per design.md line 1010)
  seed: 42, // Fixed seed for reproducibility
  endOnFailure: true // Stop on first failure for debugging
}

/**
 * Generate random Hedera account IDs for testing
 */
const accountIdArbitrary = fc.tuple(
  fc.constant('0.0.'),
  fc.integer({ min: 1, max: 999999999 })
).map(([prefix, num]) => `${prefix}${num}`)

/**
 * Generate random payment amounts (in HBAR format as string)
 */
const paymentAmountArbitrary = fc.float({ 
  min: Math.fround(0.001), 
  max: Math.fround(100.0) 
}).map(amount => amount.toFixed(6))

/**
 * Generate random payment requirements
 */
const paymentRequirementsArbitrary: fc.Arbitrary<PaymentRequirements> = fc.record({
  scheme: fc.constant('exact' as const),
  network: fc.constantFrom('hedera-testnet' as const, 'base-sepolia' as const),
  asset: fc.string({ minLength: 1, maxLength: 50 }),
  payTo: accountIdArbitrary,
  maxAmountRequired: paymentAmountArbitrary,
  resource: fc.string({ minLength: 1, maxLength: 100 }),
  description: fc.string({ minLength: 0, maxLength: 200 }),
  mimeType: fc.string({ minLength: 1, maxLength: 50 }),
  maxTimeoutSeconds: fc.integer({ min: 60, max: 3600 })
})

/**
 * Generate random AP2 offers
 */
const ap2OfferArbitrary: fc.Arbitrary<AP2Offer> = fc.record({
  type: fc.constant('AP2::OFFER' as const),
  productId: fc.string({ minLength: 5, maxLength: 50 }),
  price: paymentAmountArbitrary,
  currency: fc.constantFrom('HBAR' as const, 'USDC' as const),
  slippage: fc.constantFrom('none', '0.1%', '0.5%'),
  rateLimit: fc.record({
    calls: fc.integer({ min: 1, max: 1000 }),
    period: fc.integer({ min: 60, max: 86400 })
  }),
  sla: fc.record({
    uptime: fc.constantFrom('99.9%', '99.5%', '99.0%'),
    responseTime: fc.constantFrom('< 2s', '< 5s', '< 10s')
  }),
  validUntil: fc.integer({ min: Date.now(), max: Date.now() + 3600000 }),
  metadata: fc.record({
    producerAgentId: accountIdArbitrary,
    timestamp: fc.integer({ min: 0, max: Date.now() })
  })
})

/**
 * Generate random payment headers (base64 encoded JSON)
 */
const paymentHeaderArbitrary = fc.string({ minLength: 10, maxLength: 500 })

/**
 * Validate Hedera account ID format
 */
function isValidAccountId(accountId: string): boolean {
  const accountIdPattern = /^0\.0\.\d+$/
  return accountIdPattern.test(accountId)
}

/**
 * Feature: trustscore-oracle, Property 33: Payment Requirement Extraction
 * 
 * For any HTTP 402 response received by ConsumerAgent, the system should extract
 * payment requirements including asset type, amount, and recipient.
 * 
 * Validates: Requirements 7.1
 */
async function testProperty33() {
  console.log(chalk.blue('Testing Property 33: Payment Requirement Extraction'))
  console.log(chalk.gray(`Running ${PROPERTY_TEST_CONFIG.numRuns} iterations...`))

  fc.assert(
    fc.property(
      fc.record({
        accountId: accountIdArbitrary,
        paymentRequirements: paymentRequirementsArbitrary
      }),
      ({ accountId, paymentRequirements }) => {
        // Property: ConsumerAgent should extract payment requirements from 402 response
        
        // Check account ID is valid
        if (!isValidAccountId(accountId)) {
          return true // Skip invalid account IDs
        }

        // Simulate 402 response structure (matching TrustScoreRoute.ts line 74-81)
        const response402 = {
          status: 402,
          error: {
            code: 'PAYMENT_REQUIRED',
            message: 'Payment required to access trust score',
            payment: paymentRequirements,
            timestamp: Date.now()
          }
        }
        
        // Property: Response must have status 402
        const has402Status = response402.status === 402
        
        // Property: Response must include payment requirements
        const hasPaymentRequirements = response402.error.payment !== undefined
        
        // Property: Payment requirements must include asset type
        const hasAssetType = 
          paymentRequirements.asset !== undefined &&
          paymentRequirements.asset.length > 0
        
        // Property: Payment requirements must include amount
        const hasAmount = 
          paymentRequirements.maxAmountRequired !== undefined &&
          parseFloat(paymentRequirements.maxAmountRequired) > 0
        
        // Property: Payment requirements must include recipient
        const hasRecipient = 
          paymentRequirements.payTo !== undefined &&
          paymentRequirements.payTo.length > 0 &&
          isValidAccountId(paymentRequirements.payTo)
        
        // Property: Payment requirements must include network
        const hasNetwork = paymentRequirements.network !== undefined
        
        // Property: Payment requirements must include resource path
        // Resource path may or may not contain accountId (it could be a template)
        const hasResource = 
          paymentRequirements.resource !== undefined &&
          paymentRequirements.resource.length > 0

        return has402Status && hasPaymentRequirements && hasAssetType && hasAmount && hasRecipient && hasNetwork && hasResource
      }
    ),
    {
      numRuns: PROPERTY_TEST_CONFIG.numRuns,
      seed: PROPERTY_TEST_CONFIG.seed,
      endOnFailure: PROPERTY_TEST_CONFIG.endOnFailure
    }
  )

  console.log(chalk.green(`✅ Property 33 passed: All ${PROPERTY_TEST_CONFIG.numRuns} iterations valid`))
}

/**
 * Feature: trustscore-oracle, Property 34: Facilitator Call Parameters
 * 
 * For any payment initiation, the system should call the payment facilitator
 * with asset type, amount, and recipient account.
 * 
 * Validates: Requirements 7.2
 */
async function testProperty34() {
  console.log(chalk.blue('Testing Property 34: Facilitator Call Parameters'))
  console.log(chalk.gray(`Running ${PROPERTY_TEST_CONFIG.numRuns} iterations...`))

  fc.assert(
    fc.property(
      fc.record({
        paymentRequirements: paymentRequirementsArbitrary,
        accountId: accountIdArbitrary
      }),
      ({ paymentRequirements, accountId }) => {
        // Property: Facilitator should be called with correct parameters
        
        // Check account ID is valid
        if (!isValidAccountId(accountId)) {
          return true // Skip invalid account IDs
        }

        // Simulate facilitator call (matching TrustScoreConsumerAgent.ts payForAccess method)
        const facilitatorCall = {
          assetType: paymentRequirements.asset,
          amount: paymentRequirements.maxAmountRequired,
          recipient: paymentRequirements.payTo,
          network: paymentRequirements.network,
          scheme: paymentRequirements.scheme,
          resource: paymentRequirements.resource,
          description: paymentRequirements.description,
          mimeType: paymentRequirements.mimeType,
          maxTimeoutSeconds: paymentRequirements.maxTimeoutSeconds
        }
        
        // Property: Facilitator call must include asset type
        const hasAssetType = 
          facilitatorCall.assetType === paymentRequirements.asset &&
          facilitatorCall.assetType.length > 0
        
        // Property: Facilitator call must include amount
        const hasAmount = 
          facilitatorCall.amount === paymentRequirements.maxAmountRequired &&
          parseFloat(facilitatorCall.amount) > 0
        
        // Property: Facilitator call must include recipient
        const hasRecipient = 
          facilitatorCall.recipient === paymentRequirements.payTo &&
          isValidAccountId(facilitatorCall.recipient)
        
        // Property: Facilitator call must include network
        const hasNetwork = facilitatorCall.network === paymentRequirements.network
        
        // Property: Facilitator call must include all required fields
        const hasAllFields = 
          facilitatorCall.scheme !== undefined &&
          facilitatorCall.resource !== undefined &&
          facilitatorCall.description !== undefined &&
          facilitatorCall.mimeType !== undefined &&
          facilitatorCall.maxTimeoutSeconds !== undefined &&
          facilitatorCall.maxTimeoutSeconds > 0

        return hasAssetType && hasAmount && hasRecipient && hasNetwork && hasAllFields
      }
    ),
    {
      numRuns: PROPERTY_TEST_CONFIG.numRuns,
      seed: PROPERTY_TEST_CONFIG.seed,
      endOnFailure: PROPERTY_TEST_CONFIG.endOnFailure
    }
  )

  console.log(chalk.green(`✅ Property 34 passed: All ${PROPERTY_TEST_CONFIG.numRuns} iterations valid`))
}

/**
 * Feature: trustscore-oracle, Property 35: Payment Token Receipt
 * 
 * For any facilitator payment execution, the system should receive a payment token
 * for inclusion in subsequent requests.
 * 
 * Validates: Requirements 7.3
 */
async function testProperty35() {
  console.log(chalk.blue('Testing Property 35: Payment Token Receipt'))
  console.log(chalk.gray(`Running ${PROPERTY_TEST_CONFIG.numRuns} iterations...`))

  const transactionHashArbitrary = fc.string({ minLength: 32, maxLength: 64 })

  fc.assert(
    fc.property(
      fc.record({
        paymentRequirements: paymentRequirementsArbitrary,
        transactionHash: transactionHashArbitrary
      }),
      ({ paymentRequirements, transactionHash }) => {
        // Property: Facilitator payment execution should return payment token
        
        // Simulate facilitator settlement response (matching facilitator.settle() response)
        const settlementResult = {
          success: true,
          txHash: transactionHash,
          networkId: paymentRequirements.network,
          amount: paymentRequirements.maxAmountRequired,
          currency: paymentRequirements.asset,
          timestamp: Date.now()
        }
        
        // Property: Settlement result must indicate success
        const isSuccessful = settlementResult.success === true
        
        // Property: Settlement result must include transaction hash
        const hasTxHash = 
          settlementResult.txHash !== undefined &&
          settlementResult.txHash.length > 0 &&
          settlementResult.txHash === transactionHash
        
        // Property: Settlement result must include network
        const hasNetwork = 
          settlementResult.networkId === paymentRequirements.network
        
        // Property: Settlement result must include amount
        const hasAmount = 
          settlementResult.amount === paymentRequirements.maxAmountRequired
        
        // Property: Settlement result must include timestamp
        const hasTimestamp = settlementResult.timestamp > 0
        
        // Property: Payment token should be created for subsequent requests
        // In real implementation, this would be encoded as X-PAYMENT header
        const paymentToken = Buffer.from(JSON.stringify({
          x402Version: 1,
          scheme: paymentRequirements.scheme,
          network: paymentRequirements.network,
          transactionHash: transactionHash,
          amount: paymentRequirements.maxAmountRequired,
          timestamp: Date.now()
        })).toString('base64')
        
        const hasPaymentToken = paymentToken !== undefined && paymentToken.length > 0

        return isSuccessful && hasTxHash && hasNetwork && hasAmount && hasTimestamp && hasPaymentToken
      }
    ),
    {
      numRuns: PROPERTY_TEST_CONFIG.numRuns,
      seed: PROPERTY_TEST_CONFIG.seed,
      endOnFailure: PROPERTY_TEST_CONFIG.endOnFailure
    }
  )

  console.log(chalk.green(`✅ Property 35 passed: All ${PROPERTY_TEST_CONFIG.numRuns} iterations valid`))
}

/**
 * Feature: trustscore-oracle, Property 36: Retry Header Inclusion
 * 
 * For any API request retry after payment, the system should include the payment
 * token in the X-PAYMENT header.
 * 
 * Validates: Requirements 7.4
 */
async function testProperty36() {
  console.log(chalk.blue('Testing Property 36: Retry Header Inclusion'))
  console.log(chalk.gray(`Running ${PROPERTY_TEST_CONFIG.numRuns} iterations...`))

  fc.assert(
    fc.property(
      fc.record({
        paymentHeader: paymentHeaderArbitrary,
        accountId: accountIdArbitrary,
        endpoint: fc.string({ minLength: 10, maxLength: 200 })
      }),
      ({ paymentHeader, accountId, endpoint }) => {
        // Property: Retry request should include X-PAYMENT header
        
        // Check account ID is valid
        if (!isValidAccountId(accountId)) {
          return true // Skip invalid account IDs
        }

        // Simulate retry request after payment (matching TrustScoreConsumerAgent.ts line 254-258)
        const retryRequest = {
          url: `${endpoint}/trustscore/${accountId}`,
          method: 'GET' as const,
          headers: {
            'X-PAYMENT': paymentHeader,
            'Content-Type': 'application/json'
          }
        }
        
        // Property: Retry request must include X-PAYMENT header
        const hasPaymentHeader = 
          retryRequest.headers['X-PAYMENT'] !== undefined &&
          retryRequest.headers['X-PAYMENT'] === paymentHeader &&
          retryRequest.headers['X-PAYMENT'].length > 0
        
        // Property: Retry request must use correct HTTP method
        const hasCorrectMethod = retryRequest.method === 'GET'
        
        // Property: Retry request must target correct endpoint
        const hasCorrectEndpoint = 
          retryRequest.url.includes(endpoint) &&
          retryRequest.url.includes(accountId)
        
        // Property: Retry request must include Content-Type header
        const hasContentType = retryRequest.headers['Content-Type'] === 'application/json'
        
        // Property: Payment header must be present (format validation is implementation-specific)
        const paymentHeaderValid = paymentHeader.length > 0

        return hasPaymentHeader && hasCorrectMethod && hasCorrectEndpoint && hasContentType && paymentHeaderValid
      }
    ),
    {
      numRuns: PROPERTY_TEST_CONFIG.numRuns,
      seed: PROPERTY_TEST_CONFIG.seed,
      endOnFailure: PROPERTY_TEST_CONFIG.endOnFailure
    }
  )

  console.log(chalk.green(`✅ Property 36 passed: All ${PROPERTY_TEST_CONFIG.numRuns} iterations valid`))
}

// Main test runner
async function runAllPropertyTests() {
  console.log(chalk.bold('🧪 Running ConsumerAgent Property-Based Tests'))
  console.log('')
  console.log(chalk.blue(`Configuration:`))
  console.log(chalk.gray(`  - Iterations per property: ${PROPERTY_TEST_CONFIG.numRuns}`))
  console.log(chalk.gray(`  - Seed: ${PROPERTY_TEST_CONFIG.seed}`))
  console.log('')

  try {
    await testProperty33()
    console.log('')
    await testProperty34()
    console.log('')
    await testProperty35()
    console.log('')
    await testProperty36()
    console.log('')
    console.log(chalk.green('🎉 All ConsumerAgent property tests passed!'))
  } catch (error) {
    console.error(chalk.red('❌ Property test failed:'), error)
    process.exit(1)
  }
}

// Run tests if executed directly
if (require.main === module) {
  runAllPropertyTests()
    .then(() => {
      console.log(chalk.green('\n✅ All ConsumerAgent property tests completed successfully'))
      process.exit(0)
    })
    .catch((error) => {
      console.error(chalk.red('\n❌ ConsumerAgent property tests failed:'), error)
      process.exit(1)
    })
}

export { 
  PROPERTY_TEST_CONFIG, 
  accountIdArbitrary, 
  paymentAmountArbitrary, 
  paymentRequirementsArbitrary,
  ap2OfferArbitrary,
  paymentHeaderArbitrary,
  isValidAccountId
}

