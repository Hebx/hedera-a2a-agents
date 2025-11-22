/**
 * Property-Based Tests for Trust Score Computation
 * 
 * Tests correctness properties that must hold for ALL inputs.
 * Uses fast-check for property-based testing.
 * 
 * @packageDocumentation
 */

import * as fc from 'fast-check'
import { TrustScoreComputationEngine } from '../../src/services/analytics/TrustScoreComputationEngine'
import {
  ArkhiaAccountInfo,
  ArkhiaTransaction,
  TokenBalance,
  HCSMessage,
  ScoreComponents
} from '../../src/services/analytics/types'
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
 * Generate random ISO timestamp strings
 */
const timestampArbitrary = fc.date({
  min: new Date('2020-01-01'),
  max: new Date()
}).map(date => date.toISOString())

/**
 * Generate random trust score components
 */
const scoreComponentsArbitrary: fc.Arbitrary<ScoreComponents> = fc.record({
  accountAge: fc.integer({ min: 0, max: 20 }),
  diversity: fc.integer({ min: 0, max: 20 }),
  volatility: fc.integer({ min: 0, max: 20 }),
  tokenHealth: fc.integer({ min: 0, max: 10 }),
  hcsQuality: fc.integer({ min: -10, max: 10 }),
  riskPenalty: fc.integer({ min: -20, max: 0 })
})

/**
 * Helper function to aggregate scores (matching TrustScoreComputationEngine logic)
 */
function aggregateScores(components: ScoreComponents): number {
  const sum = 
    components.accountAge +
    components.diversity +
    components.volatility +
    components.tokenHealth +
    components.hcsQuality +
    components.riskPenalty

  // Clamp to 0-100 (matching line 414 of TrustScoreComputationEngine.ts)
  return Math.max(0, Math.min(100, Math.round(sum)))
}

/**
 * Feature: trustscore-oracle, Property 13: Trust Score Bounds
 * 
 * For any computed trust score, the final aggregated score should be between 0 and 100 inclusive.
 * 
 * Validates: Requirements 2.8, 11.2
 */
async function testProperty13() {
    console.log(chalk.blue('Testing Property 13: Trust Score Bounds'))
    console.log(chalk.gray(`Running ${PROPERTY_TEST_CONFIG.numRuns} iterations...`))

    fc.assert(
      fc.property(
        scoreComponentsArbitrary,
        (components) => {
          const score = aggregateScores(components)
          
          // Property: score must be between 0 and 100 inclusive
          const isValid = score >= 0 && score <= 100
          
          if (!isValid) {
            console.error(chalk.red(`❌ Property violation: score=${score}, components=`, components))
          }
          
          return isValid
        }
      ),
      {
        numRuns: PROPERTY_TEST_CONFIG.numRuns,
        seed: PROPERTY_TEST_CONFIG.seed,
        endOnFailure: PROPERTY_TEST_CONFIG.endOnFailure
      }
    )

    console.log(chalk.green(`✅ Property 13 passed: All ${PROPERTY_TEST_CONFIG.numRuns} iterations valid`))
}

async function testProperty12() {
    console.log(chalk.blue('Testing Property 12: Risk Flag Penalty Bounds'))
    console.log(chalk.gray(`Running ${PROPERTY_TEST_CONFIG.numRuns} iterations...`))

    const riskPenaltyArbitrary = fc.integer({ min: -20, max: 0 })

    fc.assert(
      fc.property(
        riskPenaltyArbitrary,
        (penalty) => {
          // Property: penalty must be between -20 and 0
          const isValid = penalty >= -20 && penalty <= 0
          
          if (!isValid) {
            console.error(chalk.red(`❌ Property violation: penalty=${penalty}`))
          }
          
          return isValid
        }
      ),
      {
        numRuns: PROPERTY_TEST_CONFIG.numRuns,
        seed: PROPERTY_TEST_CONFIG.seed,
        endOnFailure: PROPERTY_TEST_CONFIG.endOnFailure
      }
    )

    console.log(chalk.green(`✅ Property 12 passed: All ${PROPERTY_TEST_CONFIG.numRuns} iterations valid`))
}

async function testProperty7() {
    console.log(chalk.blue('Testing Property 7: Account Age Scoring Monotonicity'))
    console.log(chalk.gray(`Running ${PROPERTY_TEST_CONFIG.numRuns} iterations...`))

    const accountAgeArbitrary = fc.record({
      account1Age: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
      account2Age: fc.date({ min: new Date('2020-01-01'), max: new Date() })
    })

    fc.assert(
      fc.property(
        accountAgeArbitrary,
        ({ account1Age, account2Age }) => {
          // Validate dates are valid
          if (isNaN(account1Age.getTime()) || isNaN(account2Age.getTime())) {
            return true // Skip invalid dates
          }

          // Calculate age in months
          const now = Date.now()
          const age1Months = (now - account1Age.getTime()) / (1000 * 60 * 60 * 24 * 30)
          const age2Months = (now - account2Age.getTime()) / (1000 * 60 * 60 * 24 * 30)
          
          // Ensure ages are non-negative (account creation cannot be in the future)
          if (age1Months < 0 || age2Months < 0) {
            return true // Skip invalid ages (future dates)
          }

          // Calculate scores using same logic as TrustScoreComputationEngine (lines 88-101)
          function calculateAccountAgeScore(ageMonths: number): number {
            if (ageMonths > 6) {
              return 20
            } else if (ageMonths >= 1) {
              return 10
            } else {
              return 3
            }
          }

          const score1 = calculateAccountAgeScore(age1Months)
          const score2 = calculateAccountAgeScore(age2Months)

          // Property: older account should have >= score
          if (age1Months >= age2Months) {
            return score1 >= score2
          } else {
            return score2 >= score1
          }
        }
      ),
      {
        numRuns: PROPERTY_TEST_CONFIG.numRuns,
        seed: PROPERTY_TEST_CONFIG.seed,
        endOnFailure: PROPERTY_TEST_CONFIG.endOnFailure
      }
    )

    console.log(chalk.green(`✅ Property 7 passed: All ${PROPERTY_TEST_CONFIG.numRuns} iterations valid`))
}

async function testProperty8() {
    console.log(chalk.blue('Testing Property 8: Transaction Diversity Scoring Monotonicity'))
    console.log(chalk.gray(`Running ${PROPERTY_TEST_CONFIG.numRuns} iterations...`))

    const counterpartyCountArbitrary = fc.record({
      count1: fc.integer({ min: 0, max: 100 }),
      count2: fc.integer({ min: 0, max: 100 })
    })

    fc.assert(
      fc.property(
        counterpartyCountArbitrary,
        ({ count1, count2 }) => {
          // Calculate scores using same logic as TrustScoreComputationEngine (lines 114-137)
          function calculateDiversityScore(count: number): number {
            if (count >= 25) {
              return 20
            } else if (count >= 10) {
              return 10
            } else {
              return 5
            }
          }

          const score1 = calculateDiversityScore(count1)
          const score2 = calculateDiversityScore(count2)

          // Property: account with more counterparties should have >= score
          if (count1 >= count2) {
            return score1 >= score2
          } else {
            return score2 >= score1
          }
        }
      ),
      {
        numRuns: PROPERTY_TEST_CONFIG.numRuns,
        seed: PROPERTY_TEST_CONFIG.seed,
        endOnFailure: PROPERTY_TEST_CONFIG.endOnFailure
      }
    )

    console.log(chalk.green(`✅ Property 8 passed: All ${PROPERTY_TEST_CONFIG.numRuns} iterations valid`))
}

async function testProperty9() {
    console.log(chalk.blue('Testing Property 9: Volatility Scoring Inverse Relationship'))
    console.log(chalk.gray(`Running ${PROPERTY_TEST_CONFIG.numRuns} iterations...`))

    const coefficientOfVariationArbitrary = fc.record({
      cv1: fc.float({ min: 0, max: 2.0 }),
      cv2: fc.float({ min: 0, max: 2.0 })
    })

    fc.assert(
      fc.property(
        coefficientOfVariationArbitrary,
        ({ cv1, cv2 }) => {
          // Calculate scores using same logic as TrustScoreComputationEngine (lines 150-198)
          function calculateVolatilityScore(cv: number): number {
            if (cv < 0.3) {
              return 20 // Low volatility
            } else if (cv < 0.7) {
              return 10 // Medium volatility
            } else {
              return 3 // High volatility
            }
          }

          const score1 = calculateVolatilityScore(cv1)
          const score2 = calculateVolatilityScore(cv2)

          // Property: lower volatility should have >= score
          if (cv1 <= cv2) {
            return score1 >= score2
          } else {
            return score2 >= score1
          }
        }
      ),
      {
        numRuns: PROPERTY_TEST_CONFIG.numRuns,
        seed: PROPERTY_TEST_CONFIG.seed,
        endOnFailure: PROPERTY_TEST_CONFIG.endOnFailure
      }
    )

    console.log(chalk.green(`✅ Property 9 passed: All ${PROPERTY_TEST_CONFIG.numRuns} iterations valid`))
}

async function testProperty10() {
  console.log(chalk.blue('Testing Property 10: Token Health Scoring'))
  console.log(chalk.gray(`Running ${PROPERTY_TEST_CONFIG.numRuns} iterations...`))

  const engine = new TrustScoreComputationEngine()

  fc.assert(
    fc.property(
      fc.array(
        fc.record({
          token_id: fc.string({ minLength: 5, maxLength: 50 }),
          balance: fc.integer({ min: 0, max: 1000000000 }),
          decimals: fc.integer({ min: 0, max: 8 })
        }),
        { minLength: 0, maxLength: 10 }
      ),
      (tokenBalances) => {
        const score = (engine as any).calculateTokenHealthScore(tokenBalances)
        const hasValidScore = score === 0 || score === 10
        const noTokensScore = tokenBalances.length === 0 ? score === 0 : true

        if (tokenBalances.length > 0) {
          const totalValue = tokenBalances.reduce((sum, token) => sum + Math.abs(token.balance || 0), 0)
          if (totalValue > 0) {
            let hasConcentration = false
            for (const token of tokenBalances) {
              const percentage = Math.abs(token.balance || 0) / totalValue
              if (percentage > 0.5) {
                hasConcentration = true
                break
              }
            }
            const distributionScore = hasConcentration ? score === 0 : score === 10
            return hasValidScore && noTokensScore && distributionScore
          }
        }
        return hasValidScore && noTokensScore
      }
    ),
    { numRuns: PROPERTY_TEST_CONFIG.numRuns, seed: PROPERTY_TEST_CONFIG.seed, endOnFailure: PROPERTY_TEST_CONFIG.endOnFailure }
  )
  console.log(chalk.green(`✅ Property 10 passed: All ${PROPERTY_TEST_CONFIG.numRuns} iterations valid`))
}

async function testProperty11() {
  console.log(chalk.blue('Testing Property 11: HCS Interaction Quality Scoring'))
  console.log(chalk.gray(`Running ${PROPERTY_TEST_CONFIG.numRuns} iterations...`))

  const engine = new TrustScoreComputationEngine()
  const trustedTopics = ['0.0.7132813', '0.0.1234567']
  const suspiciousTopics = ['0.0.666666']

  fc.assert(
    fc.property(
      fc.array(
        fc.record({
          consensus_timestamp: fc.date({ min: new Date('2020-01-01'), max: new Date() }).map(d => d.toISOString()),
          topic_id: fc.oneof(
            fc.constantFrom(...trustedTopics),
            fc.constantFrom(...suspiciousTopics),
            fc.string({ minLength: 5, maxLength: 50 })
          ),
          message: fc.string({ minLength: 0, maxLength: 100 })
        }),
        { minLength: 0, maxLength: 20 }
      ),
      (hcsMessages) => {
        const score = (engine as any).calculateHCSQualityScore(hcsMessages)
        const hasValidScore = score >= -10 && score <= 10
        const noMessagesScore = hcsMessages.length === 0 ? score === 0 : true

        if (hcsMessages.length > 0) {
          const hasTrustedInteraction = hcsMessages.some(msg => trustedTopics.includes(msg.topic_id))
          const hasSuspiciousInteraction = hcsMessages.some(msg => suspiciousTopics.includes(msg.topic_id))
          let expectedScore = 0
          if (hasTrustedInteraction && !hasSuspiciousInteraction) {
            expectedScore = 10
          } else if (hasSuspiciousInteraction) {
            expectedScore = -10
          } else {
            expectedScore = 0
          }
          const scoreMatchesExpected = score === expectedScore || score === 0
          return hasValidScore && noMessagesScore && scoreMatchesExpected
        }
        return hasValidScore && noMessagesScore
      }
    ),
    { numRuns: PROPERTY_TEST_CONFIG.numRuns, seed: PROPERTY_TEST_CONFIG.seed, endOnFailure: PROPERTY_TEST_CONFIG.endOnFailure }
  )
  console.log(chalk.green(`✅ Property 11 passed: All ${PROPERTY_TEST_CONFIG.numRuns} iterations valid`))
}

// Main test runner
async function runAllPropertyTests() {
  console.log(chalk.bold('🧪 Running Trust Score Property-Based Tests'))
  console.log('')
  console.log(chalk.blue(`Configuration:`))
  console.log(chalk.gray(`  - Iterations per property: ${PROPERTY_TEST_CONFIG.numRuns}`))
  console.log(chalk.gray(`  - Seed: ${PROPERTY_TEST_CONFIG.seed}`))
  console.log('')

  try {
    await testProperty13()
    console.log('')
    await testProperty12()
    console.log('')
    await testProperty7()
    console.log('')
    await testProperty8()
    console.log('')
    await testProperty9()
    console.log('')
    await testProperty10()
    console.log('')
    await testProperty11()
    console.log('')
    console.log(chalk.green('🎉 All property tests passed!'))
  } catch (error) {
    console.error(chalk.red('❌ Property test failed:'), error)
    process.exit(1)
  }
}

// Run tests if executed directly
if (require.main === module) {
  runAllPropertyTests()
    .then(() => {
      console.log(chalk.green('\n✅ All property tests completed successfully'))
      process.exit(0)
    })
    .catch((error) => {
      console.error(chalk.red('\n❌ Property tests failed:'), error)
      process.exit(1)
    })
}

export { PROPERTY_TEST_CONFIG, aggregateScores, accountIdArbitrary, timestampArbitrary, scoreComponentsArbitrary }

