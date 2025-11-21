# Design Document

## Overview

The Hedron TrustScore Oracle is a decentralized marketplace service that enables autonomous agents on the Hedera network to purchase and consume reputation scores for any Hedera account. This system provides a critical trust layer for the Hedera ecosystem, allowing agents to make informed risk assessments before engaging in transactions.

### System Purpose

The TrustScore Oracle addresses the fundamental challenge of trust in decentralized agent-to-agent interactions. When autonomous agents need to transact with unknown counterparties, they require a reliable mechanism to assess reputation and risk. This system provides that mechanism through:

1. **On-Chain Analytics**: Leveraging Arkhia API to analyze comprehensive Hedera account activity
2. **Autonomous Marketplace**: Enabling price discovery and negotiation between buyer and seller agents
3. **Micropayment Integration**: Using x402 standard for frictionless payment-gated API access
4. **Immutable Audit Trail**: Recording all interactions on HCS for transparency and accountability

### Key Innovations

- **First Agent-to-Agent Trust Marketplace**: Combines A2A, AP2, x402, and HCS-10 protocols in a unified marketplace
- **Dynamic Reputation Scoring**: Real-time computation based on current on-chain activity
- **Protocol Composability**: Demonstrates how multiple Hedera protocols can work together seamlessly
- **Enterprise-Grade Trust Layer**: Provides verifiable reputation data for business decision-making

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    MeshOrchestrator                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ A2A Channel  │  │ HCS-10 Mgmt  │  │ State Machine│      │
│  │ Management   │  │ & Logging    │  │ & Tasks      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└────────────┬────────────────────────────────┬───────────────┘
             │                                │
             ▼                                ▼
┌──────────────────────┐          ┌──────────────────────┐
│  TrustScoreConsumer  │◄────────►│  TrustScoreProducer  │
│       Agent          │   AP2    │       Agent          │
│                      │ Negotia  │                      │
│ • Request Scores     │  tion    │ • Compute Scores     │
│ • Pay via x402       │          │ • Serve API          │
│ • Consume Results    │          │ • Enforce Payments   │
└──────────┬───────────┘          └──────────┬───────────┘
           │                                 │
           │ x402 Payment                    │ Arkhia API
           ▼                                 ▼
┌──────────────────────┐          ┌──────────────────────┐
│  X402 Facilitator    │          │   Arkhia Analytics   │
│                      │          │                      │
│ • Verify Payments    │          │ • Account Info       │
│ • Settle HBAR        │          │ • Transactions       │
│ • Issue Receipts     │          │ • Token Holdings     │
└──────────────────────┘          │ • HCS Messages       │
                                  └──────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────┐
│              Hedera Consensus Service (HCS)               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ Negotiation  │  │ Computation  │  │ Settlement   │   │
│  │ Events       │  │ Events       │  │ Events       │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
└──────────────────────────────────────────────────────────┘
```

### Component Interaction Flow

1. **Discovery & Negotiation**: ConsumerAgent discovers ProducerAgent through product registry, initiates AP2 negotiation
2. **Price Agreement**: Agents negotiate price, rate limits, and SLA terms via AP2 protocol
3. **Request Initiation**: ConsumerAgent requests trust score for target account
4. **Payment Gate**: ProducerAgent returns 402, ConsumerAgent pays via x402 facilitator
5. **Score Computation**: ProducerAgent queries Arkhia API, computes trust score
6. **Score Delivery**: ProducerAgent returns score with payment receipt
7. **Audit Logging**: MeshOrchestrator logs all events to HCS topic


## Components and Interfaces

### 1. TrustScoreProducerAgent

**Purpose**: Computes and sells trust scores using Arkhia analytics data.

**Responsibilities**:
- Expose x402-protected REST API endpoint `/trustscore/:accountId`
- Query Arkhia API for account analytics
- Compute trust scores using weighted formula
- Enforce payment requirements via x402
- Participate in AP2 price negotiation
- Log all computations to HCS

**Interface**:
```typescript
class TrustScoreProducerAgent {
  constructor(
    hcsClient: HCS10Client,
    agentId: string,
    arkhiaApiKey: string,
    facilitator: X402FacilitatorServer
  )
  
  // Initialize agent and start API server
  async init(): Promise<void>
  
  // Handle AP2 negotiation requests
  async handleNegotiation(request: AP2NegotiationRequest): Promise<AP2Offer>
  
  // Compute trust score for account
  async computeTrustScore(accountId: string): Promise<TrustScore>
  
  // Verify x402 payment
  async verifyPayment(paymentHeader: string): Promise<boolean>
  
  // Get product registry entry
  getProductInfo(): ProductRegistryEntry
}
```

**Dependencies**:
- `HCS10Client` for HCS messaging
- `X402FacilitatorServer` for payment verification
- `ArkhiaAnalyticsService` for account data
- `A2AProtocol` for agent communication
- `AP2Protocol` for payment negotiation

### 2. TrustScoreConsumerAgent

**Purpose**: Purchases and consumes trust scores for risk assessment.

**Responsibilities**:
- Discover available trust score products
- Initiate AP2 negotiation with producers
- Make x402 payments for API access
- Request trust scores for target accounts
- Validate and consume trust score responses
- Report results to MeshOrchestrator

**Interface**:
```typescript
class TrustScoreConsumerAgent {
  constructor(
    hcsClient: HCS10Client,
    agentId: string,
    wallet: Wallet,
    facilitator: X402FacilitatorServer
  )
  
  // Initialize agent
  async init(): Promise<void>
  
  // Discover available products
  async discoverProducts(): Promise<ProductRegistryEntry[]>
  
  // Negotiate with producer
  async negotiatePrice(
    producerAgentId: string,
    maxPrice: string,
    rateLimit: number
  ): Promise<AP2Agreement>
  
  // Request trust score (handles payment)
  async requestTrustScore(
    producerEndpoint: string,
    accountId: string
  ): Promise<TrustScoreResponse>
  
  // Pay via x402
  private async payForAccess(
    paymentRequirements: PaymentRequirements
  ): Promise<string>
}
```

**Dependencies**:
- `HCS10Client` for HCS messaging
- `X402FacilitatorServer` for payment execution
- `A2AProtocol` for agent communication
- `AP2Protocol` for payment negotiation
- `ethers.Wallet` for payment signing

### 3. MeshOrchestrator

**Purpose**: Coordinates all agent interactions and maintains system state.

**Responsibilities**:
- Establish and manage A2A communication channels
- Maintain HCS-10 connections between agents
- Issue tasks to ConsumerAgent
- Verify payment receipts
- Log all events to HCS topic
- Manage system state transitions

**Interface**:
```typescript
class MeshOrchestrator {
  constructor(
    hcsClient: HCS10Client,
    orchestratorId: string,
    meshTopicId: string
  )
  
  // Initialize orchestrator
  async init(): Promise<void>
  
  // Register agent in mesh
  async registerAgent(
    agentId: string,
    agentType: 'consumer' | 'producer'
  ): Promise<void>
  
  // Issue trust score task
  async issueTrustScoreTask(
    consumerAgentId: string,
    targetAccountId: string,
    maxPrice: string
  ): Promise<TaskId>
  
  // Log event to HCS
  async logEvent(event: TrustScoreEvent): Promise<void>
  
  // Verify payment receipt
  async verifyPaymentReceipt(
    paymentTxHash: string,
    expectedAmount: string
  ): Promise<boolean>
  
  // Get system state
  getSystemState(): SystemState
}
```

**Dependencies**:
- `HCS10Client` for HCS messaging
- `HCS10ConnectionManager` for connection management
- `A2AProtocol` for agent communication

### 4. ArkhiaAnalyticsService

**Purpose**: Interface to Arkhia API for Hedera account analytics.

**Responsibilities**:
- Query account information
- Fetch transaction history
- Retrieve token holdings
- Get HCS message history
- Handle API errors and retries
- Cache responses for performance

**Interface**:
```typescript
class ArkhiaAnalyticsService {
  constructor(apiKey: string, network: 'testnet' | 'mainnet')
  
  // Get account information
  async getAccountInfo(accountId: string): Promise<AccountInfo>
  
  // Get transaction history
  async getTransactions(
    accountId: string,
    limit: number
  ): Promise<Transaction[]>
  
  // Get token balances
  async getTokenBalances(accountId: string): Promise<TokenBalance[]>
  
  // Get HCS messages for account
  async getHCSMessages(
    accountId: string,
    topicIds: string[]
  ): Promise<HCSMessage[]>
  
  // Retry with exponential backoff
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number
  ): Promise<T>
}
```

**Dependencies**:
- `axios` for HTTP requests
- `cache` for response caching

### 5. TrustScoreComputationEngine

**Purpose**: Computes trust scores from Arkhia analytics data.

**Responsibilities**:
- Calculate account age score
- Compute transaction diversity score
- Analyze transfer stability/volatility
- Evaluate token health
- Assess HCS interaction quality
- Detect risk flags
- Aggregate component scores

**Interface**:
```typescript
class TrustScoreComputationEngine {
  // Compute complete trust score
  async computeScore(
    accountInfo: AccountInfo,
    transactions: Transaction[],
    tokenBalances: TokenBalance[],
    hcsMessages: HCSMessage[]
  ): Promise<TrustScore>
  
  // Individual component calculations
  private calculateAccountAgeScore(createdAt: number): number
  private calculateDiversityScore(transactions: Transaction[]): number
  private calculateVolatilityScore(transactions: Transaction[]): number
  private calculateTokenHealthScore(balances: TokenBalance[]): number
  private calculateHCSQualityScore(messages: HCSMessage[]): number
  private detectRiskFlags(
    accountInfo: AccountInfo,
    transactions: Transaction[]
  ): RiskFlag[]
  
  // Aggregate scores
  private aggregateScores(components: ScoreComponents): number
}
```

**Dependencies**: None (pure computation)


## Data Models

### TrustScore

```typescript
interface TrustScore {
  account: string              // Hedera account ID (0.0.xxxxx)
  score: number                // Overall score (0-100)
  components: ScoreComponents  // Individual component scores
  riskFlags: RiskFlag[]        // Detected risk patterns
  timestamp: number            // Unix timestamp of computation
}

interface ScoreComponents {
  accountAge: number           // 0-20 points
  diversity: number            // 0-20 points
  volatility: number           // 0-20 points
  tokenHealth: number          // 0-10 points
  hcsQuality: number           // -10 to +10 points
  riskPenalty: number          // -20 to 0 points
}

interface RiskFlag {
  type: 'rapid_outflow' | 'new_account_large_transfer' | 'malicious_interaction'
  severity: 'low' | 'medium' | 'high'
  description: string
  detectedAt: number
}
```

### ProductRegistryEntry

```typescript
interface ProductRegistryEntry {
  productId: string            // e.g., "trustscore.basic.v1"
  version: string              // e.g., "v1"
  name: string                 // Human-readable name
  description: string          // Product description
  producerAgentId: string      // Agent providing the service
  endpoint: string             // API endpoint path
  defaultPrice: string         // Default price in HBAR
  currency: 'HBAR' | 'USDC'    // Payment currency
  network: 'hedera-testnet' | 'hedera-mainnet'
  rateLimit: {
    calls: number              // Max calls
    period: number             // Time period in seconds
  }
  sla: {
    uptime: string             // e.g., "99.9%"
    responseTime: string       // e.g., "< 2s"
  }
  createdAt: number
  updatedAt: number
}
```

### AP2NegotiationRequest

```typescript
interface AP2NegotiationRequest {
  type: 'AP2::NEGOTIATE'
  productId: string            // Product being negotiated
  maxPrice: string             // Maximum price buyer will pay
  currency: 'HBAR' | 'USDC'
  rateLimit: {
    calls: number
    period: number
  }
  metadata: {
    buyerAgentId: string
    timestamp: number
  }
}
```

### AP2Offer

```typescript
interface AP2Offer {
  type: 'AP2::OFFER'
  productId: string
  price: string                // Offered price
  currency: 'HBAR' | 'USDC'
  slippage: string             // e.g., "none", "0.1%"
  rateLimit: {
    calls: number
    period: number
  }
  sla: {
    uptime: string
    responseTime: string
  }
  validUntil: number           // Offer expiration timestamp
  metadata: {
    producerAgentId: string
    timestamp: number
  }
}
```

### TrustScoreEvent

```typescript
type TrustScoreEventType =
  | 'TRUST_NEGOTIATION_STARTED'
  | 'TRUST_NEGOTIATION_AGREED'
  | 'TRUST_COMPUTATION_REQUESTED'
  | 'TRUST_SCORE_DELIVERED'
  | 'PAYMENT_VERIFIED'

interface TrustScoreEvent {
  type: TrustScoreEventType
  eventId: string              // Unique event identifier
  timestamp: number
  data: {
    // Event-specific data
    account?: string           // Target account for scoring
    buyerAgentId?: string      // Consumer agent ID
    producerAgentId?: string   // Producer agent ID
    score?: number             // Computed score
    paymentTxHash?: string     // Payment transaction hash
    amount?: string            // Payment amount
    [key: string]: any
  }
}
```

### PaymentRequirements

```typescript
interface PaymentRequirements {
  scheme: 'exact'
  network: 'hedera-testnet' | 'base-sepolia'
  asset: string                // 'HBAR' or USDC contract address
  payTo: string                // Recipient account/address
  maxAmountRequired: string    // Amount in smallest unit (tinybars/wei)
  resource: string             // Resource path
  description: string          // Payment description
  mimeType: string             // Response content type
  maxTimeoutSeconds: number    // Payment validity period
}
```

### ArkhiaAccountInfo

```typescript
interface ArkhiaAccountInfo {
  account: string
  balance: {
    balance: number            // Balance in tinybars
    timestamp: string
  }
  created_timestamp: string    // Account creation time
  key: {
    _type: string
    key: string
  }
  auto_renew_period: number
  deleted: boolean
  ethereum_nonce: number
  evm_address: string
}
```

### ArkhiaTransaction

```typescript
interface ArkhiaTransaction {
  transaction_id: string
  consensus_timestamp: string
  type: string                 // Transaction type
  result: string               // Transaction result
  transfers: Array<{
    account: string
    amount: number
    is_approval: boolean
  }>
  token_transfers: Array<{
    token_id: string
    account: string
    amount: number
  }>
  memo_base64: string
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: AP2 Negotiation Initiation

*For any* valid Hedera account ID, when a ConsumerAgent requests a trust score, the system should initiate an AP2 negotiation message containing product ID, maximum price, and rate limits.

**Validates: Requirements 1.1, 4.1**

### Property 2: Price Threshold Filtering

*For any* maximum price threshold specified by a ConsumerAgent, the system should only proceed with ProducerAgents offering prices at or below that threshold.

**Validates: Requirements 1.2**

### Property 3: Account ID Format Validation

*For any* input string, the system should accept it as a valid account ID if and only if it matches the Hedera account ID pattern (0.0.xxxxx where x is a digit).

**Validates: Requirements 1.3**

### Property 4: Trust Score Response Completeness

*For any* successfully computed trust score, the response should include score value, component breakdown object, risk flags array, and timestamp.

**Validates: Requirements 1.4, 11.1, 11.2, 11.3, 11.4, 11.5**

### Property 5: Error Message Descriptiveness

*For any* failed trust score request, the system should return an error response containing an error code, descriptive message, and suggested resolution.

**Validates: Requirements 1.5, 15.2**

### Property 6: Arkhia API Call Completeness

*For any* trust score computation request, the system should query Arkhia API for account information, transaction history, and token holdings before computing the score.

**Validates: Requirements 2.1**

### Property 7: Account Age Scoring Monotonicity

*For any* two accounts with different ages, the older account should receive a score greater than or equal to the younger account's score (20 points for >6 months, 10 points for 1-6 months, 3 points for <1 month).

**Validates: Requirements 2.2**

### Property 8: Transaction Diversity Scoring Monotonicity

*For any* two accounts with different numbers of unique counterparties, the account with more unique counterparties should receive a score greater than or equal to the account with fewer counterparties (20 points for ≥25, 10 points for 10-24, 5 points for <10).

**Validates: Requirements 2.3**

### Property 9: Volatility Scoring Inverse Relationship

*For any* account's transaction pattern, higher volatility should result in lower or equal scores compared to lower volatility (20 points for low, 10 points for medium, 3 points for high).

**Validates: Requirements 2.4**

### Property 10: Token Health Scoring

*For any* account with token holdings, if the distribution pattern is healthy (no single token concentration >50% of portfolio), the system should assign 10 points for token health.

**Validates: Requirements 2.5**

### Property 11: HCS Interaction Quality Scoring

*For any* account, interactions with trusted HCS topics should add 10 points and interactions with suspicious topics should subtract 10 points from the HCS quality score.

**Validates: Requirements 2.6**

### Property 12: Risk Flag Penalty Bounds

*For any* detected risk flags (rapid outflows, new account large transfers, malicious interactions), the total risk penalty should be between -20 and 0 points.

**Validates: Requirements 2.7**

### Property 13: Trust Score Bounds

*For any* computed trust score, the final aggregated score should be between 0 and 100 inclusive.

**Validates: Requirements 2.8, 11.2**

### Property 14: Unpaid Request 402 Response

*For any* request to the trust score endpoint without a valid X-PAYMENT header, the system should return HTTP 402 status with payment requirements including asset type, amount, recipient account, and memo.

**Validates: Requirements 3.1**

### Property 15: Payment Verification Before Processing

*For any* request with an X-PAYMENT header, the system should verify the payment through the facilitator before computing the trust score.

**Validates: Requirements 3.2, 5.4**

### Property 16: Successful Payment Score Delivery

*For any* verified payment, the system should compute and return the trust score with payment receipt details.

**Validates: Requirements 3.3, 7.5**

### Property 17: Failed Payment 402 Response

*For any* payment that fails verification, the system should return HTTP 402 status with verification failure reason.

**Validates: Requirements 3.4, 12.5**

### Property 18: Default Price Application

*For any* trust score request without AP2 negotiation, the system should use the default price of 0.3 HBAR unless overridden by negotiated terms.

**Validates: Requirements 3.5**

### Property 19: AP2 Negotiation Message Structure

*For any* negotiation initiated by a ConsumerAgent, the AP2 NEGOTIATE message should include product ID, maximum price, and desired rate limits.

**Validates: Requirements 4.1**

### Property 20: AP2 Offer Response Structure

*For any* negotiation request received by a ProducerAgent, the AP2 OFFER response should include price, slippage tolerance, and SLA terms.

**Validates: Requirements 4.2**

### Property 21: Offer Acceptance Message

*For any* accepted AP2 offer, the system should send an A2A REQUEST_TRUST_SCORE message containing the target account ID.

**Validates: Requirements 4.3**

### Property 22: Negotiated Terms Enforcement

*For any* agreed negotiation terms, all subsequent API calls within the session should enforce those terms (price, rate limits, SLA).

**Validates: Requirements 4.4**

### Property 23: Rate Limit Enforcement

*For any* ConsumerAgent with a negotiated rate limit, when the number of calls exceeds the limit within the time window, the system should return HTTP 429 status.

**Validates: Requirements 4.5, 13.2**

### Property 24: A2A Channel Establishment

*For any* trust score workflow initiation, the system should establish A2A communication channels between ConsumerAgent and ProducerAgent.

**Validates: Requirements 5.1**

### Property 25: HCS-10 Registration Maintenance

*For any* agent interaction, the system should maintain HCS-10 registration and verification for all participants.

**Validates: Requirements 5.2**

### Property 26: Task Issuance Completeness

*For any* trust score request, the MeshOrchestrator should issue a task to the ConsumerAgent containing target account ID and constraints.

**Validates: Requirements 5.3**

### Property 27: State Transition Logging

*For any* system state change, the system should log the transition to HCS with event type, timestamp, and contextual data.

**Validates: Requirements 5.5, 6.6**

### Property 28: Negotiation Start Event

*For any* negotiation initiation, the system should publish a TRUST_NEGOTIATION_STARTED event to the HCS topic.

**Validates: Requirements 6.1**

### Property 29: Negotiation Agreement Event

*For any* successful negotiation completion, the system should publish a TRUST_NEGOTIATION_AGREED event containing the agreed terms.

**Validates: Requirements 6.2**

### Property 30: Computation Request Event

*For any* trust score computation request, the system should publish a TRUST_COMPUTATION_REQUESTED event with the target account ID.

**Validates: Requirements 6.3**

### Property 31: Score Delivery Event Completeness

*For any* delivered trust score, the system should publish a TRUST_SCORE_DELIVERED event including account ID, buyer agent, producer agent, score value, payment transaction hash, and timestamp.

**Validates: Requirements 6.4**

### Property 32: Payment Verification Event

*For any* verified payment, the system should publish a PAYMENT_VERIFIED event with transaction details.

**Validates: Requirements 6.5**

### Property 33: Payment Requirement Extraction

*For any* HTTP 402 response received by ConsumerAgent, the system should extract payment requirements including asset type, amount, and recipient.

**Validates: Requirements 7.1**

### Property 34: Facilitator Call Parameters

*For any* payment initiation, the system should call the payment facilitator with asset type, amount, and recipient account.

**Validates: Requirements 7.2**

### Property 35: Payment Token Receipt

*For any* facilitator payment execution, the system should receive a payment token for inclusion in subsequent requests.

**Validates: Requirements 7.3**

### Property 36: Retry Header Inclusion

*For any* API request retry after payment, the system should include the payment token in the X-PAYMENT header.

**Validates: Requirements 7.4**

### Property 37: Arkhia API Retry Logic

*For any* failed Arkhia API call, the system should retry up to 3 times with exponential backoff before returning an error.

**Validates: Requirements 8.1**

### Property 38: Partial Score on Exhausted Retries

*For any* Arkhia API call where all retries are exhausted, the system should return a partial trust score with available components and indicate which components failed.

**Validates: Requirements 8.2**

### Property 39: Rate Limit Respect

*For any* Arkhia API rate limit error, the system should wait for the specified retry-after period before retrying.

**Validates: Requirements 8.3**

### Property 40: Network Error Handling

*For any* network connectivity issue with Arkhia API, the system should log the error and return a service unavailable response.

**Validates: Requirements 8.4, 15.1**

### Property 41: Cache Staleness Indicator

*For any* cached trust score returned due to Arkhia API unavailability, the response should include a staleness indicator showing cache age.

**Validates: Requirements 8.5**

### Property 42: Product Registry Query Completeness

*For any* product registry query, the system should return complete product information including ID, version, pricing, endpoint, and producer agent ID.

**Validates: Requirements 9.2**

### Property 43: Price Update Propagation

*For any* product pricing change, the system should update the registry and notify all active subscribers.

**Validates: Requirements 9.3**

### Property 44: Rate Limit Tracking

*For any* negotiated rate limit, the system should track API calls per ConsumerAgent per time window.

**Validates: Requirements 13.1**

### Property 45: Rate Limit Counter Reset

*For any* rate limit time window expiration, the system should reset the call counter for that ConsumerAgent.

**Validates: Requirements 13.3**

### Property 46: Default Rate Limit Application

*For any* ConsumerAgent without a negotiated rate limit, the system should apply a default limit of 100 calls per day.

**Validates: Requirements 13.4**

### Property 47: Rate Limit Violation Logging

*For any* repeated rate limit violations, the system should log the violations to HCS for audit purposes.

**Validates: Requirements 13.5**

### Property 48: HCS-10 Connection Establishment

*For any* first interaction between ConsumerAgent and ProducerAgent, the system should establish an HCS-10 connection with connection topic ID.

**Validates: Requirements 14.1**

### Property 49: Connection Detail Recording

*For any* established connection, the system should record both agent IDs, connection topic, and establishment timestamp.

**Validates: Requirements 14.2**

### Property 50: Connection Topic Message Routing

*For any* agent communication, the system should use the established connection topic for message exchange.

**Validates: Requirements 14.3**

### Property 51: Connection Termination Event

*For any* connection termination, the system should publish a connection termination event to HCS.

**Validates: Requirements 14.4**

### Property 52: Connection Status Accuracy

*For any* connection status query, the system should return the current state (established, pending, or terminated).

**Validates: Requirements 14.5**

### Property 53: Error Log Structure

*For any* error occurrence, the system should log the error with timestamp, error type, error message, and stack trace.

**Validates: Requirements 15.1**

### Property 54: Critical Error Alerting

*For any* critical error, the system should send alerts through configured notification channels.

**Validates: Requirements 15.3**

### Property 55: Error Log Context Enrichment

*For any* logged error, the system should include contextual information such as agent IDs, account IDs, and transaction IDs.

**Validates: Requirements 15.4**

### Property 56: Log Query Functionality

*For any* log query with filters (error type, agent ID, time range), the system should return only logs matching all specified filters.

**Validates: Requirements 15.5**

### Property 57: On-Chain Payment Verification

*For any* payment verification, the system should query the Hedera network to confirm transaction existence, amount, recipient, and memo match requirements.

**Validates: Requirements 12.1, 12.2, 12.3, 12.4**


## Error Handling

### Error Categories

1. **Validation Errors** (4xx)
   - Invalid account ID format
   - Invalid price parameters
   - Missing required fields
   - Rate limit exceeded

2. **Payment Errors** (402, 4xx)
   - Payment required
   - Payment verification failed
   - Insufficient payment amount
   - Payment expired

3. **Service Errors** (5xx)
   - Arkhia API unavailable
   - Internal computation error
   - HCS communication failure
   - Database connection error

4. **Network Errors**
   - Timeout errors
   - Connection refused
   - DNS resolution failure

### Error Response Format

```typescript
interface ErrorResponse {
  error: {
    code: string              // Machine-readable error code
    message: string           // Human-readable error message
    details?: any             // Additional error context
    resolution?: string       // Suggested resolution steps
    timestamp: number
  }
}
```

### Error Handling Strategies

**Arkhia API Failures**:
- Retry up to 3 times with exponential backoff (1s, 2s, 4s)
- On exhaustion, return partial score with available components
- Cache last known good scores for up to 1 hour
- Log all failures to HCS for monitoring

**Payment Verification Failures**:
- Return HTTP 402 with detailed failure reason
- Do not compute trust score
- Log verification attempt to HCS
- Provide clear resolution steps to buyer

**Rate Limit Errors**:
- Return HTTP 429 with Retry-After header
- Log violation to HCS if repeated
- Maintain rate limit state across restarts
- Provide current usage in response headers

**Network Connectivity Issues**:
- Log error with full context
- Return HTTP 503 Service Unavailable
- Include estimated recovery time if known
- Fall back to cached data if available

**Critical Errors**:
- Alert operator via configured channels (email, Slack, PagerDuty)
- Log full stack trace and system state
- Attempt graceful degradation
- Prevent cascading failures

### Retry Logic

```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (attempt === maxRetries - 1) throw error
      
      const delay = baseDelay * Math.pow(2, attempt)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  throw new Error('Max retries exceeded')
}
```

### Circuit Breaker Pattern

For Arkhia API calls, implement circuit breaker to prevent cascading failures:

- **Closed**: Normal operation, requests pass through
- **Open**: After 5 consecutive failures, stop sending requests for 60 seconds
- **Half-Open**: After timeout, allow one test request
  - Success → Close circuit
  - Failure → Open circuit again


## Testing Strategy

### Dual Testing Approach

The TrustScore Oracle requires both unit testing and property-based testing to ensure correctness:

- **Unit tests** verify specific examples, edge cases, and error conditions
- **Property tests** verify universal properties that should hold across all inputs
- Together they provide comprehensive coverage: unit tests catch concrete bugs, property tests verify general correctness

### Unit Testing

Unit tests will cover:

**Specific Examples**:
- Trust score computation for known account with expected output
- AP2 negotiation with specific price offers
- x402 payment flow with known payment amounts
- HCS event logging with specific event types

**Edge Cases**:
- Account ID at format boundaries (0.0.0, 0.0.999999999)
- Trust score components at threshold boundaries (exactly 6 months old, exactly 25 counterparties)
- Payment amounts at minimum/maximum values
- Rate limits at exact threshold

**Error Conditions**:
- Invalid account ID formats
- Arkhia API returning errors
- Payment verification failures
- Network timeouts

**Integration Points**:
- Arkhia API mock responses
- x402 facilitator integration
- HCS message publishing
- Agent-to-agent communication

### Property-Based Testing

We will use **fast-check** (TypeScript property-based testing library) to verify universal properties.

**Configuration**:
- Minimum 100 iterations per property test
- Seed-based reproducibility for debugging
- Shrinking enabled to find minimal failing cases

**Property Test Structure**:

```typescript
import fc from 'fast-check'

// Example property test
describe('Trust Score Properties', () => {
  it('Property 13: Trust score bounds', () => {
    fc.assert(
      fc.property(
        // Generators for random inputs
        fc.record({
          accountAge: fc.integer({ min: 0, max: 20 }),
          diversity: fc.integer({ min: 0, max: 20 }),
          volatility: fc.integer({ min: 0, max: 20 }),
          tokenHealth: fc.integer({ min: 0, max: 10 }),
          hcsQuality: fc.integer({ min: -10, max: 10 }),
          riskPenalty: fc.integer({ min: -20, max: 0 })
        }),
        (components) => {
          // Property: final score should be 0-100
          const score = aggregateScores(components)
          return score >= 0 && score <= 100
        }
      ),
      { numRuns: 100 }
    )
  })
})
```

**Property Test Tags**:

Each property-based test MUST be tagged with a comment explicitly referencing the correctness property in the design document:

```typescript
/**
 * Feature: trustscore-oracle, Property 13: Trust Score Bounds
 * For any computed trust score, the final aggregated score should be between 0 and 100 inclusive.
 */
it('Property 13: Trust score bounds', () => { ... })
```

### Test Coverage Requirements

**Minimum Coverage Targets**:
- Line coverage: 80%
- Branch coverage: 75%
- Function coverage: 90%
- Property coverage: 100% (all 57 properties must have tests)

**Critical Paths Requiring 100% Coverage**:
- Trust score computation logic
- Payment verification
- AP2 negotiation
- HCS event logging
- Error handling

### Test Organization

```
tests/
├── unit/
│   ├── trust-score-computation.test.ts
│   ├── arkhia-service.test.ts
│   ├── ap2-negotiation.test.ts
│   ├── payment-verification.test.ts
│   └── hcs-logging.test.ts
├── integration/
│   ├── producer-consumer-flow.test.ts
│   ├── x402-payment-flow.test.ts
│   ├── arkhia-api-integration.test.ts
│   └── hcs-event-flow.test.ts
├── property/
│   ├── trust-score-properties.test.ts
│   ├── negotiation-properties.test.ts
│   ├── payment-properties.test.ts
│   └── rate-limit-properties.test.ts
└── e2e/
    ├── complete-marketplace-flow.test.ts
    └── multi-agent-coordination.test.ts
```

### Mocking Strategy

**Mock Arkhia API**:
- Use `nock` or `msw` for HTTP mocking
- Provide realistic response data
- Simulate various error conditions
- Test rate limiting behavior

**Mock HCS Client**:
- Mock `HCS10Client` methods
- Verify message publishing
- Simulate message retrieval
- Test connection management

**Mock x402 Facilitator**:
- Mock payment verification
- Mock payment settlement
- Simulate payment failures
- Test receipt generation

### Test Data Generators

```typescript
// Generate random Hedera account IDs
const accountIdArbitrary = fc.tuple(
  fc.constant('0.0.'),
  fc.integer({ min: 1, max: 999999999 })
).map(([prefix, num]) => `${prefix}${num}`)

// Generate random trust score components
const scoreComponentsArbitrary = fc.record({
  accountAge: fc.integer({ min: 0, max: 20 }),
  diversity: fc.integer({ min: 0, max: 20 }),
  volatility: fc.integer({ min: 0, max: 20 }),
  tokenHealth: fc.integer({ min: 0, max: 10 }),
  hcsQuality: fc.integer({ min: -10, max: 10 }),
  riskPenalty: fc.integer({ min: -20, max: 0 })
})

// Generate random AP2 negotiation requests
const negotiationRequestArbitrary = fc.record({
  productId: fc.constant('trustscore.basic.v1'),
  maxPrice: fc.double({ min: 0.1, max: 10.0 }).map(n => n.toFixed(1)),
  currency: fc.constantFrom('HBAR', 'USDC'),
  rateLimit: fc.record({
    calls: fc.integer({ min: 1, max: 1000 }),
    period: fc.integer({ min: 60, max: 86400 })
  })
})
```

### Continuous Integration

**CI Pipeline**:
1. Run linter (ESLint)
2. Run type checker (TypeScript)
3. Run unit tests
4. Run property tests
5. Run integration tests
6. Generate coverage report
7. Run E2E tests (on staging environment)

**Test Execution Time Targets**:
- Unit tests: < 30 seconds
- Property tests: < 2 minutes
- Integration tests: < 5 minutes
- E2E tests: < 10 minutes

### Performance Testing

**Load Testing**:
- Simulate 100 concurrent ConsumerAgents
- Test ProducerAgent throughput (target: 50 requests/second)
- Measure response time under load (target: < 2 seconds p95)
- Test rate limiting under high load

**Stress Testing**:
- Test Arkhia API failure scenarios
- Test HCS message queue backlog
- Test payment facilitator overload
- Test database connection pool exhaustion

