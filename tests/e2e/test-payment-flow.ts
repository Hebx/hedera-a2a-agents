import { AnalyzerAgent } from './src/agents/AnalyzerAgent'
import { VerifierAgent } from './src/agents/VerifierAgent'
import { SettlementAgent } from './src/agents/SettlementAgent'
import chalk from 'chalk'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

// Helper function for sleep
const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function testCompletePaymentFlow(): Promise<void> {
  try {
    console.log(chalk.bold('🚀 Testing Complete Payment Flow'))
    console.log(chalk.gray('This will trigger a real x402 payment on Base Sepolia'))
    console.log('')

    // Initialize agents
    console.log(chalk.bold('--- Initializing Agents ---'))
    const analyzer = new AnalyzerAgent()
    const verifier = new VerifierAgent()
    const settlement = new SettlementAgent()

    await analyzer.init()
    await verifier.init()
    await settlement.init()

    console.log(chalk.green('✓ All agents ready'))
    console.log('')

    // Query account data
    console.log(chalk.bold('--- Account Analysis ---'))
    const accountData = await analyzer.queryAccount('0.0.123456')
    
    console.log(chalk.blue('📊 Account Analysis Complete'))
    console.log(`Account: ${accountData.accountId}`)
    console.log(`Balance: ${accountData.balance}`)
    
    // Create a real proposal that will trigger the payment flow
    const proposal = {
      type: 'analysis_proposal',
      accountId: accountData.accountId,
      balance: accountData.balance,
      threshold: 50,
      meetsThreshold: true, // This will trigger approval
      timestamp: Date.now(),
      analysisData: accountData
    }

    console.log(chalk.bold('--- Sending Proposal to VerifierAgent ---'))
    console.log(chalk.yellow('📤 Sending analysis proposal...'))
    
    // Send proposal to VerifierAgent via HCS
    const verifierTopicId = process.env.VERIFIER_TOPIC_ID
    if (!verifierTopicId) {
      throw new Error('Missing VERIFIER_TOPIC_ID')
    }

    // We need to use the analyzer's HCS client to send the message
    // Let's create a simple HCS client for this test
    const { HCS10Client } = await import('@hashgraphonline/standards-agent-kit')
    const hcsClient = new HCS10Client(
      process.env.HEDERA_ACCOUNT_ID!,
      process.env.HEDERA_PRIVATE_KEY!,
      'testnet'
    )

    await hcsClient.sendMessage(verifierTopicId, JSON.stringify(proposal))
    console.log(chalk.green('✓ Proposal sent to VerifierAgent'))
    console.log(`📡 Topic: ${verifierTopicId}`)

    console.log(chalk.bold('--- Waiting for Agent Processing ---'))
    console.log(chalk.yellow('⏳ Waiting for verification and settlement...'))
    
    // Wait for the agents to process the message
    await sleep(15000) // 15 seconds for processing

    console.log(chalk.bold('--- Payment Flow Complete ---'))
    console.log(chalk.green('✅ Check the following for transaction details:'))
    console.log(chalk.blue('📡 HashScan Topics:'))
    console.log(`   Verifier: https://hashscan.io/testnet/topic/${verifierTopicId}`)
    console.log(`   Settlement: https://hashscan.io/testnet/topic/${process.env.SETTLEMENT_TOPIC_ID}`)
    console.log(chalk.blue('🌐 BaseScan (for x402 payment):'))
    console.log('   https://sepolia.basescan.org')
    console.log(chalk.blue('💰 Settlement Wallet:'))
    console.log(`   ${process.env.SETTLEMENT_WALLET_PRIVATE_KEY?.substring(0, 10)}...`)
    console.log(chalk.blue('🏪 Merchant Wallet:'))
    console.log(`   ${process.env.MERCHANT_WALLET_ADDRESS}`)

  } catch (error) {
    console.error(chalk.red('❌ Payment flow test failed:'), error)
    throw error
  }
}

// Run the test
testCompletePaymentFlow()
  .then(() => {
    console.log(chalk.green('\n🎉 Payment flow test completed!'))
    process.exit(0)
  })
  .catch((error) => {
    console.error(chalk.red('\n💥 Payment flow test failed:'), error)
    process.exit(1)
  })
