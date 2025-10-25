# Hedera A2A Agents

A multi-agent system built on Hedera Hashgraph for autonomous agent-to-agent communication and settlement using the x402 payment protocol.

## Overview

This project implements three specialized agents that work together to process, verify, and settle transactions:

1. **AnalyzerAgent** - Analyzes incoming proposals and determines if they meet threshold requirements
2. **VerifierAgent** - Validates proposals and sends approval/rejection results
3. **SettlementAgent** - Executes x402 payments when transactions are approved

## Architecture

```
Proposal → AnalyzerAgent → VerifierAgent → SettlementAgent → Payment Execution
```

## Agents

### SettlementAgent

The SettlementAgent handles the final step of the transaction process by executing x402 payments when transactions are approved by the VerifierAgent.

#### Features

- Listens for verification results from the VerifierAgent
- Executes x402 payments using the a2a-x402 library
- Records settlement completion on Hedera Consensus Service (HCS)
- Supports Base Sepolia network for USDC payments

#### Environment Variables

```bash
# Settlement Agent Configuration
SETTLEMENT_AGENT_ID=your_settlement_agent_id
SETTLEMENT_PRIVATE_KEY=your_settlement_private_key
SETTLEMENT_TOPIC_ID=your_settlement_topic_id
BASE_RPC_URL=https://sepolia.base.org
SETTLEMENT_WALLET_PRIVATE_KEY=your_settlement_wallet_private_key
USDC_CONTRACT=0x036CbD53842c5426634e7929541eC2318f3dCF7e
MERCHANT_WALLET_ADDRESS=0x1234567890123456789012345678901234567890
```

#### Usage

```typescript
import { SettlementAgent } from "./src/agents/SettlementAgent";

const settlementAgent = new SettlementAgent();
await settlementAgent.init();
```

#### Payment Flow

1. Receives `verification_result` message from VerifierAgent
2. If approved, creates x402 payment requirements:
   - Scheme: `exact`
   - Network: `base-sepolia`
   - Asset: USDC contract address
   - Amount: 10 USDC (10000000 atomic units)
   - Timeout: 120 seconds
3. Executes payment using `processPayment()` from a2a-x402
4. Records settlement completion on HCS

#### Testing

```bash
npm run test:settlement
```

## Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Copy `env.example` to `.env` and configure your credentials
4. Run agent registration: `ts-node setup/register-agents.ts`
5. Test individual agents or run the full system

## Dependencies

- `@hashgraphonline/standards-agent-kit` - Hedera Consensus Service client
- `a2a-x402` - Autonomous agent payment protocol
- `ethers` - Ethereum/EVM blockchain interactions
- `@hashgraph/sdk` - Hedera SDK for blockchain operations

## License

ISC
