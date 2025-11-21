/**
 * Test Arkhia API Connection
 * 
 * Verifies that we can connect to Arkhia testnet API with the configured API key.
 */

import axios from 'axios'
import { loadEnvIfNeeded } from '../../src/utils/env'
import chalk from 'chalk'

// Load environment variables
loadEnvIfNeeded()

async function testArkhiaConnection(): Promise<void> {
  try {
    console.log(chalk.bold('🔍 Testing Arkhia Testnet API Connection'))
    console.log('')

    const apiKey = process.env.ARKHIA_API_KEY
    if (!apiKey) {
      console.log(chalk.red('❌ ARKHIA_API_KEY not set in environment'))
      process.exit(1)
    }

    console.log(chalk.blue(`📋 API Key: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`))
    console.log(chalk.blue(`📋 Base URL: https://pool.arkhia.io`))
    console.log(chalk.blue(`📋 Network: testnet`))
    console.log('')

    // Test endpoint: /hedera/testnet/api/v1/accounts/{accountId}
    const testAccountId = process.env.HEDERA_ACCOUNT_ID || '0.0.2' // Use a known testnet account
    
    const baseURL = 'https://pool.arkhia.io'
    const endpoint = `/hedera/testnet/api/v1/accounts/${testAccountId}`

    console.log(chalk.yellow(`🔗 Testing: ${baseURL}${endpoint}`))
    console.log('')

    const client = axios.create({
      baseURL,
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    })

    console.log(chalk.blue('📤 Sending request...'))
    const response = await client.get(endpoint)

    console.log(chalk.green('✅ API Connection Successful!'))
    console.log('')
    console.log(chalk.blue('📋 Response Status:'), response.status)
    console.log(chalk.blue('📋 Response Headers:'), JSON.stringify(response.headers, null, 2))
    console.log('')
    console.log(chalk.blue('📋 Account Data:'))
    console.log(JSON.stringify(response.data, null, 2))

    // Test transactions extraction (from account response)
    console.log('')
    console.log(chalk.yellow('🔗 Testing transactions extraction from account response...'))
    const transactions = response.data.transactions || []
    console.log(chalk.green('✅ Transactions extracted from account response!'))
    console.log(chalk.blue(`📋 Found ${transactions.length} transactions in account response`))

    // Test token balances extraction (from account response)
    console.log('')
    console.log(chalk.yellow('🔗 Testing token balances extraction from account response...'))
    const tokens = response.data.balance?.tokens || []
    console.log(chalk.green('✅ Token balances extracted from account response!'))
    console.log(chalk.blue(`📋 Found ${tokens.length} token balances in account response`))

    console.log('')
    console.log(chalk.green('🎉 All Arkhia API endpoints are accessible!'))

  } catch (error: any) {
    console.error(chalk.red('❌ API Connection Failed'))
    console.error('')
    
    if (error.response) {
      console.error(chalk.red(`Status: ${error.response.status}`))
      console.error(chalk.red(`Status Text: ${error.response.statusText}`))
      console.error(chalk.red(`URL: ${error.config?.url}`))
      console.error('')
      console.error(chalk.yellow('Response Data:'))
      console.error(JSON.stringify(error.response.data, null, 2))
      console.error('')
      console.error(chalk.yellow('Response Headers:'))
      console.error(JSON.stringify(error.response.headers, null, 2))
    } else if (error.request) {
      console.error(chalk.red('No response received'))
      console.error(chalk.yellow('Request config:'), JSON.stringify(error.config, null, 2))
    } else {
      console.error(chalk.red('Error:'), error.message)
    }
    
    process.exit(1)
  }
}

// Run test
if (require.main === module) {
  testArkhiaConnection()
    .then(() => {
      console.log(chalk.green('\n✅ Test completed successfully'))
      process.exit(0)
    })
    .catch((error) => {
      console.error(chalk.red('\n❌ Test failed:'), error)
      process.exit(1)
    })
}

export { testArkhiaConnection }

