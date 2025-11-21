# Phase 2 Implementation Plan

## Overview
Phase 2 implements the core agents and orchestrator for the TrustScore Oracle MVP:
- TrustScoreProducerAgent (with Express API server)
- TrustScoreConsumerAgent (with product discovery and AP2 negotiation)
- MeshOrchestrator (A2A channels, HCS logging, task management)

## Implementation Order

### 1. TrustScoreProducerAgent
**File**: `src/agents/TrustScoreProducerAgent.ts`

**Components**:
- Extends agent pattern (similar to AnalyzerAgent)
- Initializes Express server on configured port
- Integrates existing TrustScoreRoute handler
- Handles AP2 negotiation requests
- Logs events to MeshOrchestrator
- Uses A2AProtocol for agent communication

**Dependencies**:
- HCS10Client
- X402FacilitatorServer
- ArkhiaAnalyticsService
- TrustScoreComputationEngine
- ProductRegistry
- A2AProtocol
- AP2Protocol
- Express (for API server)

### 2. TrustScoreConsumerAgent
**File**: `src/agents/TrustScoreConsumerAgent.ts`

**Components**:
- Extends agent pattern
- Discovers products from ProductRegistry
- Initiates AP2 negotiation with ProducerAgent
- Makes x402 payments via facilitator
- Requests trust scores via HTTP
- Validates responses
- Reports to MeshOrchestrator

**Dependencies**:
- HCS10Client
- X402FacilitatorServer
- ProductRegistry
- A2AProtocol
- AP2Protocol
- Axios (for HTTP requests)

### 3. MeshOrchestrator
**File**: `src/agents/MeshOrchestrator.ts`

**Components**:
- Manages agent registration
- Maintains A2A communication channels
- Issues tasks to agents
- Logs events to HCS topics
- Verifies on-chain payments
- Tracks system state

**Dependencies**:
- HCS10Client
- A2AProtocol
- HCS10ConnectionManager

## Key Integration Points

1. **A2A Communication**: Agents communicate via A2AProtocol over HCS topics
2. **AP2 Negotiation**: Price/rate limit negotiation via AP2Protocol
3. **x402 Payments**: Payment verification via X402FacilitatorServer
4. **HCS Logging**: All events logged to HCS via MeshOrchestrator
5. **Product Registry**: Shared product catalog for discovery

## Testing Strategy

1. Unit tests for each agent class
2. Integration tests for agent interactions
3. E2E tests for complete workflow
4. Property-based tests for correctness properties

