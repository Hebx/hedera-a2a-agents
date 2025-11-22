# TrustScore Oracle - Decentralized Reputation Marketplace for Hedera

[![Branch: ascension](https://img.shields.io/badge/branch-ascension-blue.svg)](https://github.com/Hebx/hedron/tree/ascension)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Hedera](https://img.shields.io/badge/Hedera-Testnet-green.svg)](https://hedera.com)

> **📍 You are viewing the `ascension` branch** - This branch contains the complete TrustScore Oracle implementation, a production-ready decentralized reputation marketplace for Hedera accounts.

---

## 🌟 What is TrustScore Oracle?

**TrustScore Oracle** is a decentralized marketplace service that enables autonomous agents on the Hedera network to buy and sell reputation scores for any Hedera account. It implements a complete **A2A → AP2 → x402 → Analytics → HCS** workflow, enabling fully autonomous agent-to-agent trust assessment.

### Key Features

✅ **Autonomous Agent Workflow** - Complete A2A protocol implementation  
✅ **Dynamic Price Negotiation** - AP2 protocol for agent-to-agent price negotiation  
✅ **Payment-Gated API** - x402 micropayment standard for frictionless access  
✅ **Real-Time Analytics** - Arkhia API integration for live Hedera on-chain data  
✅ **Immutable Audit Trail** - HCS-10 event logging for all transactions  
✅ **Production-Ready** - Comprehensive error handling, retry logic, and testing

---

## 🎯 The Problem We Solve

In a decentralized agent economy, **how do autonomous agents know who to trust?**

- ❌ No standardized way to assess Hedera account reputation
- ❌ Manual reputation checking is slow and expensive
- ❌ Agents need automated trust assessment for autonomous decisions
- ❌ No decentralized marketplace for reputation data

**TrustScore Oracle solves this** by providing a complete autonomous marketplace where agents can discover, negotiate, pay for, and receive trust scores in seconds—all without human intervention.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│              TrustScore Oracle Marketplace                │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────┐      ┌──────────────┐                │
│  │   Producer   │      │   Consumer   │                │
│  │    Agent     │◄────►│    Agent     │                │
│  │              │      │              │                │
│  │ • Computes   │      │ • Discovers  │                │
│  │   Scores     │      │   Products   │                │
│  │ • Sells via  │      │ • Negotiates │                │
│  │   x402 API   │      │ • Pays &     │                │
│  │              │      │   Requests   │                │
│  └──────┬───────┘      └──────┬───────┘                │
│         │                     │                          │
│         └──────────┬──────────┘                          │
│                    │                                     │
│         ┌──────────▼──────────┐                         │
│         │  Mesh Orchestrator  │                         │
│         │  (A2A Coordination  │                         │
│         │   & HCS Logging)    │                         │
│         └──────────┬──────────┘                         │
│                    │                                     │
│  ┌─────────────────▼──────────────────┐                │
│  │  x402 Facilitator  │  Arkhia API   │  HCS-10      │
│  │  (Payments)        │  (Analytics)  │  (Audit)     │
│  └────────────────────────────────────┘                │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

**Complete Workflow:**

1. **Consumer Agent** discovers trust score products via Product Registry
2. **AP2 Negotiation** - Agents negotiate price and terms autonomously
3. **x402 Payment** - Consumer pays via micropayment-gated API
4. **Arkhia Analytics** - Producer fetches real-time Hedera account data
5. **Trust Score Computation** - Score computed from on-chain activity
6. **HCS Logging** - All events logged immutably on Hedera Consensus Service

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Hedera Testnet account with HBAR
- Arkhia API key ([Get one here](https://arkhia.io))

### Installation

```bash
# Clone and switch to ascension branch
git clone https://github.com/Hebx/hedron.git
cd hedron
git checkout ascension

# Install dependencies
npm install

# Build the project
npm run build
```

### Configuration

Create a `.env` file in the project root:

```env
# Hedera Configuration
HEDERA_ACCOUNT_ID=0.0.xxxxx
HEDERA_PRIVATE_KEY=302e...
HEDERA_NETWORK=testnet

# HCS Topics (auto-created by setup script)
HCS_TOPIC_ID=0.0.xxxxx
MESH_TOPIC_ID=0.0.xxxxx

# Arkhia API (REQUIRED)
ARKHIA_API_KEY=your_arkhia_api_key_here

# x402 Payment Configuration
PAYMENT_NETWORK=hedera-testnet
TRUST_SCORE_PRICE=0.3  # Price in HBAR
TRUST_SCORE_PORT=3001  # Producer server port
```

### Setup Agents

```bash
# Register agents and create HCS topics
npm run setup:agents
```

This script automatically:

- Creates Hedera accounts for Producer, Consumer, and Orchestrator agents
- Creates HCS topics for each agent
- Writes all credentials to your `.env` file

### Run the Demo

```bash
# Start the Producer Agent (API server)
npm run demo:trustscore-oracle
```

The Producer Agent will:

- Start an Express server on port 3001
- Register the trust score product
- Listen for trust score requests

In another terminal, use the Consumer Agent:

```typescript
import { TrustScoreConsumerAgent } from "./src/agents/TrustScoreConsumerAgent";
import { X402FacilitatorServer } from "./src/facilitator/X402FacilitatorServer";
import { ProductRegistry } from "./src/marketplace/ProductRegistry";

// Initialize components
const facilitator = new X402FacilitatorServer();
const productRegistry = new ProductRegistry();
const consumer = new TrustScoreConsumerAgent(
  process.env.CONSUMER_AGENT_ID!,
  facilitator,
  productRegistry,
  "http://localhost:3001"
);

await consumer.init();

// Request trust score for an account
const trustScore = await consumer.requestTrustScore("0.0.1234567");

if (trustScore) {
  console.log(`Trust Score: ${trustScore.overallScore}/100`);
  console.log("Components:", trustScore.components);
  console.log("Risk Flags:", trustScore.riskFlags);
}
```

---

## 💡 Real-World Use Cases

### 1. Marketplace Trust Assessment

**Scenario**: A decentralized marketplace where buyer and seller agents need to verify counterparty reputation.

```typescript
// Buyer agent assesses seller before purchase
const trustScore = await consumer.requestTrustScore(sellerAccountId);
if (trustScore.overallScore >= 70) {
  // Proceed with transaction
  await completePurchase();
}
```

**Business Impact:**

- ✅ Reduces fraud risk in marketplace transactions
- ✅ Enables autonomous agent-to-agent commerce
- ✅ Builds trust in decentralized marketplaces

### 2. B2B Credit Assessment

**Scenario**: A lending platform needs to assess borrower creditworthiness.

```typescript
// Assess borrower's on-chain reputation
const score = await consumer.requestTrustScore(borrowerAccountId);
if (score.overallScore < 50 || score.riskFlags.length > 0) {
  // Reject loan application
  rejectLoan();
}
```

**Business Impact:**

- ✅ Enables automated credit decisions
- ✅ Reduces default risk through on-chain analytics
- ✅ Supports DeFi lending protocols

### 3. Supply Chain Vendor Verification

**Scenario**: A procurement system needs to select reliable vendors.

```typescript
// Compare trust scores for multiple vendors
const vendors = ["0.0.vendor1", "0.0.vendor2", "0.0.vendor3"];
const scores = await Promise.all(
  vendors.map((id) => consumer.requestTrustScore(id))
);
const bestVendor = scores.reduce((best, current) =>
  current.overallScore > best.overallScore ? current : best
);
selectVendor(bestVendor);
```

**Business Impact:**

- ✅ Automated vendor selection based on on-chain reputation
- ✅ Reduces supply chain risk
- ✅ Enables autonomous B2B transactions

### 4. Agent-to-Agent Negotiation

**Scenario**: Service providers verify client payment history before offering favorable terms.

```typescript
// Verify client's trust score before negotiation
const trustScore = await consumer.requestTrustScore(clientAccountId);
if (trustScore.overallScore >= 80) {
  // Offer favorable payment terms
  offerFavorableTerms();
}
```

**Business Impact:**

- ✅ Enables autonomous contract negotiation
- ✅ Trust-based pricing and terms
- ✅ Reduces risk in agent-to-agent commerce

---

## 📊 Trust Score Computation

The trust score (0-100) is computed from real Hedera on-chain data via Arkhia API:

### Components

| Component                 | Weight   | Description                                                                            |
| ------------------------- | -------- | -------------------------------------------------------------------------------------- |
| **Account Age**           | 0-20 pts | Rewards established accounts (≥365 days: 20pts, 90-364: 10pts, <90: 3pts)              |
| **Transaction Diversity** | 0-20 pts | Rewards accounts with many unique counterparties (≥20: 20pts, 10-19: 10pts, 5-9: 5pts) |
| **Transfer Volatility**   | 0-20 pts | Rewards stable transaction patterns (CV <0.3: 20pts, 0.3-0.6: 10pts, ≥0.6: 3pts)       |
| **Token Health**          | 0-10 pts | Rewards balanced token distributions                                                   |
| **HCS Quality**           | 0-10 pts | Rewards trusted HCS topic interactions (+2pts each, -5pts for suspicious)              |

### Risk Flags

Risk flags reduce the final score:

- **Rapid Outflow**: -10 points
- **New Account Large Transfer**: -15 points
- **Malicious Interactions**: -20 points

### Example Output

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

---

## 🔌 API Usage

### Direct API Access

The Producer Agent exposes a REST API with x402 payment gating:

```bash
# Step 1: Initial request (returns 402 Payment Required)
curl http://localhost:3001/trustscore/0.0.1234567

# Response:
{
  "error": {
    "code": "PAYMENT_REQUIRED",
    "payment": {
      "network": "hedera-testnet",
      "asset": "HBAR",
      "payTo": "0.0.producer-account",
      "maxAmountRequired": "0.3",
      ...
    }
  }
}

# Step 2: Pay via x402 facilitator (handled by consumer agent)

# Step 3: Retry with X-PAYMENT header
curl -H "X-PAYMENT: <payment-token>" \
     http://localhost:3001/trustscore/0.0.1234567

# Response: 200 OK with trust score
```

### Available Endpoints

- `GET /health` - Health check (free)
- `GET /products` - Product discovery (free)
- `POST /ap2/negotiate` - AP2 price negotiation
- `GET /trustscore/:accountId` - Get trust score (requires x402 payment)

See [API Documentation](./docs/TRUSTSCORE_ORACLE_API.md) for complete details.

---

## 🧪 Testing

### Run Tests

```bash
# All tests
npm run test:all

# TrustScore-specific tests
npm run test:trustscore-integration
npm run test:trustscore-e2e

# Property-based tests
npm run test:property
```

### Test Coverage

- ✅ **Unit Tests**: Core computation logic, agent behavior
- ✅ **Integration Tests**: End-to-end workflow, payment processing
- ✅ **Property-Based Tests**: 10+ correctness properties verified
- ✅ **E2E Tests**: Complete agent-to-agent scenarios

---

## 📚 Documentation

### Core Documentation

- **[User Guide](./docs/TRUSTSCORE_ORACLE_USER_GUIDE.md)** - Complete setup and usage guide
- **[API Reference](./docs/TRUSTSCORE_ORACLE_API.md)** - Full API documentation
- **[Video Pitch Plan](./docs/TRUSTSCORE_ORACLE_VIDEO_PITCH.md)** - Demo script and presentation guide
- **[Verification Report](./docs/TRUSTSCORE_VERIFICATION_REPORT.md)** - Technical verification and testing

### Implementation Details

- **[PRD](./prd.md)** - Product requirements document
- **[Implementation Summary](./docs/TRUSTSCORE_IMPLEMENTATION_SUMMARY.md)** - Development progress

---

## 🏆 Technical Highlights

### What Makes This Production-Ready?

✅ **Complete Protocol Implementation**

- Full A2A protocol for agent communication
- AP2 negotiation for dynamic pricing
- x402 payment standard for micropayments

✅ **Real Integration**

- Actual Arkhia API integration (not mocked)
- Real Hedera Testnet transactions
- HCS-10 event logging on-chain

✅ **Comprehensive Testing**

- Property-based tests (10+ properties)
- Integration tests with real APIs
- E2E tests for complete workflows

✅ **Production Quality**

- Error handling and retry logic
- Circuit breakers for API failures
- Rate limiting and payment verification
- Complete audit trails

✅ **Developer Experience**

- TypeScript with full type safety
- Comprehensive documentation
- Easy setup with automated scripts

---

## 🎬 Live Demo

Watch the complete workflow in action:

1. **Start Producer Agent**

   ```bash
   npm run demo:trustscore-oracle
   ```

2. **Request Trust Score** (via Consumer Agent)
   - Product discovery
   - AP2 negotiation
   - x402 payment processing
   - Trust score computation
   - HCS event logging

3. **View Results**
   - Trust score breakdown
   - Component analysis
   - Risk flag detection
   - Payment verification

See [Video Pitch Plan](./docs/TRUSTSCORE_ORACLE_VIDEO_PITCH.md) for complete demo script.

---

## 🏗️ Project Structure

```
hedron/
├── src/
│   ├── agents/
│   │   ├── TrustScoreProducerAgent.ts    # Producer agent (API server)
│   │   ├── TrustScoreConsumerAgent.ts    # Consumer agent (buyer)
│   │   └── MeshOrchestrator.ts           # A2A coordination
│   ├── services/
│   │   └── analytics/
│   │       ├── ArkhiaAnalyticsService.ts      # Arkhia API client
│   │       └── TrustScoreComputationEngine.ts # Score computation
│   ├── resource-server/
│   │   └── routes/
│   │       └── trustScoreRoute.ts        # x402 API endpoint
│   ├── facilitator/
│   │   └── X402FacilitatorServer.ts      # Payment facilitator
│   └── marketplace/
│       └── ProductRegistry.ts            # Product catalog
├── tests/
│   ├── unit/                             # Unit tests
│   ├── integration/                      # Integration tests
│   ├── e2e/                              # End-to-end tests
│   └── property/                         # Property-based tests
├── demo/
│   └── trustscore-oracle-demo.ts         # Complete demo
└── docs/
    ├── TRUSTSCORE_ORACLE_USER_GUIDE.md
    ├── TRUSTSCORE_ORACLE_API.md
    └── TRUSTSCORE_ORACLE_VIDEO_PITCH.md
```

---

## 🔄 Complete Workflow Example

```typescript
// 1. Initialize Consumer Agent
const consumer = new TrustScoreConsumerAgent(
  agentId,
  facilitator,
  productRegistry,
  "http://localhost:3001"
);
await consumer.init();

// 2. Discover Products
const products = await consumer.discoverProducts();
console.log("Available products:", products);

// 3. Negotiate Price (optional)
const offer = await consumer.negotiatePrice(
  "trustscore.basic.v1",
  "http://localhost:3001"
);
console.log("Negotiated offer:", offer);

// 4. Request Trust Score (handles payment automatically)
const trustScore = await consumer.requestTrustScore("0.0.1234567");

if (trustScore) {
  console.log(`Trust Score: ${trustScore.overallScore}/100`);
  console.log("Components:", trustScore.components);
  console.log("Risk Flags:", trustScore.riskFlags);
}
```

**What happens under the hood:**

1. Consumer discovers product via Product Registry
2. AP2 negotiation establishes price and terms
3. Consumer creates payment authorization
4. x402 facilitator verifies and settles payment
5. Producer fetches data from Arkhia API
6. Trust score computed from on-chain analytics
7. All events logged to HCS via MeshOrchestrator
8. Trust score returned to consumer

---

## 🌐 Network Support

- **Hedera Testnet** - Primary development environment
- **Hedera Mainnet** - Production deployments (ready)

**Payment Networks:**

- Hedera Testnet (HBAR native)
- Base Sepolia (USDC via EVM)

---

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines in the documentation.

---

## 📄 License

ISC License - see LICENSE file for details.

---

## 🔗 Links

- **GitHub Repository**: [github.com/Hebx/hedron](https://github.com/Hebx/hedron)
- **This Branch**: [ascension branch](https://github.com/Hebx/hedron/tree/ascension)
- **Documentation**: See `docs/` directory
- **Issues**: [GitHub Issues](https://github.com/Hebx/hedron/issues)

---

## 🎯 What's Next?

### Ready for Production Use

✅ Complete A2A → AP2 → x402 → Analytics → HCS workflow  
✅ Real Arkhia API integration  
✅ Comprehensive testing (property-based, integration, E2E)  
✅ Production-ready error handling  
✅ Complete documentation

### Future Enhancements

- Mainnet deployment
- Additional analytics providers
- Enhanced scoring algorithms
- Multi-currency support
- Agent marketplace expansion

---

## 🙏 Acknowledgments

Built for the **Hedera Africa Hackathon** as part of the Hedron SDK project.

**Key Technologies:**

- Hedera Hashgraph (HCS, HTS)
- Arkhia Analytics API
- x402 Payment Standard
- Google A2A Protocol
- AP2 Payment Negotiation

---

**TrustScore Oracle** - _Decentralized reputation marketplace for autonomous agents on Hedera._

**Branch**: `ascension` | **Status**: ✅ Production-Ready | **Version**: 1.0.0

---

<div align="center">

**Ready to use?** [Get Started](#-quick-start) | [View Documentation](./docs/TRUSTSCORE_ORACLE_USER_GUIDE.md) | [Try the Demo](#-live-demo)

</div>
