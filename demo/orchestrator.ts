import { AnalyzerAgent } from '../src/agents/AnalyzerAgent'
import { VerifierAgent } from '../src/agents/VerifierAgent'
import { SettlementAgent } from '../src/agents/SettlementAgent'
import chalk from 'chalk'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

// Constants - npm run demo -- passes args differently
const DEMO_ACCOUNT = process.argv[2] || '0.0.123456'
const THRESHOLD_HBAR = parseInt(process.argv[3] || '50') || 50

// Helper function for sleep
const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main(): Promise<void> {
  try {
    // Print banner
    console.log(chalk.bold('🤖 Hedera A2A Agent System Demo'))
    console.log(chalk.gray('Query account data and trigger agent coordination workflow'))
    console.log('')

    // Initialize agents
    console.log(chalk.bold('--- Initializing Agents ---'))
    const analyzer = new AnalyzerAgent()
    const verifier = new VerifierAgent()
    const settlement = new SettlementAgent()

    // Call init() on all 3 agents
    await analyzer.init()
    await verifier.init()
    await settlement.init()

    console.log(chalk.green('✓ All agents ready'))
    console.log('')

    // Execute workflow
    console.log(chalk.bold('--- Workflow Starting ---'))
    
    // Query account data
    const accountData = await analyzer.queryAccount(DEMO_ACCOUNT)
    
    // Propose insight (this would normally be a method on AnalyzerAgent)
    console.log(chalk.blue('📊 AnalyzerAgent proposing insight...'))
    console.log(`Account: ${accountData.accountId}`)
    console.log(`Balance: ${accountData.balance}`)
    console.log(`Threshold: ${THRESHOLD_HBAR} HBAR`)
    
    // Simulate proposing insight (since proposeInsight method doesn't exist yet)
    // accountData.balance is already in HBAR format, so compare directly
    const balanceInHBAR = parseFloat(accountData.balance.replace(' ℏ', ''))
    const meetsThreshold = balanceInHBAR >= THRESHOLD_HBAR
    console.log(chalk.blue(`✓ Proposal: ${meetsThreshold ? 'Meets' : 'Does not meet'} threshold`))
    
    console.log(chalk.gray('⏳ Waiting for agent coordination...'))
    await sleep(8000) // 8 seconds for A2A messages

    // Print final summary
    console.log(chalk.bold('--- Workflow Complete ---'))
    console.log(chalk.gray('📡 Monitor agent communication:'))
    console.log(chalk.gray(`   HashScan Topic: https://hashscan.io/testnet/topic/${process.env.ANALYZER_TOPIC_ID || 'ANALYZER_TOPIC_ID'}`))
    console.log(chalk.gray('   BaseScan: https://sepolia.basescan.org'))
    console.log('')

    // Exit cleanly
    process.exit(0)
  } catch (error) {
    console.error(chalk.red('❌ Demo failed:'), error)
    process.exit(1)
  }
}

// Run the demo
main()
