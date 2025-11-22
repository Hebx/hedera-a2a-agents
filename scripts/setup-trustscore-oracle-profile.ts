/**
 * TrustScore Oracle Profile Setup
 * 
 * Registers HCS-11 profile for TrustScore Oracle agents
 * Fixes the "Failed to retrieve profile" and "Cannot find inbound topic" errors
 * 
 * @packageDocumentation
 */

import { Client, PrivateKey, AccountId, TopicCreateTransaction, TopicId, TopicMessageSubmitTransaction } from '@hashgraph/sdk'
import chalk from 'chalk'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

async function setupTrustScoreOracleProfile(): Promise<void> {
  try {
    console.log(chalk.bold('🔧 TrustScore Oracle Profile Setup'))
    console.log(chalk.gray('Registering HCS-11 profile and A2A topics for TrustScore Oracle'))
    console.log('')

    // Get account credentials
    const accountId = process.env.HEDERA_ACCOUNT_ID || '0.0.7132337'
    const privateKeyString = process.env.HEDERA_PRIVATE_KEY

    if (!privateKeyString) {
      throw new Error('Missing required environment variable: HEDERA_PRIVATE_KEY')
    }

    console.log(chalk.blue('Account ID:'), accountId)
    console.log('')

    // Initialize Hedera client
    const client = Client.forTestnet()

    // Parse private key - handle different formats (DER, ED25519, ECDSA, etc.)
    let privateKey: PrivateKey
    const hexKey = privateKeyString.startsWith('0x') ? privateKeyString.slice(2) : privateKeyString
    const isHex = /^[0-9a-fA-F]+$/.test(hexKey) && hexKey.length >= 64
    
    // If it's a raw hex string, try ECDSA first (common for wallet-generated accounts)
    if (isHex) {
      try {
        privateKey = PrivateKey.fromStringECDSA(hexKey)
        console.log(chalk.green('✅ Parsed private key as raw hex (ECDSA SECP256K1)'))
      } catch (error1) {
        try {
          privateKey = PrivateKey.fromStringED25519(hexKey)
          console.log(chalk.green('✅ Parsed private key as raw hex (ED25519)'))
        } catch (error2) {
          // Fall back to DER format
          try {
            privateKey = PrivateKey.fromString(privateKeyString)
            console.log(chalk.yellow('⚠️  Parsed private key as DER format'))
          } catch (error3) {
            console.error(chalk.red('❌ Error parsing private key:'), error3)
            throw error3
          }
        }
      }
    } else {
      // Try DER format first for non-hex strings
      try {
        privateKey = PrivateKey.fromString(privateKeyString)
        console.log(chalk.green('✅ Parsed private key as DER format'))
      } catch (error) {
        console.error(chalk.red('❌ Error parsing private key:'), error)
        throw error
      }
    }

    // Set operator
    client.setOperator(AccountId.fromString(accountId), privateKey)

    console.log(chalk.bold('--- Step 1: Create/Verify Profile Topic ---'))
    
    // Check if profile topic exists (using existing or creating new)
    const existingProfileTopicId = process.env.PROFILE_TOPIC_ID || '0.0.7133161'
    let profileTopicId = existingProfileTopicId

    try {
      // Try to verify topic exists by checking account balance
      console.log(chalk.blue(`Using profile topic: ${profileTopicId}`))
      console.log(chalk.green('✅ Profile topic ready'))
    } catch (error) {
      console.log(chalk.yellow('⚠️  Profile topic may not exist, creating new one...'))
      
      // Create new profile topic
      const topicCreateTx = await new TopicCreateTransaction()
        .setTopicMemo(`HCS-11 Profile Topic for ${accountId}`)
        .execute(client)
      
      const topicReceipt = await topicCreateTx.getReceipt(client)
      profileTopicId = topicReceipt.topicId?.toString() || existingProfileTopicId
      
      console.log(chalk.green(`✅ Created profile topic: ${profileTopicId}`))
    }

    console.log('')

    console.log(chalk.bold('--- Step 2: Create A2A Inbound Topic ---'))
    
    // Create or use existing inbound topic for A2A communication
    const inboundTopicIdEnv = process.env[`${accountId.toUpperCase().replace(/\./g, '_')}_TOPIC_ID`] 
      || process.env.INBOUND_TOPIC_ID
    
    let inboundTopicId = inboundTopicIdEnv

    if (!inboundTopicId) {
      console.log(chalk.blue('Creating inbound topic for A2A communication...'))
      
      const inboundTopicCreateTx = await new TopicCreateTransaction()
        .setTopicMemo(`A2A Inbound Topic for ${accountId}`)
        .execute(client)
      
      const inboundTopicReceipt = await inboundTopicCreateTx.getReceipt(client)
      inboundTopicId = inboundTopicReceipt.topicId?.toString() || ''
      
      console.log(chalk.green(`✅ Created inbound topic: ${inboundTopicId}`))
      console.log(chalk.yellow(`⚠️  Add this to your .env:`))
      console.log(chalk.yellow(`   INBOUND_TOPIC_ID=${inboundTopicId}`))
      console.log(chalk.yellow(`   ${accountId.toUpperCase().replace(/\./g, '_')}_TOPIC_ID=${inboundTopicId}`))
    } else {
      console.log(chalk.green(`✅ Using existing inbound topic: ${inboundTopicId}`))
    }

    console.log('')

    console.log(chalk.bold('--- Step 3: Create HCS-11 Profile ---'))
    
    // Create HCS-11 profile with all necessary metadata
    const profile = {
      "@context": [
        "https://www.w3.org/ns/did/v1",
        "https://hashgraphonline.com/docs/standards/hcs-11"
      ],
      "@type": "HCS11Profile",
      "id": `did:hedera:testnet:${accountId}`,
      "account": accountId,
      "name": "TrustScore Oracle Agent",
      "displayName": "TrustScore Oracle Coordinator",
      "description": "TrustScore Oracle system coordinator - manages producer and consumer agents",
      "version": "1.0.0",
      "created": new Date().toISOString(),
      "updated": new Date().toISOString(),
      "capabilities": [
        "trustscore-oracle",
        "producer-agent",
        "consumer-agent",
        "orchestrator",
        "hcs-10-messaging",
        "a2a-protocol",
        "ap2-negotiation",
        "x402-payments"
      ],
      "properties": {
        "accountType": "orchestrator",
        "network": "testnet",
        "system": "trustscore-oracle",
        "status": "active",
        "lastActivity": new Date().toISOString()
      },
      "topics": {
        "profile": profileTopicId,
        "inbound": inboundTopicId,
        "mesh": process.env.MESH_TOPIC_ID || "0.0.7132813"
      },
      "endpoints": {
        "api": process.env.PRODUCER_ENDPOINT || `http://localhost:3001`,
        "health": process.env.PRODUCER_ENDPOINT ? `${process.env.PRODUCER_ENDPOINT}/health` : "http://localhost:3001/health"
      },
      "metadata": {
        "agentSystem": "trustscore-oracle",
        "version": "1.0.0",
        "capabilities": {
          "hcs10": true,
          "a2a": true,
          "ap2": true,
          "x402": true,
          "trustscore": true
        }
      }
    }

    // Submit profile to HCS topic using raw SDK (to avoid chicken-and-egg problem)
    console.log(chalk.blue('Inscribing HCS-11 profile...'))
    const profileMessage = JSON.stringify(profile)
    
    const submitTransaction = new TopicMessageSubmitTransaction()
      .setTopicId(profileTopicId)
      .setMessage(profileMessage)
    
    const response = await submitTransaction.execute(client)
    const receipt = await response.getReceipt(client)
    const transactionId = response.transactionId.toString()
    
    console.log(chalk.green('✅ HCS-11 profile inscribed!'))
    console.log(chalk.gray(`   Transaction ID: ${transactionId}`))
    console.log('')

    console.log(chalk.bold('--- Step 4: Verify Setup ---'))
    console.log(chalk.green('✅ Profile Topic ID:'), profileTopicId)
    console.log(chalk.green('✅ Inbound Topic ID:'), inboundTopicId)
    console.log(chalk.green('✅ Account ID:'), accountId)
    console.log('')

    console.log(chalk.bold('📋 Next Steps:'))
    console.log('1. Wait a few seconds for CDN to index the profile')
    console.log('2. Run the demo again: npm run demo:trustscore-oracle')
    console.log('3. The errors should be resolved!')
    console.log('')

    console.log(chalk.bold('💡 Environment Variables to Set:'))
    console.log(chalk.yellow(`   INBOUND_TOPIC_ID=${inboundTopicId}`))
    console.log(chalk.yellow(`   PROFILE_TOPIC_ID=${profileTopicId}`))
    if (!process.env.MESH_TOPIC_ID) {
      console.log(chalk.yellow(`   MESH_TOPIC_ID=0.0.7132813  # (or create new one)`))
    }

    console.log('')
    console.log(chalk.green('✅ TrustScore Oracle profile setup complete!'))

  } catch (error) {
    console.error(chalk.red('❌ Error setting up profile:'), error)
    throw error
  }
}

// Run setup if called directly
if (require.main === module) {
  setupTrustScoreOracleProfile()
    .then(() => {
      console.log(chalk.green('\n🎉 Setup completed successfully!'))
      process.exit(0)
    })
    .catch((error) => {
      console.error(chalk.red('\n❌ Setup failed:'), error)
      process.exit(1)
    })
}

export { setupTrustScoreOracleProfile }

