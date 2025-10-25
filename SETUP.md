# Hedera Agent Registration Setup

## Prerequisites

1. **Hedera Testnet Account**: You need a Hedera testnet account with sufficient HBAR balance
2. **Environment Variables**: Create a `.env` file with your credentials

## Setup Instructions

### 1. Create .env file

Create a `.env` file in the project root with the following content:

```bash
# Your Hedera testnet account ID (e.g., 0.0.123456)
HEDERA_ACCOUNT_ID=0.0.123456

# Your Hedera private key (ED25519 format)
# This should be a 32-byte private key in hex format
# Example: 302e020100300506032b657004220420...
HEDERA_PRIVATE_KEY=your_private_key_here
```

### 2. Get Testnet HBAR

If you don't have HBAR on testnet, you can get some from:

- [Hedera Portal](https://portal.hedera.com/) - Create account and get testnet HBAR
- [Hedera Discord](https://discord.gg/hedera) - Request testnet HBAR in #testnet-faucet

### 3. Run Agent Registration

```bash
npx tsx setup/register-agents.ts
```

## Private Key Formats

The script supports multiple private key formats:

1. **DER Encoded** (recommended): `302e020100300506032b657004220420...`
2. **Raw Hex**: `1234567890abcdef...` (32 bytes)
3. **String Format**: As provided by Hedera SDK

## Troubleshooting

### INVALID_SIGNATURE Error

- Ensure your private key is correct and matches your account ID
- Check that the private key format is supported
- Verify your account has sufficient HBAR balance

### Missing Environment Variables

- Ensure `.env` file exists in project root
- Check that `HEDERA_ACCOUNT_ID` and `HEDERA_PRIVATE_KEY` are set

### Network Issues

- Verify you're connected to Hedera testnet
- Check your internet connection
- Ensure Hedera testnet is operational

## Output

After successful registration, the script will:

1. Create HCS topics for each agent
2. Register agents using HCS-10 standard
3. Save credentials to `.env` file in the format:
   ```
   ANALYZER_AGENT_ID=...
   ANALYZER_TOPIC_ID=...
   ANALYZER_PRIVATE_KEY=...
   VERIFIER_AGENT_ID=...
   VERIFIER_TOPIC_ID=...
   VERIFIER_PRIVATE_KEY=...
   SETTLEMENT_AGENT_ID=...
   SETTLEMENT_TOPIC_ID=...
   SETTLEMENT_PRIVATE_KEY=...
   ```

## Next Steps

Once agents are registered, you can:

1. Use the agent credentials in your applications
2. Send messages to agents via HCS topics
3. Implement agent-specific functionality
4. Monitor agent activity on Hedera testnet
