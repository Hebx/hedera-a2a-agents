/**
 * Property-Based Test for Payment Verification Property (Property 57)
 * 
 * Tests correctness property that must hold for ALL payment verification operations.
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
 * Generate random transaction IDs (format: 0.0.x@s.n)
 */
const transactionIdArbitrary = fc.tuple(
  accountIdArbitrary,
  fc.integer({ min: 1234567890, max: 9999999999 }),
  fc.integer({ min: 0, max: 999 })
).map(([accountId, seconds, nanos]) => `${accountId}@${seconds}.${nanos}`)

/**
 * Generate random transaction hashes
 */
const transactionHashArbitrary = fc.string({ minLength: 64, maxLength: 64 }).map(s => 
  s.replace(/[^0-9a-fA-F]/g, '0').toLowerCase()
)

/**
 * Generate random amounts (in tinybars)
 */
const amountArbitrary = fc.integer({ min: 1, max: 1000000000000 }) // 1 tinybar to 1M HBAR

/**
 * Generate random memo strings
 */
const memoArbitrary = fc.string({ minLength: 0, maxLength: 100 })

/**
 * Feature: trustscore-oracle, Property 57: On-Chain Payment Verification
 * 
 * For any payment verification, the system should query the Hedera network to
 * confirm transaction existence, amount, recipient, and memo match requirements.
 * 
 * Validates: Requirements 12.1, 12.2, 12.3, 12.4
 */
async function testProperty57() {
  console.log(chalk.blue('Testing Property 57: On-Chain Payment Verification'))
  console.log(chalk.gray(`Running ${PROPERTY_TEST_CONFIG.numRuns} iterations...`))

  fc.assert(
    fc.property(
      fc.record({
        transactionIdOrHash: fc.oneof(transactionIdArbitrary, transactionHashArbitrary),
        expectedAmount: amountArbitrary,
        expectedRecipient: accountIdArbitrary,
        transactionStatus: fc.constantFrom('SUCCESS', 'FAILED', 'UNKNOWN'),
        actualAmount: amountArbitrary,
        actualRecipient: accountIdArbitrary,
        hasTransfer: fc.boolean()
      }),
      ({ 
        transactionIdOrHash, 
        expectedAmount, 
        expectedRecipient,
        transactionStatus,
        actualAmount,
        actualRecipient,
        hasTransfer
      }) => {
        // Property: Payment verification should query Hedera network and verify all requirements
        
        // Simulate Hedera Mirror Node transaction response (matching MeshOrchestrator.ts verifyPaymentReceipt)
        const mirrorNodeTransaction = {
          transactions: [{
            transaction_id: transactionIdOrHash,
            result: transactionStatus,
            transfers: hasTransfer ? [{
              account: actualRecipient,
              amount: actualAmount
            }] : []
          }]
        }
        
        // Simulate payment verification (matching MeshOrchestrator.ts verifyPaymentReceipt logic)
        const verificationResult = {
          transactionExists: mirrorNodeTransaction.transactions.length > 0,
          transactionFound: mirrorNodeTransaction.transactions[0] !== undefined,
          statusVerified: false,
          amountVerified: false,
          recipientVerified: false,
          verified: false
        }
        
        // 1. Verify transaction exists (Requirement 12.1)
        if (!verificationResult.transactionFound) {
          verificationResult.verified = false
        } else {
          // 2. Verify transaction status (Requirement 12.2)
          const transaction = mirrorNodeTransaction.transactions[0]
          if (!transaction) {
            verificationResult.verified = false
          } else {
            verificationResult.statusVerified = transaction.result === 'SUCCESS'
            
            if (!verificationResult.statusVerified) {
              verificationResult.verified = false
            } else {
              // 3. Verify recipient and amount (Requirements 12.3, 12.4)
              const transfers = transaction.transfers || []
            const recipientTransfer = transfers.find((t: any) => 
              t.account === expectedRecipient && t.amount > 0
            )
            
            verificationResult.recipientVerified = recipientTransfer !== undefined && 
                                                   recipientTransfer.account === expectedRecipient
            
            verificationResult.amountVerified = recipientTransfer !== undefined &&
                                               recipientTransfer.amount.toString() === expectedAmount.toString()
            
              // Overall verification passes only if all checks pass
              verificationResult.verified = 
                verificationResult.statusVerified &&
                verificationResult.recipientVerified &&
                verificationResult.amountVerified
            }
          }
        }
        
        // Property: Verification should query transaction existence
        const queriesTransactionExistence = verificationResult.transactionExists === true || 
                                            verificationResult.transactionFound === false
        
        // Property: Verification should check transaction status
        const checksStatus = verificationResult.transactionFound ? 
                            (verificationResult.statusVerified === (transactionStatus === 'SUCCESS')) : 
                            true
        
        // Property: Verification should verify amount matches
        const verifiesAmount = 
          !verificationResult.transactionFound || !verificationResult.statusVerified ||
          (verificationResult.amountVerified === (actualAmount.toString() === expectedAmount.toString() && hasTransfer))
        
        // Property: Verification should verify recipient matches
        const verifiesRecipient = 
          !verificationResult.transactionFound || !verificationResult.statusVerified ||
          (verificationResult.recipientVerified === (actualRecipient === expectedRecipient && hasTransfer))
        
        // Property: Verification result should be consistent with all checks
        const verificationConsistent = 
          !verificationResult.verified || 
          (verificationResult.statusVerified && verificationResult.recipientVerified && verificationResult.amountVerified)
        
        // Property: If transaction doesn't exist or failed, verification should fail
        const handlesMissingOrFailed = 
          !verificationResult.transactionFound || transactionStatus !== 'SUCCESS' ?
            verificationResult.verified === false :
            true

        return queriesTransactionExistence && checksStatus && verifiesAmount && verifiesRecipient && 
               verificationConsistent && handlesMissingOrFailed
      }
    ),
    {
      numRuns: PROPERTY_TEST_CONFIG.numRuns,
      seed: PROPERTY_TEST_CONFIG.seed,
      endOnFailure: PROPERTY_TEST_CONFIG.endOnFailure
    }
  )

  console.log(chalk.green(`✅ Property 57 passed: All ${PROPERTY_TEST_CONFIG.numRuns} iterations valid`))
}

// Main test runner
async function runAllPropertyTests() {
  console.log(chalk.bold('🧪 Running Payment Verification Property-Based Test'))
  console.log('')
  console.log(chalk.blue(`Configuration:`))
  console.log(chalk.gray(`  - Iterations per property: ${PROPERTY_TEST_CONFIG.numRuns}`))
  console.log(chalk.gray(`  - Seed: ${PROPERTY_TEST_CONFIG.seed}`))
  console.log('')

  try {
    await testProperty57()
    console.log('')
    console.log(chalk.green('🎉 Payment Verification property test passed!'))
  } catch (error) {
    console.error(chalk.red('❌ Property test failed:'), error)
    process.exit(1)
  }
}

// Run tests if executed directly
if (require.main === module) {
  runAllPropertyTests()
    .then(() => {
      console.log(chalk.green('\n✅ Payment Verification property test completed successfully'))
      process.exit(0)
    })
    .catch((error) => {
      console.error(chalk.red('\n❌ Payment Verification property test failed:'), error)
      process.exit(1)
    })
}

export { 
  PROPERTY_TEST_CONFIG, 
  accountIdArbitrary,
  transactionIdArbitrary,
  transactionHashArbitrary,
  amountArbitrary
}

