#!/usr/bin/env node
/**
 * TrustScore Oracle CLI
 * 
 * Command-line tool to request trust scores for Hedera accounts.
 * Supports both direct account ID input and natural language prompts via LLM.
 * 
 * Usage:
 *   npm run trustscore <account-id>
 *   npm run trustscore "give me trust score of 0.0.1234567"
 * 
 * @packageDocumentation
 */

import { TrustScoreConsumerAgent } from '../src/agents/TrustScoreConsumerAgent'
import { loadEnvIfNeeded } from '../src/utils/env'
import { ChatOpenAI } from '@langchain/openai'
import chalk from 'chalk'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()
loadEnvIfNeeded()

/**
 * Extract account ID from natural language prompt using LLM
 */
async function extractAccountIdFromPrompt(prompt: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY
  
  if (!apiKey) {
    console.log(chalk.yellow('⚠️  No OpenAI API key found - skipping LLM reasoning'))
    return null
  }

  try {
    console.log(chalk.blue('🤖 Using LLM to understand your request...'))
    
    const llm = new ChatOpenAI({
      model: 'gpt-4o-mini',
      temperature: 0.1,
      maxTokens: 100
    })

    const systemPrompt = `You are a helpful assistant that extracts Hedera account IDs from user prompts.
A Hedera account ID has the format: 0.0.xxxxx where x is a digit.

Examples:
- "give me trust score of 0.0.1234567" → 0.0.1234567
- "what's the trust score for account 0.0.4567890" → 0.0.4567890
- "check trust score 0.0.7890123" → 0.0.7890123

If you find a valid Hedera account ID in the prompt, return ONLY the account ID.
If no valid account ID is found, return "NOT_FOUND".`

    const response = await llm.invoke([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ])

    const accountId = (response.content as string).trim()
    
    // Validate format
    if (accountId.match(/^0\.0\.\d+$/)) {
      console.log(chalk.green(`✅ Extracted account ID: ${accountId}`))
      return accountId
    } else {
      console.log(chalk.yellow(`⚠️  LLM couldn't extract a valid account ID from: "${prompt}"`))
      return null
    }
  } catch (error) {
    console.error(chalk.red('❌ LLM error:'), error)
    return null
  }
}

/**
 * Validate account ID format
 */
function isValidAccountId(accountId: string): boolean {
  return /^0\.0\.\d+$/.test(accountId)
}

/**
 * Request trust score for an account
 */
async function requestTrustScore(accountId: string, producerEndpoint: string = 'http://localhost:3001'): Promise<void> {
  try {
    console.log(chalk.bold('\n🚀 TrustScore Oracle CLI'))
    console.log(chalk.gray('Requesting trust score via Consumer Agent workflow'))
    console.log('')

    // Validate account ID
    if (!isValidAccountId(accountId)) {
      throw new Error(`Invalid account ID format: ${accountId}. Expected format: 0.0.xxxxx`)
    }

    console.log(chalk.blue(`📊 Requesting trust score for account: ${accountId}`))
    console.log(chalk.blue(`🔗 Producer endpoint: ${producerEndpoint}`))
    console.log('')

    // Initialize Consumer Agent (constructor initializes facilitator and productRegistry internally)
    const consumerAgentId = process.env.CONSUMER_AGENT_ID || process.env.HEDERA_ACCOUNT_ID
    if (!consumerAgentId) {
      throw new Error('Missing CONSUMER_AGENT_ID or HEDERA_ACCOUNT_ID environment variable')
    }

    console.log(chalk.blue('🔧 Initializing Consumer Agent...'))
    console.log(chalk.gray(`   Agent ID: ${consumerAgentId}`))
    const consumer = new TrustScoreConsumerAgent()
    await consumer.init()
    console.log(chalk.green('✅ Consumer Agent initialized'))
    console.log('')

    // Request trust score
    console.log(chalk.bold('📡 Requesting Trust Score...'))
    console.log(chalk.gray('Flow: Consumer → AP2 Negotiation → x402 Payment → Producer → Trust Score'))
    console.log('')

    const trustScore = await consumer.requestTrustScore(
      accountId,
      'trustscore.basic.v1',
      producerEndpoint
    )

    if (!trustScore) {
      throw new Error('Failed to retrieve trust score')
    }

    // Display results
    console.log('')
    console.log(chalk.bold('═══════════════════════════════════════════════════'))
    console.log(chalk.bold('📊 TRUST SCORE RESULTS'))
    console.log(chalk.bold('═══════════════════════════════════════════════════'))
    console.log('')
    console.log(chalk.blue('Account ID:'), chalk.white(trustScore.account))
    console.log(chalk.blue('Overall Score:'), chalk.bold.green(`${trustScore.score}/100`))
    console.log('')

    console.log(chalk.bold('Score Components:'))
    console.log(chalk.gray('───────────────────────────────────────────────────'))
    console.log(chalk.cyan('  Account Age:'), chalk.white(`${trustScore.components.accountAge} points`))
    console.log(chalk.cyan('  Diversity:'), chalk.white(`${trustScore.components.diversity} points`))
    console.log(chalk.cyan('  Volatility:'), chalk.white(`${trustScore.components.volatility} points`))
    console.log(chalk.cyan('  Token Health:'), chalk.white(`${trustScore.components.tokenHealth} points`))
    console.log(chalk.cyan('  HCS Quality:'), chalk.white(`${trustScore.components.hcsQuality} points`))
    console.log(chalk.cyan('  Risk Penalty:'), chalk.white(`${trustScore.components.riskPenalty} points`))
    console.log('')

    if (trustScore.riskFlags && trustScore.riskFlags.length > 0) {
      console.log(chalk.bold.red('⚠️  Risk Flags Detected:'))
      trustScore.riskFlags.forEach((flag, index) => {
        console.log(chalk.red(`  ${index + 1}. ${flag.type}: ${flag.description}`))
      })
      console.log('')
    } else {
      console.log(chalk.bold.green('✅ No risk flags detected'))
      console.log('')
    }

    console.log(chalk.blue('Computed At:'), chalk.white(new Date(trustScore.timestamp).toISOString()))
    console.log(chalk.bold('═══════════════════════════════════════════════════'))
    console.log('')

  } catch (error: any) {
    console.error('')
    console.error(chalk.red('❌ Error requesting trust score:'))
    console.error(chalk.red(error.message || error))
    if (error.stack) {
      console.error(chalk.gray(error.stack))
    }
    process.exit(1)
  }
}

/**
 * Main CLI entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.log(chalk.bold('📊 TrustScore Oracle CLI'))
    console.log('')
    console.log(chalk.bold('Usage:'))
    console.log(chalk.cyan('  npm run trustscore <account-id>'))
    console.log(chalk.cyan('  npm run trustscore "give me trust score of 0.0.1234567"'))
    console.log('')
    console.log(chalk.bold('Examples:'))
    console.log(chalk.gray('  npm run trustscore 0.0.1234567'))
    console.log(chalk.gray('  npm run trustscore "what is the trust score for account 0.0.4567890"'))
    console.log(chalk.gray('  npm run trustscore "check trust score 0.0.7890123"'))
    console.log('')
    console.log(chalk.bold('Environment Variables:'))
    console.log(chalk.gray('  PRODUCER_ENDPOINT - Producer agent endpoint (default: http://localhost:3001)'))
    console.log(chalk.gray('  OPENAI_API_KEY - Optional: Enables natural language prompts'))
    console.log('')
    process.exit(0)
  }

  // Join all arguments into a single prompt/input
  const input = args.join(' ')

  // Check if input is a direct account ID
  let accountId: string | null = null

  if (isValidAccountId(input)) {
    // Direct account ID provided
    accountId = input
    console.log(chalk.green(`✅ Using account ID: ${accountId}`))
  } else {
    // Natural language prompt - try LLM extraction
    console.log(chalk.blue(`💬 Processing prompt: "${input}"`))
    accountId = await extractAccountIdFromPrompt(input)

    if (!accountId) {
      // Try to extract manually as fallback
      const extracted = input.match(/0\.0\.\d+/)
      if (extracted) {
        accountId = extracted[0]
        console.log(chalk.yellow(`⚠️  Manually extracted account ID: ${accountId}`))
      } else {
        console.error(chalk.red(`❌ Could not extract account ID from: "${input}"`))
        console.error(chalk.yellow('💡 Try providing the account ID directly: npm run trustscore 0.0.1234567'))
        process.exit(1)
      }
    }
  }

  // Get producer endpoint
  const producerEndpoint = process.env.PRODUCER_ENDPOINT || 'http://localhost:3001'

  // Request trust score
  await requestTrustScore(accountId, producerEndpoint)
}

// Run if called directly
if (require.main === module) {
  main()
    .then(() => {
      process.exit(0)
    })
    .catch((error) => {
      console.error(chalk.red('\n❌ Fatal error:'), error)
      process.exit(1)
    })
}

export { requestTrustScore, extractAccountIdFromPrompt, isValidAccountId }

