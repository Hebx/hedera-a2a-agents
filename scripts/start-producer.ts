/**
 * Start Producer Agent Server
 * 
 * Starts the TrustScore Producer Agent API server
 * This must be running before using the CLI
 * 
 * @packageDocumentation
 */

import { TrustScoreProducerAgent } from '../src/agents/TrustScoreProducerAgent'
import { loadEnvIfNeeded } from '../src/utils/env'
import chalk from 'chalk'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()
loadEnvIfNeeded()

async function startProducer(): Promise<void> {
  try {
    console.log(chalk.bold('🚀 Starting TrustScore Producer Agent'))
    console.log(chalk.gray('API server will be available at http://localhost:3001'))
    console.log('')

    const producer = new TrustScoreProducerAgent()
    await producer.init()

    console.log('')
    console.log(chalk.bold.green('✅ Producer Agent is running!'))
    console.log(chalk.blue('📡 API Endpoint: http://localhost:3001/trustscore/:accountId'))
    console.log(chalk.blue('💚 Health Check: http://localhost:3001/health'))
    console.log('')
    console.log(chalk.yellow('⚠️  Keep this process running to use the CLI'))
    console.log(chalk.gray('Press Ctrl+C to stop'))
    console.log('')

    // Keep process alive
    process.on('SIGINT', async () => {
      console.log('')
      console.log(chalk.yellow('🛑 Shutting down Producer Agent...'))
      if (producer && typeof (producer as any).shutdown === 'function') {
        await (producer as any).shutdown()
      }
      process.exit(0)
    })

  } catch (error) {
    console.error(chalk.red('❌ Failed to start Producer Agent:'), error)
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  startProducer()
}

export { startProducer }

