# Architecture Document

## Hedera A2A Agent System

### Document Information

- **Version**: 1.0.0
- **Date**: December 2024
- **Status**: Implementation Complete

---

## 1. System Overview

The Hedera A2A Agent System is a distributed multi-agent architecture that enables autonomous transaction processing through specialized agents communicating via Hedera Consensus Service (HCS). The system implements a three-stage pipeline: Analysis → Verification → Settlement.

### 1.1 High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  AnalyzerAgent  │───▶│  VerifierAgent  │───▶│ SettlementAgent │
│                 │    │                 │    │                 │
│ • Query Accounts│    │ • Validate      │    │ • Execute       │
│ • Analyze Data  │    │ • Approve/Reject│    │ • Record        │
│ • Propose       │    │ • Send Results  │    │ • Notify        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │ Hedera Consensus│
                    │ Service (HCS)   │
                    │                 │
                    │ • Topic 1       │
                    │ • Topic 2       │
                    │ • Topic 3       │
                    └─────────────────┘
```

---

## 2. Core Components

### 2.1 Agent Architecture

Each agent follows a consistent architectural pattern:

```typescript
class AgentBase {
  private hcsClient: HCS10Client;
  private credentials: AgentCredentials;

  constructor() {
    // Initialize credentials from environment
    // Setup HCS client
    // Configure message handlers
  }

  async init(): Promise<void> {
    // Start message polling
    // Initialize agent-specific functionality
  }

  private startMessagePolling(topicId: string): void {
    // Poll for messages every 5 seconds
    // Parse and route messages
    // Handle errors gracefully
  }
}
```

### 2.2 Communication Layer

#### 2.2.1 Hedera Consensus Service (HCS)

- **Protocol**: HCS-10 Standard for agent registration
- **Message Format**: JSON over HCS topics
- **Polling Strategy**: 5-second intervals
- **Error Handling**: Exponential backoff with fallback

#### 2.2.2 Topic Structure

```
AnalyzerAgent Topic (Inbound)
├── Receives: Analysis requests
└── Sends: Analysis proposals

VerifierAgent Topic (Inbound)
├── Receives: Analysis proposals
└── Sends: Verification results

SettlementAgent Topic (Inbound)
├── Receives: Verification results
└── Sends: Settlement confirmations
```

---

## 3. Agent Specifications

### 3.1 AnalyzerAgent

#### 3.1.1 Responsibilities

- Query Hedera account information
- Analyze account balances against thresholds
- Generate analysis proposals
- Support multiple query methods (SDK + Mirror Node)

#### 3.1.2 Technical Implementation

```typescript
export class AnalyzerAgent {
  private hcsClient: HCS10Client;
  private hederaClient: Client;
  private readonly MIRROR_NODE_URL = "https://testnet.mirrornode.hedera.com";

  async queryAccount(accountId: string): Promise<AccountInfo> {
    // Primary: Hedera SDK AccountInfoQuery
    // Fallback: Mirror Node API
    // Returns: Balance, key, metadata
  }

  async queryAccountViaMirror(accountId: string): Promise<any> {
    // HTTP GET to Mirror Node
    // Returns: Extended account data
  }
}
```

#### 3.1.3 Data Flow

1. **Input**: Account ID string
2. **Processing**: Query account via SDK or Mirror Node
3. **Analysis**: Compare balance against threshold
4. **Output**: Analysis proposal with approval recommendation

### 3.2 VerifierAgent

#### 3.2.1 Responsibilities

- Receive and validate analysis proposals
- Apply business logic for approval decisions
- Send verification results to SettlementAgent
- Support custom message handlers

#### 3.2.2 Technical Implementation

```typescript
export class VerifierAgent {
  private hcsClient: HCS10Client;
  private messageHandlers: Map<string, Function>;

  private async validateProposal(proposal: AnalysisProposal): Promise<void> {
    // Apply business rules
    // Generate approval/rejection decision
    // Send result to SettlementAgent
  }

  onMessage(type: string, handler: Function): void {
    // Register custom message handlers
    // Enable extensible message processing
  }
}
```

#### 3.2.3 Business Logic

- **Approval Criteria**: `proposal.meetsThreshold === true`
- **Reasoning**: Detailed explanation of decision
- **Routing**: Approved proposals → SettlementAgent
- **Rejection**: Logged but not forwarded

### 3.3 SettlementAgent

#### 3.3.1 Responsibilities

- Listen for verification results
- Execute x402 payments when approved
- Record settlement completion on HCS
- Handle multi-chain payment execution

#### 3.3.2 Technical Implementation

```typescript
export class SettlementAgent {
  private hcsClient: HCS10Client;
  private provider: JsonRpcProvider;
  private wallet: Wallet;
  private x402Utils: typeof x402Utils;

  private async executeSettlement(
    verification: VerificationResult
  ): Promise<void> {
    // Create x402 payment requirements
    // Execute payment via a2a-x402
    // Record settlement on HCS
  }

  private async recordSettlement(
    txHash: string,
    amount: number
  ): Promise<void> {
    // Create settlement record
    // Broadcast to HCS topic
    // Confirm completion
  }
}
```

#### 3.3.3 Payment Flow

1. **Receive**: Verification result with approval
2. **Create**: x402 payment requirements
3. **Execute**: Payment via Base Sepolia network
4. **Record**: Settlement completion on HCS

---

## 4. Data Models

### 4.1 Core Interfaces

#### 4.1.1 Account Information

```typescript
interface AccountInfo {
  accountId: string;
  balance: string;
  key: string;
  isDeleted: boolean;
  autoRenewPeriod: string;
}
```

#### 4.1.2 Analysis Proposal

```typescript
interface AnalysisProposal {
  type: "analysis_proposal";
  accountId: string;
  balance: string;
  threshold: number;
  meetsThreshold: boolean;
  timestamp: number;
}
```

#### 4.1.3 Verification Result

```typescript
interface VerificationResult {
  type: "verification_result";
  originalProposal: AnalysisProposal;
  approved: boolean;
  reasoning: string;
  timestamp: number;
}
```

#### 4.1.4 Settlement Record

```typescript
interface SettlementRecord {
  type: "settlement_complete";
  txHash: string;
  amount: string;
  timestamp: number;
}
```

### 4.2 Message Flow

```
1. Analysis Request
   ┌─────────────────┐
   │ Account ID      │
   └─────────────────┘
            │
            ▼
2. Analysis Proposal
   ┌─────────────────┐
   │ • Account ID    │
   │ • Balance       │
   │ • Threshold     │
   │ • Meets Threshold│
   └─────────────────┘
            │
            ▼
3. Verification Result
   ┌─────────────────┐
   │ • Original      │
   │ • Approved      │
   │ • Reasoning     │
   └─────────────────┘
            │
            ▼
4. Settlement Execution
   ┌─────────────────┐
   │ • x402 Payment  │
   │ • Transaction   │
   │ • Completion    │
   └─────────────────┘
```

---

## 5. Network Integration

### 5.1 Hedera Hashgraph Integration

#### 5.1.1 HCS-10 Standard

- **Agent Registration**: Automated account and topic creation
- **Message Broadcasting**: Immutable consensus-based messaging
- **Credential Management**: Secure key generation and storage

#### 5.1.2 SDK Integration

```typescript
// Hedera SDK Client Setup
const client = Client.forTestnet();
client.setOperator(AccountId.fromString(accountId), privateKey);

// Account Query
const accountInfo = await new AccountInfoQuery()
  .setAccountId(accountId)
  .execute(client);
```

### 5.2 Ethereum-Compatible Integration

#### 5.2.1 Base Sepolia Network

- **RPC Endpoint**: https://sepolia.base.org
- **Token Standard**: ERC-20 USDC
- **Gas Management**: Automatic gas estimation

#### 5.2.2 x402 Payment Protocol

```typescript
const requirements = {
  scheme: "exact" as const,
  network: "base-sepolia" as const,
  asset: USDC_CONTRACT_ADDRESS,
  payTo: MERCHANT_WALLET_ADDRESS,
  maxAmountRequired: "10000000", // 10 USDC
  resource: "/agent-settlement",
  description: "A2A agent settlement",
  mimeType: "application/json",
  maxTimeoutSeconds: 120,
};

const paymentPayload = await processPayment(requirements, wallet);
```

---

## 6. Security Architecture

### 6.1 Credential Management

#### 6.1.1 Private Key Security

- **Storage**: Environment variables only
- **Formats**: Support for DER, ED25519, ECDSA
- **Fallback**: Main account credentials for testing
- **Generation**: Automated during agent registration

#### 6.1.2 Access Control

- **Agent Isolation**: Each agent has unique credentials
- **Topic Permissions**: Agents can only access assigned topics
- **Transaction Signing**: All operations cryptographically signed

### 6.2 Error Handling

#### 6.2.1 Graceful Degradation

```typescript
// Fallback mechanism for credential issues
if (privateKey.startsWith("placeholder-key-for-")) {
  console.warn("Using placeholder private key");
  // Fallback to main account credentials
  this.hcsClient = new HCS10Client(mainAccountId, mainPrivateKey, "testnet");
}
```

#### 6.2.2 Comprehensive Logging

- **Success Operations**: Detailed success logging
- **Error Conditions**: Comprehensive error reporting
- **Debug Information**: Verbose logging for troubleshooting

---

## 7. Deployment Architecture

### 7.1 Environment Configuration

#### 7.1.1 Required Environment Variables

```bash
# Hedera Configuration
HEDERA_ACCOUNT_ID=0.0.123456
HEDERA_PRIVATE_KEY=your_private_key

# Agent Credentials (Auto-generated)
ANALYZER_AGENT_ID=0.0.789012
ANALYZER_TOPIC_ID=0.0.345678
ANALYZER_PRIVATE_KEY=agent_private_key

# Settlement Configuration
BASE_RPC_URL=https://sepolia.base.org
SETTLEMENT_WALLET_PRIVATE_KEY=wallet_private_key
USDC_CONTRACT=0x036CbD53842c5426634e7929541eC2318f3dCF7e
MERCHANT_WALLET_ADDRESS=0x1234567890123456789012345678901234567890
```

### 7.2 Deployment Process

#### 7.2.1 Agent Registration

```bash
# 1. Setup environment
cp env.example .env
# Edit .env with your credentials

# 2. Register agents
npx tsx setup/register-agents.ts

# 3. Test individual agents
npm run test:analyzer
npm run test:verifier
npm run test:settlement

# 4. Run complete demo
npm run demo
```

#### 7.2.2 Production Considerations

- **Monitoring**: HCS topic monitoring via HashScan
- **Scaling**: Horizontal agent instance scaling
- **Backup**: Credential backup and recovery procedures
- **Updates**: Rolling agent updates without downtime

---

## 8. Performance Characteristics

### 8.1 Latency Profiles

#### 8.1.1 Message Processing

- **Polling Interval**: 5 seconds
- **Message Parsing**: <100ms
- **Business Logic**: <1 second
- **HCS Broadcasting**: 2-5 seconds

#### 8.1.2 End-to-End Processing

- **Account Query**: 1-3 seconds
- **Analysis**: <1 second
- **Verification**: <1 second
- **Settlement**: 30-120 seconds (payment dependent)

### 8.2 Throughput Characteristics

#### 8.2.1 Concurrent Processing

- **Message Polling**: Non-blocking async operations
- **Agent Independence**: Parallel agent execution
- **HCS Capacity**: High-throughput consensus service

#### 8.2.2 Resource Utilization

- **Memory**: Minimal footprint per agent
- **CPU**: Low CPU usage for polling operations
- **Network**: Efficient HCS message batching

---

## 9. Monitoring and Observability

### 9.1 Logging Strategy

#### 9.1.1 Structured Logging

```typescript
console.log(chalk.green("✓ Payment complete"), txHash);
console.log(chalk.yellow("→ Recording settlement on HCS"));
console.error("❌ Error executing settlement:", error);
```

#### 9.1.2 Log Levels

- **INFO**: Normal operations and status updates
- **WARN**: Non-critical issues and fallbacks
- **ERROR**: Critical failures and exceptions
- **DEBUG**: Detailed debugging information

### 9.2 Monitoring Points

#### 9.2.1 HCS Topic Monitoring

- **HashScan Integration**: Real-time topic monitoring
- **Message Counts**: Track message volume and patterns
- **Error Rates**: Monitor failed message processing

#### 9.2.2 Agent Health Monitoring

- **Initialization Status**: Agent startup success/failure
- **Message Processing**: Success/failure rates
- **Payment Execution**: Settlement success rates

---

## 10. Future Architecture Considerations

### 10.1 Scalability Enhancements

#### 10.1.1 Horizontal Scaling

- **Agent Instances**: Multiple instances per agent type
- **Load Balancing**: Distribute messages across instances
- **Topic Partitioning**: Split high-volume topics

#### 10.1.2 Performance Optimization

- **Message Batching**: Batch multiple messages per poll
- **Caching**: Cache frequently accessed data
- **Async Processing**: Non-blocking message handling

### 10.2 Integration Extensions

#### 10.2.1 Multi-Chain Support

- **Additional Networks**: Support for more EVM chains
- **Cross-Chain**: Native cross-chain asset transfers
- **Bridge Integration**: Connect to existing bridge protocols

#### 10.2.2 Advanced Features

- **Machine Learning**: AI-powered decision making
- **Privacy**: Zero-knowledge proof integration
- **Governance**: Decentralized parameter management

---

## 11. Conclusion

The Hedera A2A Agent System architecture provides a robust, scalable, and secure foundation for autonomous agent operations. The modular design enables independent agent development while maintaining consistent communication patterns through HCS.

The architecture successfully balances decentralization with performance, providing a solid foundation for future enhancements and scaling. The comprehensive error handling and monitoring capabilities ensure reliable operation in production environments.

Key architectural strengths:

- **Modularity**: Independent agent development and deployment
- **Scalability**: Horizontal scaling capabilities
- **Security**: Comprehensive credential management
- **Reliability**: Robust error handling and fallback mechanisms
- **Observability**: Comprehensive logging and monitoring

This architecture serves as a blueprint for building sophisticated multi-agent systems on Hedera Hashgraph, demonstrating the power of consensus-based agent communication in decentralized applications.
