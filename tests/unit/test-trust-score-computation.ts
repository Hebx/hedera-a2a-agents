/**
 * Unit tests for TrustScoreComputationEngine
 * 
 * Tests all scoring components and aggregation logic.
 */

import { TrustScoreComputationEngine } from '../../src/services/analytics/TrustScoreComputationEngine'
import {
  ArkhiaAccountInfo,
  ArkhiaTransaction,
  TokenBalance,
  HCSMessage
} from '../../src/services/analytics/types'
import chalk from 'chalk'

describe('TrustScoreComputationEngine', () => {
  let engine: TrustScoreComputationEngine

  beforeEach(() => {
    engine = new TrustScoreComputationEngine()
  })

  describe('computeScore', () => {
    it('should compute score for a mature account with good activity', async () => {
      const accountInfo: ArkhiaAccountInfo = {
        account: '0.0.123456',
        balance: {
          balance: 100000, // 0.001 HBAR (tiny balance for testing)
          timestamp: '2024-12-01T00:00:00Z'
        },
        created_timestamp: '2024-01-01T00:00:00Z', // 11 months old
        key: {
          _type: 'ED25519',
          key: 'test-key'
        },
        auto_renew_period: 2592000,
        deleted: false,
        ethereum_nonce: 0,
        evm_address: '0x1234567890123456789012345678901234567890'
      }

      // Create transactions with many unique counterparties
      const transactions: ArkhiaTransaction[] = []
      for (let i = 0; i < 30; i++) {
        transactions.push({
          transaction_id: `tx-${i}`,
          consensus_timestamp: new Date(Date.now() - i * 86400000).toISOString(),
          type: 'CRYPTOTRANSFER',
          result: 'SUCCESS',
          transfers: [
            { account: `0.0.${100000 + i}`, amount: 1000, is_approval: false }, // 0.000001 HBAR
            { account: '0.0.123456', amount: -1000, is_approval: false }
          ],
          token_transfers: [],
          memo_base64: ''
        })
      }

      const tokenBalances: TokenBalance[] = [
        { token_id: '0.0.100', balance: 5000, decimals: 8 }, // Small token amounts
        { token_id: '0.0.200', balance: 5000, decimals: 8 }
      ]

      const hcsMessages: HCSMessage[] = [
        {
          topic_id: '0.0.1000',
          consensus_timestamp: '2024-12-01T00:00:00Z',
          message: 'trusted message',
          running_hash: 'hash1',
          sequence_number: 1
        }
      ]

      const result = await engine.computeScore(accountInfo, transactions, tokenBalances, hcsMessages)

      expect(result.account).toBe('0.0.123456')
      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.score).toBeLessThanOrEqual(100)
      expect(result.components.accountAge).toBe(20) // >6 months
      expect(result.components.diversity).toBe(20) // >=25 unique accounts
      expect(result.components.tokenHealth).toBe(10) // Healthy distribution
      expect(result.components.hcsQuality).toBe(10) // Trusted patterns
    })

    it('should compute score for a new account', async () => {
      const accountInfo: ArkhiaAccountInfo = {
        account: '0.0.999999',
        balance: {
          balance: 50000, // 0.0005 HBAR (tiny balance for testing)
          timestamp: '2024-12-01T00:00:00Z'
        },
        created_timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days old
        key: {
          _type: 'ED25519',
          key: 'test-key'
        },
        auto_renew_period: 2592000,
        deleted: false,
        ethereum_nonce: 0,
        evm_address: '0x1234567890123456789012345678901234567890'
      }

      const transactions: ArkhiaTransaction[] = [
        {
          transaction_id: 'tx-1',
          consensus_timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          type: 'CRYPTOTRANSFER',
          result: 'SUCCESS',
          transfers: [
            { account: '0.0.100000', amount: 20000, is_approval: false }, // 0.0002 HBAR (small but detectable)
            { account: '0.0.999999', amount: -20000, is_approval: false }
          ],
          token_transfers: [],
          memo_base64: ''
        }
      ]

      const tokenBalances: TokenBalance[] = []
      const hcsMessages: HCSMessage[] = []

      const result = await engine.computeScore(accountInfo, transactions, tokenBalances, hcsMessages)

      expect(result.account).toBe('0.0.999999')
      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.score).toBeLessThanOrEqual(100)
      expect(result.components.accountAge).toBe(3) // <1 month
      expect(result.riskFlags.length).toBeGreaterThan(0) // Should detect new account with large transfer
    })

    it('should always return score between 0 and 100', async () => {
      const accountInfo: ArkhiaAccountInfo = {
        account: '0.0.111111',
        balance: { balance: 0, timestamp: '2024-12-01T00:00:00Z' },
        created_timestamp: '2024-12-01T00:00:00Z',
        key: { _type: 'ED25519', key: 'test-key' },
        auto_renew_period: 2592000,
        deleted: false,
        ethereum_nonce: 0,
        evm_address: '0x1234567890123456789012345678901234567890'
      }

      const result = await engine.computeScore(accountInfo, [], [], [])

      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.score).toBeLessThanOrEqual(100)
    })
  })
})

// Run tests if executed directly
if (require.main === module) {
  console.log(chalk.blue('Running TrustScoreComputationEngine unit tests...'))
  console.log(chalk.yellow('⚠️  Tests require Jest configuration. Run with: npm test'))
}

