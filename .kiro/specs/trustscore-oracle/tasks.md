# Implementation Plan

- [ ] 1. Set up project structure and core interfaces
  - Create directory structure for TrustScore Oracle components
  - Define TypeScript interfaces for all data models (TrustScore, ProductRegistry, AP2 messages, HCS events)
  - Set up environment configuration for Arkhia API key and network settings
  - _Requirements: All requirements (foundational)_

- [ ] 2. Implement Arkhia Analytics Service
  - Create `ArkhiaAnalyticsService` class with API client initialization
  - Implement `getAccountInfo()` method to fetch account data from Arkhia
  - Implement `getTransactions()` method to fetch transaction history
  - Implement `getTokenBalances()` method to fetch token holdings
  - Implement `getHCSMessages()` method to fetch HCS message history
  - Add retry logic with exponential backoff for API failures
  - Add response caching with 1-hour TTL
  - _Requirements: 2.1, 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ]* 2.1 Write property test for Arkhia retry logic
  - **Property 37: Arkhia API Retry Logic**
  - **Validates: Requirements 8.1**

- [ ]* 2.2 Write property test for partial score on exhausted retries
  - **Property 38: Partial Score on Exhausted Retries**
  - **Validates: Requirements 8.2**

- [ ]* 2.3 Write unit tests for Arkhia service
  - Test successful API calls with mocked responses
  - Test retry behavior on failures
  - Test cache hit/miss scenarios
  - Test rate limit handling
  - _Requirements: 8.1, 8.2, 8.3, 8.5_

- [ ] 3. Implement Trust Score Computation Engine
  - Create `TrustScoreComputationEngine` class
  - Implement `calculateAccountAgeScore()` with 3-tier scoring (20/10/3 points)
  - Implement `calculateDiversityScore()` with unique counterparty counting (20/10/5 points)
  - Implement `calculateVolatilityScore()` with 30-day transaction pattern analysis (20/10/3 points)
  - Implement `calculateTokenHealthScore()` with distribution analysis (10 points)
  - Implement `calculateHCSQualityScore()` with trusted/suspicious topic detection (+10/-10 points)
  - Implement `detectRiskFlags()` for rapid outflows, new account large transfers, malicious interactions
  - Implement `aggregateScores()` to combine components into final 0-100 score
  - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

- [ ]* 3.1 Write property test for account age scoring monotonicity
  - **Property 7: Account Age Scoring Monotonicity**
  - **Validates: Requirements 2.2**

- [ ]* 3.2 Write property test for diversity scoring monotonicity
  - **Property 8: Transaction Diversity Scoring Monotonicity**
  - **Validates: Requirements 2.3**

- [ ]* 3.3 Write property test for volatility scoring inverse relationship
  - **Property 9: Volatility Scoring Inverse Relationship**
  - **Validates: Requirements 2.4**

- [ ]* 3.4 Write property test for trust score bounds
  - **Property 13: Trust Score Bounds**
  - **Validates: Requirements 2.8, 11.2**

- [ ]* 3.5 Write property test for risk flag penalty bounds
  - **Property 12: Risk Flag Penalty Bounds**
  - **Validates: Requirements 2.7**

- [ ]* 3.6 Write unit tests for computation engine
  - Test each scoring component with known inputs
  - Test edge cases at threshold boundaries
  - Test score aggregation
  - Test risk flag detection
  - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

- [ ] 4. Implement Product Registry
  - Create `ProductRegistry` class with in-memory storage
  - Implement `registerProduct()` to add new products
  - Implement `getProduct()` to retrieve product by ID
  - Implement `getAllProducts()` to list all products
  - Implement `updatePrice()` to modify product pricing
  - Implement `deprecateProduct()` to mark products as deprecated
  - Initialize with default "trustscore.basic.v1" product
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [ ]* 4.1 Write property test for product registry query completeness
  - **Property 42: Product Registry Query Completeness**
  - **Validates: Requirements 9.2**

- [ ]* 4.2 Write property test for price update propagation
  - **Property 43: Price Update Propagation**
  - **Validates: Requirements 9.3**

- [ ] 5. Implement TrustScoreProducerAgent
  - Create `TrustScoreProducerAgent` class extending base agent pattern
  - Initialize with HCS10Client, Arkhia service, computation engine, and facilitator
  - Implement `init()` to start Express server on configured port
  - Create REST API route `GET /trustscore/:accountId`
  - Implement x402 payment gate: return 402 if no X-PAYMENT header
  - Implement payment verification using facilitator
  - Implement trust score computation flow: Arkhia query → compute → return JSON
  - Implement AP2 negotiation handler for price/rate limit negotiation
  - Add rate limiting middleware per ConsumerAgent
  - Log all computations to HCS via MeshOrchestrator
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.5, 13.1, 13.2, 13.3, 13.4, 13.5_

- [ ]* 5.1 Write property test for unpaid request 402 response
  - **Property 14: Unpaid Request 402 Response**
  - **Validates: Requirements 3.1**

- [ ]* 5.2 Write property test for payment verification before processing
  - **Property 15: Payment Verification Before Processing**
  - **Validates: Requirements 3.2, 5.4**

- [ ]* 5.3 Write property test for successful payment score delivery
  - **Property 16: Successful Payment Score Delivery**
  - **Validates: Requirements 3.3, 7.5**

- [ ]* 5.4 Write property test for failed payment 402 response
  - **Property 17: Failed Payment 402 Response**
  - **Validates: Requirements 3.4, 12.5**

- [ ]* 5.5 Write property test for rate limit enforcement
  - **Property 23: Rate Limit Enforcement**
  - **Validates: Requirements 4.5, 13.2**

- [ ]* 5.6 Write property test for default rate limit application
  - **Property 46: Default Rate Limit Application**
  - **Validates: Requirements 13.4**

- [ ]* 5.7 Write unit tests for ProducerAgent
  - Test API endpoint with valid/invalid account IDs
  - Test payment verification flow
  - Test rate limiting
  - Test error responses
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 13.2, 13.4_

- [ ] 6. Implement TrustScoreConsumerAgent
  - Create `TrustScoreConsumerAgent` class extending base agent pattern
  - Initialize with HCS10Client, wallet, and facilitator
  - Implement `discoverProducts()` to query product registry
  - Implement `negotiatePrice()` to initiate AP2 negotiation with producer
  - Implement `requestTrustScore()` main method: request → handle 402 → pay → retry → return score
  - Implement `payForAccess()` private method using x402 facilitator
  - Add account ID format validation
  - Add price threshold filtering
  - Report results to MeshOrchestrator
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 4.1, 4.3, 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ]* 6.1 Write property test for AP2 negotiation initiation
  - **Property 1: AP2 Negotiation Initiation**
  - **Validates: Requirements 1.1, 4.1**

- [ ]* 6.2 Write property test for price threshold filtering
  - **Property 2: Price Threshold Filtering**
  - **Validates: Requirements 1.2**

- [ ]* 6.3 Write property test for account ID format validation
  - **Property 3: Account ID Format Validation**
  - **Validates: Requirements 1.3**

- [ ]* 6.4 Write property test for trust score response completeness
  - **Property 4: Trust Score Response Completeness**
  - **Validates: Requirements 1.4, 11.1, 11.2, 11.3, 11.4, 11.5**

- [ ]* 6.5 Write property test for payment requirement extraction
  - **Property 33: Payment Requirement Extraction**
  - **Validates: Requirements 7.1**

- [ ]* 6.6 Write unit tests for ConsumerAgent
  - Test product discovery
  - Test negotiation flow
  - Test payment flow
  - Test account ID validation
  - Test error handling
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 7.1, 7.2, 7.3, 7.4_

- [ ] 7. Implement MeshOrchestrator
  - Create `MeshOrchestrator` class
  - Initialize with HCS10Client and mesh topic ID
  - Implement `registerAgent()` to track ConsumerAgent and ProducerAgent instances
  - Implement `issueTrustScoreTask()` to create tasks for ConsumerAgent
  - Implement `logEvent()` to publish events to HCS topic (TRUST_NEGOTIATION_STARTED, TRUST_NEGOTIATION_AGREED, TRUST_COMPUTATION_REQUESTED, TRUST_SCORE_DELIVERED, PAYMENT_VERIFIED)
  - Implement `verifyPaymentReceipt()` to validate on-chain payment transactions
  - Implement `getSystemState()` to return current orchestrator state
  - Set up A2A communication channels between agents
  - Maintain HCS-10 connections using HCS10ConnectionManager
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 12.1, 12.2, 12.3, 12.4, 14.1, 14.2, 14.3, 14.4, 14.5_

- [ ]* 7.1 Write property test for A2A channel establishment
  - **Property 24: A2A Channel Establishment**
  - **Validates: Requirements 5.1**

- [ ]* 7.2 Write property test for HCS-10 registration maintenance
  - **Property 25: HCS-10 Registration Maintenance**
  - **Validates: Requirements 5.2**

- [ ]* 7.3 Write property test for negotiation start event
  - **Property 28: Negotiation Start Event**
  - **Validates: Requirements 6.1**

- [ ]* 7.4 Write property test for score delivery event completeness
  - **Property 31: Score Delivery Event Completeness**
  - **Validates: Requirements 6.4**

- [ ]* 7.5 Write property test for on-chain payment verification
  - **Property 57: On-Chain Payment Verification**
  - **Validates: Requirements 12.1, 12.2, 12.3, 12.4**

- [ ]* 7.6 Write property test for HCS-10 connection establishment
  - **Property 48: HCS-10 Connection Establishment**
  - **Validates: Requirements 14.1**

- [ ]* 7.7 Write unit tests for MeshOrchestrator
  - Test agent registration
  - Test task issuance
  - Test event logging
  - Test payment verification
  - Test connection management
  - _Requirements: 5.1, 5.2, 5.3, 6.1, 6.4, 12.1, 14.1_

- [ ] 8. Implement AP2 negotiation protocol integration
  - Extend existing `AP2Protocol` class with TrustScore-specific methods
  - Implement `createNegotiationRequest()` for ConsumerAgent
  - Implement `createOffer()` for ProducerAgent
  - Implement `acceptOffer()` for ConsumerAgent
  - Implement term enforcement logic (price, rate limits, SLA)
  - Add negotiation timeout handling
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ]* 8.1 Write property test for AP2 negotiation message structure
  - **Property 19: AP2 Negotiation Message Structure**
  - **Validates: Requirements 4.1**

- [ ]* 8.2 Write property test for AP2 offer response structure
  - **Property 20: AP2 Offer Response Structure**
  - **Validates: Requirements 4.2**

- [ ]* 8.3 Write property test for offer acceptance message
  - **Property 21: Offer Acceptance Message**
  - **Validates: Requirements 4.3**

- [ ]* 8.4 Write property test for negotiated terms enforcement
  - **Property 22: Negotiated Terms Enforcement**
  - **Validates: Requirements 4.4**

- [ ] 9. Implement error handling and logging
  - Create `ErrorHandler` utility class
  - Implement structured error response formatting
  - Implement error logging with context enrichment (agent IDs, account IDs, transaction IDs)
  - Implement critical error alerting (email/Slack/PagerDuty integration)
  - Add circuit breaker for Arkhia API calls
  - Implement log query and filtering functionality
  - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

- [ ]* 9.1 Write property test for error log structure
  - **Property 53: Error Log Structure**
  - **Validates: Requirements 15.1**

- [ ]* 9.2 Write property test for error message descriptiveness
  - **Property 5: Error Message Descriptiveness**
  - **Validates: Requirements 1.5, 15.2**

- [ ]* 9.3 Write property test for error log context enrichment
  - **Property 55: Error Log Context Enrichment**
  - **Validates: Requirements 15.4**

- [ ] 10. Create demo script for complete E2E flow
  - Create `demo/trustscore-oracle-demo.ts` script
  - Initialize MeshOrchestrator, ProducerAgent, and ConsumerAgent
  - Demonstrate product discovery
  - Demonstrate AP2 negotiation
  - Demonstrate trust score request with payment
  - Demonstrate HCS event logging
  - Display all results with formatted output
  - _Requirements: All requirements (demonstration)_

- [ ] 11. Write API documentation
  - Document `/trustscore/:accountId` endpoint specification
  - Document request/response formats with examples
  - Document x402 payment flow with sequence diagrams
  - Document AP2 negotiation protocol
  - Document trust score formula and components
  - Document error codes and resolutions
  - Create TypeScript integration examples
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ] 12. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
