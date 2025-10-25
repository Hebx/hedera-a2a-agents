import { SettlementAgent } from './src/agents/SettlementAgent.js'
import chalk from 'chalk'

async function testSettlementAgent() {
  try {
    console.log(chalk.blue('🚀 Testing SettlementAgent...'))
    
    // Create SettlementAgent instance
    const settlementAgent = new SettlementAgent()
    
    // Initialize the agent
    await settlementAgent.init()
    
    console.log(chalk.green('✅ SettlementAgent initialized successfully'))
    console.log(chalk.yellow('📡 Agent is now listening for verification results...'))
    
    // Keep the process running to listen for messages
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\n🛑 Shutting down SettlementAgent...'))
      process.exit(0)
    })
    
  } catch (error) {
    console.error(chalk.red('❌ Failed to test SettlementAgent:'), error)
    process.exit(1)
  }
}

// Run the test
testSettlementAgent()
