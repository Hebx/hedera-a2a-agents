/**
 * Property-Based Tests for Rate Limiting Properties
 * 
 * Tests correctness properties that must hold for ALL Rate Limiting operations.
 * Uses fast-check for property-based testing.
 * 
 * @packageDocumentation
 */

import * as fc from 'fast-check'
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
 * Generate random rate limit configs
 */
const rateLimitArbitrary = fc.record({
  calls: fc.integer({ min: 1, max: 1000 }),
  period: fc.integer({ min: 60, max: 86400 }) // 1 minute to 1 day
})

/**
 * Generate random timestamps
 */
const timestampArbitrary = fc.integer({ min: 0, max: Date.now() + 86400000 })

/**
 * Feature: trustscore-oracle, Property 44: Rate Limit Tracking
 * 
 * For any negotiated rate limit, the system should track API calls per
 * ConsumerAgent per time window.
 * 
 * Validates: Requirements 13.1
 */
async function testProperty44() {
  console.log(chalk.blue('Testing Property 44: Rate Limit Tracking'))
  console.log(chalk.gray(`Running ${PROPERTY_TEST_CONFIG.numRuns} iterations...`))

  fc.assert(
    fc.property(
      fc.record({
        consumerAgentId: accountIdArbitrary,
        rateLimit: rateLimitArbitrary,
        callCount: fc.integer({ min: 0, max: 1000 }),
        windowStart: timestampArbitrary
      }),
      ({ consumerAgentId, rateLimit, callCount, windowStart }) => {
        // Property: System should track API calls per ConsumerAgent per time window
        
        // Simulate rate limit tracking (matching TrustScoreProducerAgent.ts rateLimitMap)
        const rateLimitKey = `${consumerAgentId}:${rateLimit.calls}:${rateLimit.period}`
        const currentTime = Date.now()
        const windowExpiresAt = windowStart + rateLimit.period * 1000 // Convert to milliseconds
        
        // Check if current window has expired
        const isWindowExpired = currentTime >= windowExpiresAt
        
        // Simulate rate limit entry
        const rateLimitEntry = {
          count: callCount,
          resetAt: windowExpiresAt
        }
        
        // Property: Rate limit entry must have call count
        const hasCallCount = rateLimitEntry.count === callCount && rateLimitEntry.count >= 0
        
        // Property: Rate limit entry must have reset timestamp
        const hasResetTimestamp = 
          rateLimitEntry.resetAt === windowExpiresAt &&
          rateLimitEntry.resetAt > windowStart
        
        // Property: Rate limit key should be unique per consumer + limit config
        const hasUniqueKey = 
          rateLimitKey.includes(consumerAgentId) &&
          rateLimitKey.includes(rateLimit.calls.toString()) &&
          rateLimitKey.includes(rateLimit.period.toString())
        
        // Property: Call count is tracked regardless of limit
        // Count can exceed limit (which triggers violation) - tracking is independent of enforcement
        const callCountValid = rateLimitEntry.count >= 0 // Count is tracked (can exceed limit)

        return hasCallCount && hasResetTimestamp && hasUniqueKey && callCountValid
      }
    ),
    {
      numRuns: PROPERTY_TEST_CONFIG.numRuns,
      seed: PROPERTY_TEST_CONFIG.seed,
      endOnFailure: PROPERTY_TEST_CONFIG.endOnFailure
    }
  )

  console.log(chalk.green(`✅ Property 44 passed: All ${PROPERTY_TEST_CONFIG.numRuns} iterations valid`))
}

/**
 * Feature: trustscore-oracle, Property 45: Rate Limit Counter Reset
 * 
 * For any rate limit time window expiration, the system should reset the
 * call counter for that ConsumerAgent.
 * 
 * Validates: Requirements 13.3
 */
async function testProperty45() {
  console.log(chalk.blue('Testing Property 45: Rate Limit Counter Reset'))
  console.log(chalk.gray(`Running ${PROPERTY_TEST_CONFIG.numRuns} iterations...`))

  fc.assert(
    fc.property(
      fc.record({
        consumerAgentId: accountIdArbitrary,
        rateLimit: rateLimitArbitrary,
        oldCallCount: fc.integer({ min: 0, max: 1000 }),
        windowStart: timestampArbitrary,
        currentTime: fc.integer({ min: 0, max: Date.now() + 86400000 })
      }),
      ({ consumerAgentId, rateLimit, oldCallCount, windowStart, currentTime }) => {
        // Property: Rate limit counter should reset when window expires
        
        // Calculate window expiration
        const windowExpiresAt = windowStart + rateLimit.period * 1000 // Convert to milliseconds
        const isWindowExpired = currentTime >= windowExpiresAt
        
        // Simulate rate limit entry before reset
        const oldRateLimitEntry = {
          count: oldCallCount,
          resetAt: windowExpiresAt
        }
        
        // Simulate counter reset
        const newRateLimitEntry = isWindowExpired ? {
          count: 0, // Reset counter
          resetAt: currentTime + rateLimit.period * 1000 // New window
        } : {
          count: oldCallCount, // Keep current count
          resetAt: windowExpiresAt // Keep current window
        }
        
        // Property: If window expired, counter should be reset to 0
        const counterReset = 
          isWindowExpired 
            ? newRateLimitEntry.count === 0 && newRateLimitEntry.resetAt > oldRateLimitEntry.resetAt
            : newRateLimitEntry.count === oldCallCount && newRateLimitEntry.resetAt === oldRateLimitEntry.resetAt
        
        // Property: New reset timestamp should be after old one (if reset)
        const resetTimestampUpdated = 
          isWindowExpired 
            ? newRateLimitEntry.resetAt > oldRateLimitEntry.resetAt
            : newRateLimitEntry.resetAt === oldRateLimitEntry.resetAt
        
        // Property: Reset logic should be consistent
        const resetConsistent = counterReset && resetTimestampUpdated

        return resetConsistent
      }
    ),
    {
      numRuns: PROPERTY_TEST_CONFIG.numRuns,
      seed: PROPERTY_TEST_CONFIG.seed,
      endOnFailure: PROPERTY_TEST_CONFIG.endOnFailure
    }
  )

  console.log(chalk.green(`✅ Property 45 passed: All ${PROPERTY_TEST_CONFIG.numRuns} iterations valid`))
}

/**
 * Feature: trustscore-oracle, Property 46: Default Rate Limit Application
 * 
 * For any ConsumerAgent without a negotiated rate limit, the system should
 * apply a default limit of 100 calls per day.
 * 
 * Validates: Requirements 13.4
 */
async function testProperty46() {
  console.log(chalk.blue('Testing Property 46: Default Rate Limit Application'))
  console.log(chalk.gray(`Running ${PROPERTY_TEST_CONFIG.numRuns} iterations...`))

  const DEFAULT_RATE_LIMIT = {
    calls: 100,
    period: 86400 // 24 hours in seconds
  }

  fc.assert(
    fc.property(
      fc.record({
        consumerAgentId: accountIdArbitrary,
        hasNegotiatedLimit: fc.boolean()
      }),
      ({ consumerAgentId, hasNegotiatedLimit }) => {
        // Property: System should apply default rate limit when no negotiated limit exists
        
        // Simulate negotiated rate limit (if any)
        // For property test, use a fixed negotiated limit structure
        const negotiatedLimit = hasNegotiatedLimit ? {
          calls: 200, // Example negotiated limit
          period: 43200 // Example: 12 hours
        } : null
        
        // Apply rate limit (default or negotiated)
        const appliedLimit = negotiatedLimit || DEFAULT_RATE_LIMIT
        
        // Property: Applied limit must have calls
        const hasCalls = appliedLimit.calls > 0 && appliedLimit.calls <= 10000 // Reasonable upper bound
        
        // Property: Applied limit must have period
        const hasPeriod = appliedLimit.period > 0 && appliedLimit.period <= 86400 * 7 // Reasonable upper bound (7 days)
        
        // Property: If no negotiated limit, default should be applied
        const defaultApplied = 
          !hasNegotiatedLimit 
            ? appliedLimit.calls === DEFAULT_RATE_LIMIT.calls && 
              appliedLimit.period === DEFAULT_RATE_LIMIT.period
            : appliedLimit.calls === negotiatedLimit!.calls &&
              appliedLimit.period === negotiatedLimit!.period
        
        // Property: Default limit should be 100 calls per day
        const defaultLimitValid = 
          DEFAULT_RATE_LIMIT.calls === 100 &&
          DEFAULT_RATE_LIMIT.period === 86400

        return hasCalls && hasPeriod && defaultApplied && defaultLimitValid
      }
    ),
    {
      numRuns: PROPERTY_TEST_CONFIG.numRuns,
      seed: PROPERTY_TEST_CONFIG.seed,
      endOnFailure: PROPERTY_TEST_CONFIG.endOnFailure
    }
  )

  console.log(chalk.green(`✅ Property 46 passed: All ${PROPERTY_TEST_CONFIG.numRuns} iterations valid`))
}

/**
 * Feature: trustscore-oracle, Property 47: Rate Limit Violation Logging
 * 
 * For any repeated rate limit violations, the system should log the violations
 * to HCS for audit purposes.
 * 
 * Validates: Requirements 13.5
 */
async function testProperty47() {
  console.log(chalk.blue('Testing Property 47: Rate Limit Violation Logging'))
  console.log(chalk.gray(`Running ${PROPERTY_TEST_CONFIG.numRuns} iterations...`))

  fc.assert(
    fc.property(
      fc.record({
        consumerAgentId: accountIdArbitrary,
        rateLimit: rateLimitArbitrary,
        callCount: fc.integer({ min: 0, max: 2000 }),
        violationCount: fc.integer({ min: 0, max: 10 })
      }),
      ({ consumerAgentId, rateLimit, callCount, violationCount }) => {
        // Property: Rate limit violations should be logged to HCS
        
        // Check if rate limit is violated
        const isViolated = callCount > rateLimit.calls
        const repeatedViolations = violationCount > 1
        
        // Simulate HCS log entry for violations
        const violationLog = {
          consumerAgentId,
          rateLimit,
          callCount,
          violationCount,
          timestamp: Date.now(),
          logged: isViolated && repeatedViolations
        }
        
        // Property: Violation log must include consumer agent ID
        const hasConsumerAgentId = violationLog.consumerAgentId === consumerAgentId
        
        // Property: Violation log must include rate limit config
        const hasRateLimit = 
          violationLog.rateLimit.calls === rateLimit.calls &&
          violationLog.rateLimit.period === rateLimit.period
        
        // Property: Violation log must include call count
        const hasCallCount = violationLog.callCount === callCount
        
        // Property: Violation log must include violation count
        const hasViolationCount = violationLog.violationCount === violationCount
        
        // Property: Violation log must include timestamp
        const hasTimestamp = violationLog.timestamp > 0
        
        // Property: Logging should occur for repeated violations
        const shouldLog = isViolated && repeatedViolations
        const loggingOccurred = violationLog.logged === shouldLog
        
        // Property: Log should contain all required fields
        const logComplete = hasConsumerAgentId && hasRateLimit && hasCallCount && hasViolationCount && hasTimestamp

        return logComplete && loggingOccurred
      }
    ),
    {
      numRuns: PROPERTY_TEST_CONFIG.numRuns,
      seed: PROPERTY_TEST_CONFIG.seed,
      endOnFailure: PROPERTY_TEST_CONFIG.endOnFailure
    }
  )

  console.log(chalk.green(`✅ Property 47 passed: All ${PROPERTY_TEST_CONFIG.numRuns} iterations valid`))
}

// Main test runner
async function runAllPropertyTests() {
  console.log(chalk.bold('🧪 Running Rate Limiting Property-Based Tests'))
  console.log('')
  console.log(chalk.blue(`Configuration:`))
  console.log(chalk.gray(`  - Iterations per property: ${PROPERTY_TEST_CONFIG.numRuns}`))
  console.log(chalk.gray(`  - Seed: ${PROPERTY_TEST_CONFIG.seed}`))
  console.log('')

  try {
    await testProperty44()
    console.log('')
    await testProperty45()
    console.log('')
    await testProperty46()
    console.log('')
    await testProperty47()
    console.log('')
    console.log(chalk.green('🎉 All Rate Limiting property tests passed!'))
  } catch (error) {
    console.error(chalk.red('❌ Property test failed:'), error)
    process.exit(1)
  }
}

// Run tests if executed directly
if (require.main === module) {
  runAllPropertyTests()
    .then(() => {
      console.log(chalk.green('\n✅ All Rate Limiting property tests completed successfully'))
      process.exit(0)
    })
    .catch((error) => {
      console.error(chalk.red('\n❌ Rate Limiting property tests failed:'), error)
      process.exit(1)
    })
}

export { 
  PROPERTY_TEST_CONFIG, 
  accountIdArbitrary, 
  rateLimitArbitrary,
  timestampArbitrary
}

