/**
 * Test Consumer Account Access
 * 
 * Verifies that the Consumer account (0.0.7304745) can be accessed
 * and used with the provided private key
 */

import { Client, PrivateKey, AccountId, AccountInfoQuery } from '@hashgraph/sdk'
import chalk from 'chalk'
import dotenv from 'dotenv'

dotenv.config()

async function testConsumerAccount(): Promise<void> {
  try {
    const accountId = '0.0.7304745'
    const hexKey = '0f7c8904631d6c0d6925c53834ebf1aec08e7dfdee840167a663afa80cbab3b5'
    
    console.log(chalk.bold('🔍 Testing Consumer Account Access'))
    console.log('')
    console.log(chalk.blue('Account ID:'), accountId)
    console.log('')
    
    // Parse as ECDSA (account uses ECDSA_SECP256K1)
    console.log('📝 Parsing private key as ECDSA...')
    const privateKey = PrivateKey.fromStringECDSA(hexKey)
    console.log(chalk.green('✅ Private key parsed successfully'))
    console.log('')
    
    // Initialize client
    console.log('📡 Connecting to Hedera Testnet...')
    const client = Client.forTestnet()
    client.setOperator(AccountId.fromString(accountId), privateKey)
    console.log(chalk.green('✅ Client configured'))
    console.log('')
    
    // Query account info
    console.log('📊 Querying account info...')
    const accountInfo = await new AccountInfoQuery()
      .setAccountId(accountId)
      .execute(client)
    
    console.log(chalk.green('✅ Account query successful!'))
    console.log('')
    console.log('Account Details:')
    console.log('─────────────────────────────────────────')
    console.log(`  Account ID: ${accountInfo.accountId.toString()}`)
    console.log(`  Balance: ${accountInfo.balance.toString()} tinybars`)
    console.log(`  Balance: ${(Number(accountInfo.balance) / 100_000_000).toFixed(2)} HBAR`)
    console.log(`  Key: ${accountInfo.key?.toString().substring(0, 60)}...`)
    console.log('─────────────────────────────────────────')
    console.log('')
    
    await client.close()
    
    console.log(chalk.bold.green('✅ Consumer account is accessible and ready to use!'))
    console.log('')
    console.log(chalk.yellow('⚠️  Note: If HCS-11 profile registration fails, it may be due to'))
    console.log(chalk.yellow('   topic permissions or other network issues, not the account key.'))
    console.log('')
    
  } catch (error: any) {
    console.error(chalk.red('❌ Error testing account:'), error.message)
    process.exit(1)
  }
}

if (require.main === module) {
  testConsumerAccount().catch(console.error)
}

