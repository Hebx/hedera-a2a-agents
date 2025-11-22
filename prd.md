# TrustScore Oracle - Product Requirements Document

## Executive Summary

The TrustScore Oracle is a decentralized marketplace service that enables autonomous agents on the Hedera network to buy and sell reputation scores for any Hedera account. It provides a critical trust layer for the Hedera ecosystem, allowing agents to make informed risk assessments before engaging in transactions.

## Problem Statement

In a decentralized agent economy, autonomous agents need reliable mechanisms to assess counterparty reputation and risk. Current solutions are:

- ❌ Manual and time-consuming
- ❌ Not standardized
- ❌ Expensive to implement
- ❌ Lacking real-time on-chain data

**TrustScore Oracle solves this** by providing an autonomous marketplace where agents can discover, negotiate, pay for, and receive trust scores in seconds—all without human intervention.

## Solution Overview

TrustScore Oracle implements a complete **A2A → AP2 → x402 → Analytics → HCS** workflow:

1. **A2A Protocol** - Agent-to-agent communication and coordination
2. **AP2 Protocol** - Dynamic price negotiation between agents
3. **x402 Standard** - Micropayment-gated API access
4. **Arkhia Analytics** - Real-time Hedera on-chain data
5. **HCS-10** - Immutable audit trails on Hedera Consensus Service

## System Architecture

### Core Components

#### 1. TrustScoreProducerAgent
- Computes trust scores from on-chain analytics
- Exposes x402 payment-gated API
- Participates in AP2 price negotiation
- Logs events to HCS via MeshOrchestrator

#### 2. TrustScoreConsumerAgent
- Discovers available trust score products
- Negotiates prices via AP2 protocol
- Makes x402 payments for API access
- Requests and consumes trust scores

#### 3. MeshOrchestrator
- Manages agent registration and coordination
- Facilitates A2A communication
- Handles HCS event logging
- Maintains system state

#### 4. TrustScoreComputationEngine
- Calculates trust score components (0-100 scale):
  - Account Age (0-20 points)
  - Transaction Diversity (0-20 points)
  - Transfer Volatility (0-20 points)
  - Token Health (0-10 points)
  - HCS Quality (0-10 points)
- Detects risk flags:
  - Rapid outflows
  - New account large transfers
  - Malicious interactions

#### 5. ArkhiaAnalyticsService
- Fetches account information
- Retrieves transaction history
- Gets token balances
- Queries HCS messages
- Includes retry logic, circuit breaker, and caching

#### 6. X402FacilitatorServer
- Verifies payment authorizations
- Settles payments on Hedera network
- Supports HBAR native transfers
- Provides payment verification

## Trust Score Computation

### Components

| Component | Weight | Description |
|-----------|--------|-------------|
| Account Age | 0-20 pts | Rewards established accounts (≥365 days: 20pts, 90-364: 10pts, <90: 3pts) |
| Transaction Diversity | 0-20 pts | Rewards accounts with many unique counterparties (≥20: 20pts, 10-19: 10pts, 5-9: 5pts) |
| Transfer Volatility | 0-20 pts | Rewards stable transaction patterns (CV <0.3: 20pts, 0.3-0.6: 10pts, ≥0.6: 3pts) |
| Token Health | 0-10 pts | Rewards balanced token distributions |
| HCS Quality | 0-10 pts | Rewards trusted HCS topic interactions (+2pts each, -5pts for suspicious) |

### Risk Flags

Risk flags reduce the final score:

- **Rapid Outflow**: -10 points
- **New Account Large Transfer**: -15 points
- **Malicious Interactions**: -20 points

### Final Score

Final trust score = Sum of components - Risk penalties (clamped to 0-100)

## API Specifications

### Endpoints

#### GET `/health`
Free health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "agentId": "0.0.1234567",
  "timestamp": 1703123456789
}
```

#### GET `/products`
Free product discovery endpoint.

**Response:**
```json
{
  "products": [
    {
      "productId": "trustscore.basic.v1",
      "name": "Basic Trust Score",
      "description": "Standard trust score computation",
      "price": "0.3",
      "currency": "HBAR",
      "rateLimit": {
        "calls": 100,
        "period": 86400
      }
    }
  ]
}
```

#### POST `/ap2/negotiate`
AP2 price negotiation endpoint.

**Request:**
```json
{
  "type": "AP2::NEGOTIATE",
  "productId": "trustscore.basic.v1",
  "maxPrice": "0.3",
  "currency": "HBAR"
}
```

**Response:**
```json
{
  "type": "AP2::OFFER",
  "productId": "trustscore.basic.v1",
  "price": "0.3",
  "currency": "HBAR",
  "sla": {
    "uptime": "99.9%",
    "responseTime": "< 2s"
  }
}
```

#### GET `/trustscore/:accountId`
Payment-gated trust score endpoint.

**Initial Request** (without payment):
```http
GET /trustscore/0.0.1234567
```

**Response:** `402 Payment Required`
```json
{
  "error": {
    "code": "PAYMENT_REQUIRED",
    "payment": {
      "network": "hedera-testnet",
      "asset": "HBAR",
      "payTo": "0.0.producer-account",
      "maxAmountRequired": "0.3"
    }
  }
}
```

**Request with Payment**:
```http
GET /trustscore/0.0.1234567
X-PAYMENT: <payment-token>
```

**Response:** `200 OK`
```json
{
  "account": "0.0.1234567",
  "score": 85,
  "components": {
    "accountAge": 20,
    "diversity": 18,
    "volatility": 15,
    "tokenHealth": 10,
    "hcsQuality": 10,
    "riskPenalty": 0
  },
  "riskFlags": [],
  "timestamp": 1703123456789
}
```

## Workflow

### Complete Trust Score Request Flow

1. **Product Discovery**
   - Consumer queries Product Registry
   - Discovers available trust score products
   - Reviews pricing and SLA terms

2. **AP2 Negotiation**
   - Consumer sends negotiation request
   - Producer responds with offer
   - Terms agreed upon (price, rate limits, SLA)

3. **x402 Payment**
   - Consumer receives 402 Payment Required
   - Pays via x402 facilitator
   - Receives payment token

4. **Trust Score Request**
   - Consumer retries request with X-PAYMENT header
   - Producer verifies payment
   - Fetches account data from Arkhia API
   - Computes trust score
   - Returns score to consumer

5. **HCS Logging**
   - All events logged to HCS via MeshOrchestrator
   - Immutable audit trail on Hedera network

## Technical Requirements

### Environment Setup

- Node.js 18+
- TypeScript 5.9+
- Hedera Testnet account with HBAR
- Arkhia API key

### Dependencies

- `@hashgraph/sdk` - Hedera SDK
- `@hashgraphonline/standards-agent-kit` - Hedron SDK components
- `a2a-x402` - x402 payment standard implementation
- `express` - API server
- `axios` - HTTP client
- `fast-check` - Property-based testing

### Configuration

Required environment variables:

```env
HEDERA_ACCOUNT_ID=0.0.xxxxx
HEDERA_PRIVATE_KEY=302e...
ARKHIA_API_KEY=your_key_here
CONSUMER_AGENT_ID=0.0.xxxxx (optional)
PRODUCER_AGENT_ID=0.0.xxxxx (optional)
```

## Testing Requirements

### Test Coverage

- **Property-Based Tests**: 57 properties covering all core functionality
- **Unit Tests**: Individual component testing
- **Integration Tests**: API and service integration
- **E2E Tests**: Complete workflow testing

### Test Categories

1. **Trust Score Computation** - Score calculation correctness
2. **Payment Flow** - x402 payment processing
3. **AP2 Negotiation** - Price negotiation protocol
4. **A2A Communication** - Agent-to-agent messaging
5. **HCS Logging** - Event logging to Hedera Consensus Service
6. **Error Handling** - Robust error handling and recovery

## Deployment

### Production Checklist

- ✅ Complete A2A → AP2 → x402 → Analytics → HCS workflow
- ✅ Real Arkhia API integration
- ✅ Comprehensive test coverage
- ✅ Error handling and retry logic
- ✅ HashScan integration for transaction verification
- ✅ Separate account support for Producer/Consumer
- ✅ CLI interface for easy usage
- ✅ Complete documentation

### Network Support

- **Hedera Testnet** - Primary development environment
- **Hedera Mainnet** - Production deployments (ready)

## Future Enhancements

- Mainnet deployment
- Additional analytics providers
- Enhanced scoring algorithms
- Multi-currency support
- Agent marketplace expansion
- Advanced risk detection
- Historical score tracking

---

**Version**: 1.0.0  
**Status**: Production-Ready  
**Branch**: ascension
