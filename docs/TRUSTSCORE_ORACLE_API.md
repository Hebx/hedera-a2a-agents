# TrustScore Oracle API Documentation

## Overview

The TrustScore Oracle provides a decentralized marketplace service for purchasing and consuming reputation scores for Hedera accounts. The system implements a complete A2A → AP2 → x402 → Analytics → HCS workflow.

**Base URL**: `http://localhost:3001` (configurable via `PRODUCER_PORT`)

## Table of Contents

1. [Authentication](#authentication)
2. [Endpoints](#endpoints)
3. [x402 Payment Flow](#x402-payment-flow)
4. [AP2 Negotiation Protocol](#ap2-negotiation-protocol)
5. [Trust Score Formula](#trust-score-formula)
6. [Error Codes](#error-codes)
7. [TypeScript Integration](#typescript-integration)

---

## Authentication

The TrustScore Oracle uses **x402 payment-gated access**. All requests to `/trustscore/:accountId` require a valid payment token in the `X-PAYMENT` header.

### Payment Flow

1. **Initial Request** (without payment):
   ```http
   GET /trustscore/0.0.123456
   ```
   
   Response: `402 Payment Required` with payment requirements

2. **Payment** (via x402 facilitator):
   - Consumer agent pays the required amount
   - Receives payment token

3. **Retry Request** (with payment):
   ```http
   GET /trustscore/0.0.123456
   X-PAYMENT: <payment-token>
   ```
   
   Response: `200 OK` with trust score

---

## Endpoints

### Health Check

**GET** `/health`

Free endpoint to check service status.

**Response**:
```json
{
  "status": "healthy",
  "agentId": "0.0.1234567",
  "timestamp": 1703123456789
}
```

---

### Product Discovery

**GET** `/products`

Free endpoint to discover available trust score products.

**Response**:
```json
{
  "products": [
    {
      "productId": "trustscore.basic.v1",
      "version": "v1",
      "name": "Basic Trust Score",
      "description": "Standard trust score computation",
      "producerAgentId": "0.0.1234567",
      "endpoint": "/trustscore/:accountId",
      "defaultPrice": "0.3",
      "currency": "HBAR",
      "network": "hedera-testnet",
      "rateLimit": {
        "calls": 100,
        "period": 86400
      },
      "sla": {
        "uptime": "99.9%",
        "responseTime": "< 2s"
      },
      "createdAt": 1703123456789,
      "updatedAt": 1703123456789
    }
  ],
  "count": 1
}
```

---

### AP2 Negotiation

**POST** `/ap2/negotiate`

Initiate price negotiation for a trust score product.

**Request Body**:
```json
{
  "type": "AP2::NEGOTIATE",
  "productId": "trustscore.basic.v1",
  "maxPrice": "0.5",
  "currency": "HBAR",
  "rateLimit": {
    "calls": 100,
    "period": 86400
  },
  "metadata": {
    "buyerAgentId": "0.0.7654321",
    "timestamp": 1703123456789
  }
}
```

**Response** (200 OK):
```json
{
  "type": "AP2::OFFER",
  "productId": "trustscore.basic.v1",
  "price": "0.3",
  "currency": "HBAR",
  "slippage": "none",
  "rateLimit": {
    "calls": 100,
    "period": 86400
  },
  "sla": {
    "uptime": "99.9%",
    "responseTime": "< 2s"
  },
  "validUntil": 1703123756789,
  "metadata": {
    "producerAgentId": "0.0.1234567",
    "timestamp": 1703123456789
  }
}
```

**Error Responses**:
- `400 Bad Request`: Invalid negotiation request
- `404 Not Found`: Product not found
- `400 Bad Request`: Price too low

---

### Get Trust Score

**GET** `/trustscore/:accountId`

Get trust score for a Hedera account. Requires x402 payment.

**Path Parameters**:
- `accountId` (string, required): Hedera account ID (format: `0.0.xxxxx`)

**Headers**:
- `X-PAYMENT` (string, required after initial 402): Payment token from x402 facilitator

**Response** (200 OK):
```json
{
  "account": "0.0.123456",
  "score": 85,
  "components": {
    "accountAge": {
      "score": 20,
      "days": 365,
      "tier": "established"
    },
    "diversity": {
      "score": 18,
      "uniqueCounterparties": 45,
      "tier": "high"
    },
    "volatility": {
      "score": 15,
      "coefficient": 0.25,
      "tier": "medium"
    },
    "tokenHealth": {
      "score": 8,
      "distribution": "balanced",
      "tier": "good"
    },
    "hcsQuality": {
      "score": 10,
      "trustedTopics": 3,
      "suspiciousTopics": 0,
      "tier": "excellent"
    }
  },
  "riskFlags": [],
  "timestamp": 1703123456789,
  "payment": {
    "verified": true,
    "amount": "30000",
    "currency": "HBAR"
  }
}
```

**Error Responses**:

- `400 Bad Request`: Invalid account ID format
  ```json
  {
    "error": {
      "code": "INVALID_ACCOUNT_ID",
      "message": "Invalid Hedera account ID format. Expected format: 0.0.xxxxx",
      "timestamp": 1703123456789
    }
  }
  ```

- `402 Payment Required`: Payment not provided
  ```json
  {
    "error": {
      "code": "PAYMENT_REQUIRED",
      "message": "Payment required to access trust score",
      "payment": {
        "scheme": "exact",
        "network": "hedera-testnet",
        "asset": "HBAR",
        "payTo": "0.0.1234567",
        "maxAmountRequired": "30000",
        "resource": "/trustscore/0.0.123456",
        "description": "Trust score for account 0.0.123456",
        "mimeType": "application/json",
        "maxTimeoutSeconds": 300
      },
      "timestamp": 1703123456789
    }
  }
  ```

- `402 Payment Required`: Payment verification failed
  ```json
  {
    "error": {
      "code": "PAYMENT_VERIFICATION_FAILED",
      "message": "Payment verification failed",
      "reason": "Invalid payment token",
      "payment": { ... },
      "timestamp": 1703123456789
    }
  }
  ```

- `503 Service Unavailable`: Arkhia API unavailable
  ```json
  {
    "error": {
      "code": "SERVICE_UNAVAILABLE",
      "message": "Trust score computation service unavailable",
      "details": "Arkhia API timeout",
      "timestamp": 1703123456789
    }
  }
  ```

---

## x402 Payment Flow

The TrustScore Oracle implements the x402 payment standard for micropayments.

### Sequence Diagram

```
Consumer Agent          Producer Agent          x402 Facilitator
     |                        |                        |
     |-- GET /trustscore/:id ->|                        |
     |                        |                        |
     |<-- 402 Payment Required|                        |
     |                        |                        |
     |-- Payment Request ---->|                        |
     |                        |-- Verify Payment ---->|
     |                        |<-- Payment Token ------|
     |<-- Payment Token ------|                        |
     |                        |                        |
     |-- GET /trustscore/:id ->|                        |
     |   X-PAYMENT: token     |                        |
     |                        |-- Verify Token ------->|
     |                        |<-- Verified -----------|
     |                        |                        |
     |                        |-- Compute Score -------|
     |                        |                        |
     |<-- 200 OK + Score -----|                        |
```

### Payment Requirements

When a `402 Payment Required` response is received, the payment requirements object contains:

- `scheme`: Payment scheme (always `"exact"`)
- `network`: Network to pay on (`"hedera-testnet"` or `"base-sepolia"`)
- `asset`: Asset to pay (`"HBAR"` or USDC contract address)
- `payTo`: Recipient account/address
- `maxAmountRequired`: Amount in smallest unit (tinybars for HBAR, wei for USDC)
- `resource`: Resource path being paid for
- `description`: Human-readable description
- `mimeType`: Expected response content type
- `maxTimeoutSeconds`: Payment validity period

### Payment Token Format

The `X-PAYMENT` header contains a signed payment token from the x402 facilitator. The token format is implementation-specific but must be verifiable by the facilitator.

---

## AP2 Negotiation Protocol

The AP2 (Agent-to-Agent Payment Protocol) is used for price negotiation between consumer and producer agents.

### Negotiation Flow

1. **Consumer initiates negotiation**:
   - Sends `AP2::NEGOTIATE` request with `maxPrice`
   - Includes desired `rateLimit` and `currency`

2. **Producer responds with offer**:
   - Validates request
   - Checks if `maxPrice` meets minimum
   - Creates `AP2::OFFER` with:
     - Final `price` (may be lower than requested)
     - `rateLimit` terms
     - `sla` guarantees
     - `validUntil` timestamp (default: 5 minutes)

3. **Consumer accepts offer**:
   - Validates offer is not expired
   - Stores offer for future use
   - Uses negotiated terms for requests

### Term Enforcement

The system enforces negotiated terms:
- **Price**: Charged price must not exceed offered price
- **Rate Limit**: Actual rate limit must meet or exceed offered terms
- **SLA**: Uptime and response time must meet offered guarantees

---

## Trust Score Formula

The trust score is computed from multiple components, each contributing to a final score of 0-100.

### Components

#### 1. Account Age (0-20 points)

- **Established** (≥365 days): 20 points
- **Mature** (90-364 days): 10 points
- **New** (<90 days): 3 points

#### 2. Transaction Diversity (0-20 points)

Based on unique counterparties in last 30 days:
- **High** (≥20 unique): 20 points
- **Medium** (10-19 unique): 10 points
- **Low** (5-9 unique): 5 points
- **Very Low** (<5 unique): 0 points

#### 3. Transfer Volatility (0-20 points)

Based on coefficient of variation of transaction amounts:
- **Low volatility** (CV < 0.3): 20 points
- **Medium volatility** (0.3 ≤ CV < 0.6): 10 points
- **High volatility** (CV ≥ 0.6): 3 points

#### 4. Token Health (0-10 points)

Based on token distribution and holdings:
- **Balanced portfolio**: 10 points
- **Concentrated holdings**: 5 points
- **No tokens**: 0 points

#### 5. HCS Quality (0-10 points, can be negative)

- **Trusted topics** (+2 points each, max +10)
- **Suspicious topics** (-5 points each, max -10)

### Risk Flags

Risk flags can reduce the final score:

- **Rapid Outflow**: Large outflows in short time (-10 points)
- **New Account Large Transfer**: New account with large initial transfer (-15 points)
- **Malicious Interactions**: Interactions with known malicious accounts (-20 points)

### Final Score Calculation

```
Final Score = Sum of Component Scores - Sum of Risk Flag Penalties
Final Score = Clamp(Final Score, 0, 100)
```

---

## Error Codes

### Validation Errors (4xx)

| Code | Description | Resolution |
|------|-------------|------------|
| `INVALID_ACCOUNT_ID` | Invalid account ID format | Verify format is `0.0.xxxxx` |
| `INVALID_NEGOTIATION_REQUEST` | Invalid AP2 negotiation request | Check request structure |
| `PRICE_TOO_LOW` | Requested price below minimum | Increase `maxPrice` |

### Payment Errors (402, 4xx)

| Code | Description | Resolution |
|------|-------------|------------|
| `PAYMENT_REQUIRED` | Payment not provided | Include `X-PAYMENT` header |
| `PAYMENT_VERIFICATION_FAILED` | Payment token invalid | Retry with new payment |
| `INSUFFICIENT_PAYMENT` | Payment amount too low | Pay required amount |

### Service Errors (5xx)

| Code | Description | Resolution |
|------|-------------|------------|
| `SERVICE_UNAVAILABLE` | Arkhia API unavailable | Retry after a few moments |
| `INTERNAL_ERROR` | Internal server error | Contact support |
| `CIRCUIT_BREAKER_OPEN` | Service experiencing issues | Retry later |

### Rate Limit Errors (429)

| Code | Description | Resolution |
|------|-------------|------------|
| `RATE_LIMIT_EXCEEDED` | Too many requests | Wait for rate limit window to reset |

---

## TypeScript Integration

### Basic Usage

```typescript
import { TrustScoreConsumerAgent } from '@hedron/agents'
import { TrustScoreProducerAgent } from '@hedron/agents'

// Initialize consumer agent
const consumer = new TrustScoreConsumerAgent()
await consumer.init()

// Discover products
const products = await consumer.discoverProducts()
console.log('Available products:', products)

// Negotiate price
const offer = await consumer.negotiatePrice(
  'trustscore.basic.v1',
  'http://localhost:3001'
)
console.log('Negotiated offer:', offer)

// Request trust score
const score = await consumer.requestTrustScore(
  '0.0.123456',
  'trustscore.basic.v1',
  'http://localhost:3001'
)
console.log('Trust score:', score)
```

### Producer Agent Setup

```typescript
import { TrustScoreProducerAgent } from '@hedron/agents'

// Initialize producer agent
const producer = new TrustScoreProducerAgent()
await producer.init()

// Server starts on configured port (default: 3001)
// Endpoints are automatically available:
// - GET /health
// - GET /products
// - POST /ap2/negotiate
// - GET /trustscore/:accountId
```

### Error Handling

```typescript
import { globalErrorHandler, ErrorCategory, ErrorSeverity } from '@hedron/utils'

try {
  const score = await consumer.requestTrustScore('0.0.123456', 'trustscore.basic.v1', endpoint)
} catch (error) {
  const logId = globalErrorHandler.logError(
    error as Error,
    ErrorCategory.SERVICE,
    ErrorSeverity.HIGH,
    {
      accountId: '0.0.123456',
      agentId: consumer.agentId
    }
  )
  console.error(`Error logged: ${logId}`)
}
```

### Query Error Logs

```typescript
// Query errors by category
const serviceErrors = globalErrorHandler.queryLogs({
  category: ErrorCategory.SERVICE,
  startTime: Date.now() - 3600000 // Last hour
})

// Query errors by account
const accountErrors = globalErrorHandler.queryLogs({
  accountId: '0.0.123456'
})

// Get error statistics
const stats = globalErrorHandler.getStatistics()
console.log('Total errors:', stats.total)
console.log('Unresolved:', stats.unresolved)
```

---

## Examples

### Complete Flow Example

```typescript
import { TrustScoreConsumerAgent } from '@hedron/agents'

async function getTrustScore(accountId: string) {
  const consumer = new TrustScoreConsumerAgent()
  await consumer.init()

  // 1. Discover products
  const products = await consumer.discoverProducts()
  const product = products[0]

  // 2. Negotiate price
  const offer = await consumer.negotiatePrice(
    product.productId,
    product.endpoint
  )

  if (!offer) {
    throw new Error('Negotiation failed')
  }

  // 3. Request trust score
  const score = await consumer.requestTrustScore(
    accountId,
    product.productId,
    product.endpoint
  )

  return score
}

// Usage
getTrustScore('0.0.123456')
  .then(score => {
    console.log(`Trust Score: ${score.score}/100`)
    console.log('Components:', score.components)
    console.log('Risk Flags:', score.riskFlags)
  })
  .catch(error => {
    console.error('Error:', error.message)
  })
```

---

## Rate Limiting

Rate limits are enforced per consumer agent. Default limits:
- **Calls**: 100 requests
- **Period**: 86400 seconds (24 hours)

Rate limit information is included in negotiation offers and can be customized per consumer.

---

## Support

For issues, questions, or contributions:
- GitHub: [Hedron Repository](https://github.com/Hebx/Hedron)
- Documentation: See `docs/` directory
- Examples: See `demo/` directory

---

**Last Updated**: 2025-11-21
**Version**: 1.0.0

