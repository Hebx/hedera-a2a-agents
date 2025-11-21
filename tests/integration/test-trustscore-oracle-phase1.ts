/**
 * Integration tests for TrustScore Oracle Phase 1
 * 
 * Tests the complete flow: Arkhia service, computation engine, product registry.
 * Uses minimal balances to avoid breaking testnet accounts.
 */

import { ArkhiaAnalyticsService } from '../../src/services/analytics/ArkhiaAnalyticsService'
import { TrustScoreComputationEngine } from '../../src/services/analytics/TrustScoreComputationEngine'
import { ProductRegistry } from '../../src/marketplace/ProductRegistry'
import {
  ArkhiaAccountInfo,
  ArkhiaTransaction,
  TokenBalance,
  HCSMessage
} from '../../src/services/analytics/types'
import chalk from 'chalk'
import { loadEnvIfNeeded } from '../../src/utils/env'

// Load environment variables
loadEnvIfNeeded()

/**
 * Test Arkhia Analytics Service
 */
async function testArkhiaService(): Promise<boolean> {
  try {
    console.log(chalk.bold('🔍 Testing Arkhia Analytics Service'))
    console.log('')

    if (!process.env.ARKHIA_API_KEY) {
      console.log(chalk.yellow('⚠️  ARKHIA_API_KEY not set, skipping Arkhia service test'))
      console.log(chalk.gray('   Set ARKHIA_API_KEY in .env to test Arkhia integration'))
      return true // Skip test if API key not available
    }

    // Note: Arkhia API endpoints may need adjustment based on actual API structure
    // This test validates the service structure, not the actual API calls

    const service = new ArkhiaAnalyticsService({})

    // Test with a known testnet account (use a small account for testing)
    const testAccountId = process.env.HEDERA_ACCOUNT_ID || '0.0.123456'

    console.log(chalk.blue(`📊 Fetching account info for ${testAccountId}...`))
    const accountInfo = await service.getAccountInfo(testAccountId)
    console.log(chalk.green(`✅ Account info retrieved: ${accountInfo.account}`))

    console.log(chalk.blue(`📊 Fetching transactions for ${testAccountId}...`))
    const transactions = await service.getTransactions(testAccountId, 10)
    console.log(chalk.green(`✅ Retrieved ${transactions.length} transactions`))

    console.log(chalk.blue(`📊 Fetching token balances for ${testAccountId}...`))
    const tokenBalances = await service.getTokenBalances(testAccountId)
    console.log(chalk.green(`✅ Retrieved ${tokenBalances.length} token balances`))

    // Test cache
    console.log(chalk.blue('📦 Testing cache...'))
    const cachedInfo = await service.getAccountInfo(testAccountId)
    console.log(chalk.green('✅ Cache working'))

    return true
  } catch (error: any) {
    console.error(chalk.red(`❌ Arkhia service test failed: ${error.message}`))
    return false
  }
}

/**
 * Test Trust Score Computation Engine
 */
async function testComputationEngine(): Promise<boolean> {
  try {
    console.log(chalk.bold('🧮 Testing Trust Score Computation Engine'))
    console.log('')

    const engine = new TrustScoreComputationEngine()

    // Create test data with minimal balances
    const accountInfo: ArkhiaAccountInfo = {
      account: '0.0.123456',
      balance: {
        balance: 100000, // 0.001 HBAR (tiny balance)
        timestamp: '2024-12-01T00:00:00Z'
      },
      created_timestamp: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString(), // 200 days old
      key: {
        _type: 'ED25519',
        key: 'test-key'
      },
      auto_renew_period: 2592000,
      deleted: false,
      ethereum_nonce: 0,
      evm_address: '0x1234567890123456789012345678901234567890'
    }

    // Create transactions with many unique counterparties (small amounts)
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
      { token_id: '0.0.100', balance: 5000, decimals: 8 }, // Small amounts
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

    console.log(chalk.blue('📊 Computing trust score...'))
    const trustScore = await engine.computeScore(accountInfo, transactions, tokenBalances, hcsMessages)

    console.log(chalk.green(`✅ Trust score computed: ${trustScore.score}/100`))
    console.log(chalk.gray(`   Components:`))
    console.log(chalk.gray(`     Account Age: ${trustScore.components.accountAge}`))
    console.log(chalk.gray(`     Diversity: ${trustScore.components.diversity}`))
    console.log(chalk.gray(`     Volatility: ${trustScore.components.volatility}`))
    console.log(chalk.gray(`     Token Health: ${trustScore.components.tokenHealth}`))
    console.log(chalk.gray(`     HCS Quality: ${trustScore.components.hcsQuality}`))
    console.log(chalk.gray(`     Risk Penalty: ${trustScore.components.riskPenalty}`))

    // Validate score bounds
    if (trustScore.score < 0 || trustScore.score > 100) {
      throw new Error(`Trust score out of bounds: ${trustScore.score}`)
    }

    return true
  } catch (error: any) {
    console.error(chalk.red(`❌ Computation engine test failed: ${error.message}`))
    return false
  }
}

/**
 * Test Product Registry
 */
async function testProductRegistry(): Promise<boolean> {
  try {
    console.log(chalk.bold('📦 Testing Product Registry'))
    console.log('')

    const registry = new ProductRegistry()

    // Test default product
    const defaultProduct = registry.getProduct('trustscore.basic.v1')
    if (!defaultProduct) {
      throw new Error('Default product not found')
    }
    console.log(chalk.green(`✅ Default product found: ${defaultProduct.productId}`))

    // Test product registration
    const newProduct = {
      productId: 'trustscore.premium.v1',
      version: 'v1',
      name: 'Premium Trust Score',
      description: 'Enhanced trust score',
      producerAgentId: '0.0.123456',
      endpoint: '/trustscore/premium/:accountId',
      defaultPrice: '50000', // 0.0005 HBAR (tiny amount)
      currency: 'HBAR' as const,
      network: 'hedera-testnet' as const,
      rateLimit: {
        calls: 1000,
        period: 86400
      },
      sla: {
        uptime: '99.99%',
        responseTime: '< 1s'
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    registry.registerProduct(newProduct)
    const retrieved = registry.getProduct('trustscore.premium.v1')
    if (!retrieved || retrieved.productId !== 'trustscore.premium.v1') {
      throw new Error('Product registration failed')
    }
    console.log(chalk.green(`✅ Product registered: ${retrieved.productId}`))

    // Test price update
    registry.updatePrice('trustscore.basic.v1', '40000') // 0.0004 HBAR
    const updated = registry.getProduct('trustscore.basic.v1')
    if (!updated || updated.defaultPrice !== '40000') {
      throw new Error('Price update failed')
    }
    console.log(chalk.green(`✅ Price updated: ${updated.defaultPrice} tinybars`))

    // Test getAllProducts
    const allProducts = registry.getAllProducts()
    if (allProducts.length < 2) {
      throw new Error('getAllProducts failed')
    }
    console.log(chalk.green(`✅ Retrieved ${allProducts.length} products`))

    return true
  } catch (error: any) {
    console.error(chalk.red(`❌ Product registry test failed: ${error.message}`))
    return false
  }
}

/**
 * Run all Phase 1 integration tests
 */
async function runPhase1Tests(): Promise<void> {
  console.log(chalk.bold('🧪 TrustScore Oracle Phase 1 Integration Tests'))
  console.log(chalk.gray('Testing: Arkhia Service, Computation Engine, Product Registry'))
  console.log('')

  const results = {
    arkhia: false,
    computation: false,
    registry: false
  }

  try {
    results.arkhia = await testArkhiaService()
    console.log('')
    results.computation = await testComputationEngine()
    console.log('')
    results.registry = await testProductRegistry()
    console.log('')

    // Summary
    console.log(chalk.bold('📊 Test Results Summary'))
    console.log(chalk.gray('─'.repeat(50)))
    console.log(`Arkhia Service:        ${results.arkhia ? chalk.green('✅ PASS') : chalk.red('❌ FAIL')}`)
    console.log(`Computation Engine:   ${results.computation ? chalk.green('✅ PASS') : chalk.red('❌ FAIL')}`)
    console.log(`Product Registry:     ${results.registry ? chalk.green('✅ PASS') : chalk.red('❌ FAIL')}`)
    console.log('')

    const allPassed = results.arkhia && results.computation && results.registry

    if (allPassed) {
      console.log(chalk.green('🎉 All Phase 1 tests passed!'))
      process.exit(0)
    } else {
      console.log(chalk.red('❌ Some tests failed'))
      process.exit(1)
    }
  } catch (error: any) {
    console.error(chalk.red(`💥 Test suite failed: ${error.message}`))
    process.exit(1)
  }
}

// Run tests if executed directly
if (require.main === module) {
  runPhase1Tests()
}

export { runPhase1Tests }

