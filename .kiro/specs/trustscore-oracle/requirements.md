# Requirements Document

## Introduction

The Hedron TrustScore Oracle is a marketplace service that enables autonomous agents on the Hedera network to purchase and consume trust/reputation scores for any Hedera account. This system provides a decentralized, verifiable, and auditable reputation layer for the Hedera ecosystem, allowing agents to make informed decisions about counterparties before engaging in transactions.

The TrustScore Oracle integrates multiple protocols and services:
- **Hedron SDK** for autonomous agent framework and A2A messaging
- **AP2 Protocol** for payment negotiation between buyer and producer agents
- **x402 Payment Standard** for micropayment-gated API access
- **Arkhia Analytics API** for comprehensive Hedera account data
- **HCS-10 OpenConvAI** for immutable audit trails and connection management

The MVP delivers a complete agent-to-agent marketplace where a ConsumerAgent can discover, negotiate with, pay, and receive trust scores from a TrustScoreProducerAgent, with all interactions logged immutably on-chain.

## Glossary

- **TrustScore**: A numerical reputation score (0-100) computed from on-chain Hedera account activity
- **ProducerAgent**: An autonomous agent that computes and sells trust scores using Arkhia API data
- **ConsumerAgent**: An autonomous agent that purchases trust scores for risk assessment
- **MeshOrchestrator**: The coordination layer managing agent interactions, HCS logging, and system state
- **Arkhia API**: Hedera network analytics service providing account, transaction, and token data
- **AP2 Protocol**: Agent-to-agent payment negotiation protocol
- **x402 Standard**: HTTP 402 payment-required protocol for micropayment-gated APIs
- **HCS-10**: Hedera Consensus Service standard for agent connections and transaction approval
- **Trust Components**: Individual metrics (account age, diversity, volatility, token health, HCS quality, risk flags) that comprise the final trust score
- **Payment Facilitator**: Service that verifies and settles x402 payments on Hedera
- **Product Registry**: Catalog of available trust score products with pricing and terms
- **Rate Limit**: Maximum number of API calls allowed per time period
- **SLA**: Service Level Agreement defining uptime and performance guarantees

## Requirements

### Requirement 1

**User Story:** As a ConsumerAgent, I want to request trust scores for Hedera accounts, so that I can assess counterparty risk before engaging in transactions.

#### Acceptance Criteria

1. WHEN a ConsumerAgent requests a trust score for a valid Hedera account ID THEN the system SHALL initiate an AP2 negotiation with the ProducerAgent
2. WHEN the ConsumerAgent specifies a maximum price threshold THEN the system SHALL only proceed with producers offering prices at or below that threshold
3. WHEN a trust score request is initiated THEN the system SHALL validate the target account ID format matches Hedera account ID pattern (0.0.xxxxx)
4. WHEN the ConsumerAgent receives a trust score response THEN the system SHALL include the score value, component breakdown, risk flags, and timestamp
5. WHEN a trust score request fails THEN the system SHALL return a descriptive error message indicating the failure reason

### Requirement 2

**User Story:** As a ProducerAgent, I want to compute trust scores using Arkhia analytics data, so that I can provide accurate reputation assessments to buyers.

#### Acceptance Criteria

1. WHEN the ProducerAgent receives a trust score request THEN the system SHALL query Arkhia API for account information, transaction history, and token holdings
2. WHEN computing account age score THEN the system SHALL assign 20 points for accounts older than 6 months, 10 points for 1-6 months, and 3 points for accounts less than 1 month old
3. WHEN computing transaction diversity score THEN the system SHALL count unique counterparties and assign 20 points for 25 or more unique accounts, 10 points for 10-24 accounts, and 5 points for fewer than 10 accounts
4. WHEN computing transfer stability score THEN the system SHALL analyze transaction patterns over 30 days and assign 20 points for low volatility, 10 points for medium volatility, and 3 points for high volatility
5. WHEN computing token health score THEN the system SHALL evaluate token distribution and assign 10 points for healthy distribution patterns
6. WHEN computing HCS interaction quality THEN the system SHALL assign 10 points for interactions with trusted topics and subtract 10 points for interactions with suspicious topics
7. WHEN detecting risk flags THEN the system SHALL subtract up to 20 points for rapid outflows, new accounts with large transfers, or interactions with known malicious accounts
8. WHEN all components are computed THEN the system SHALL aggregate scores into a final value between 0 and 100

### Requirement 3

**User Story:** As a ProducerAgent, I want to protect my trust score API with x402 payment requirements, so that I can monetize my analytics service.

#### Acceptance Criteria

1. WHEN an unpaid request arrives at the trust score endpoint THEN the system SHALL return HTTP 402 status with payment requirements including asset type, amount, recipient account, and memo
2. WHEN a paid request arrives with valid X-PAYMENT header THEN the system SHALL verify the payment through the facilitator before processing the request
3. WHEN payment verification succeeds THEN the system SHALL compute and return the trust score with payment receipt details
4. WHEN payment verification fails THEN the system SHALL return HTTP 402 status with payment verification failure reason
5. WHEN the default price is 0.3 HBAR THEN the system SHALL accept this amount unless modified through AP2 negotiation

### Requirement 4

**User Story:** As a ConsumerAgent and ProducerAgent, I want to negotiate pricing and terms via AP2 protocol, so that we can agree on fair market rates for trust score services.

#### Acceptance Criteria

1. WHEN the ConsumerAgent initiates negotiation THEN the system SHALL send an AP2 NEGOTIATE message including product ID, maximum price, and desired rate limits
2. WHEN the ProducerAgent receives a negotiation request THEN the system SHALL respond with an AP2 OFFER message including price, slippage tolerance, and SLA terms
3. WHEN the ConsumerAgent accepts an offer THEN the system SHALL send an A2A REQUEST_TRUST_SCORE message with the target account ID
4. WHEN negotiation terms are agreed THEN the system SHALL enforce those terms for subsequent API calls within the session
5. WHEN rate limits are specified THEN the system SHALL track and enforce the maximum calls per time period

### Requirement 5

**User Story:** As a MeshOrchestrator, I want to coordinate all agent interactions and maintain system state, so that the marketplace operates reliably and transparently.

#### Acceptance Criteria

1. WHEN a trust score workflow begins THEN the system SHALL establish A2A communication channels between ConsumerAgent and ProducerAgent
2. WHEN agents interact THEN the system SHALL maintain HCS-10 registration and verification for all participants
3. WHEN a trust score is requested THEN the system SHALL issue tasks to the ConsumerAgent with target account ID and constraints
4. WHEN payment is completed THEN the system SHALL verify payment receipts before allowing score delivery
5. WHEN system state changes occur THEN the system SHALL transition states appropriately and log all transitions

### Requirement 6

**User Story:** As a MeshOrchestrator, I want to log all trust score interactions to HCS, so that there is an immutable audit trail of marketplace activity.

#### Acceptance Criteria

1. WHEN a negotiation starts THEN the system SHALL publish a TRUST_NEGOTIATION_STARTED event to the HCS topic
2. WHEN negotiation completes successfully THEN the system SHALL publish a TRUST_NEGOTIATION_AGREED event with agreed terms
3. WHEN a trust score computation is requested THEN the system SHALL publish a TRUST_COMPUTATION_REQUESTED event with target account ID
4. WHEN a trust score is delivered THEN the system SHALL publish a TRUST_SCORE_DELIVERED event including account ID, buyer agent, producer agent, score value, payment transaction hash, and timestamp
5. WHEN payment is verified THEN the system SHALL publish a PAYMENT_VERIFIED event with transaction details
6. WHEN any event is published THEN the system SHALL include event type, relevant identifiers, timestamp, and all contextual data necessary for audit purposes

### Requirement 7

**User Story:** As a ConsumerAgent, I want to pay for trust scores using x402 micropayments, so that I can access the service without complex payment setup.

#### Acceptance Criteria

1. WHEN the ConsumerAgent receives a 402 response THEN the system SHALL extract payment requirements from the response headers
2. WHEN initiating payment THEN the system SHALL call the payment facilitator with asset type, amount, and recipient account
3. WHEN the facilitator signs and sends payment THEN the system SHALL receive a payment token
4. WHEN retrying the API request THEN the system SHALL include the payment token in the X-PAYMENT header
5. WHEN payment is successful THEN the system SHALL receive the trust score response with payment receipt

### Requirement 8

**User Story:** As a system administrator, I want the ProducerAgent to handle Arkhia API failures gracefully, so that temporary service issues do not crash the agent.

#### Acceptance Criteria

1. WHEN an Arkhia API call fails THEN the system SHALL retry up to 3 times with exponential backoff
2. WHEN all retries are exhausted THEN the system SHALL return a partial trust score with available components and indicate which components failed
3. WHEN Arkhia API returns rate limit errors THEN the system SHALL wait for the specified retry-after period before retrying
4. WHEN network connectivity issues occur THEN the system SHALL log the error and return a service unavailable response to the buyer
5. WHEN Arkhia API is completely unavailable THEN the system SHALL cache the last known good scores for up to 1 hour and return cached data with a staleness indicator

### Requirement 9

**User Story:** As a ProducerAgent, I want to maintain a product registry, so that ConsumerAgents can discover available trust score products and their pricing.

#### Acceptance Criteria

1. WHEN the product registry is initialized THEN the system SHALL include product ID, version, default pricing, endpoint path, and producer agent ID
2. WHEN a ConsumerAgent queries available products THEN the system SHALL return the complete product registry with current pricing and terms
3. WHEN product pricing changes THEN the system SHALL update the registry and notify active subscribers
4. WHEN new product versions are released THEN the system SHALL maintain backward compatibility with existing versions for at least 30 days
5. WHEN a product is deprecated THEN the system SHALL provide 14 days notice before removal from the registry

### Requirement 10

**User Story:** As a developer integrating the TrustScore Oracle, I want comprehensive API documentation and examples, so that I can quickly integrate trust scoring into my applications.

#### Acceptance Criteria

1. WHEN accessing API documentation THEN the system SHALL provide endpoint specifications, request/response formats, and authentication requirements
2. WHEN viewing examples THEN the system SHALL include code samples for ConsumerAgent integration in TypeScript
3. WHEN reviewing trust score components THEN the system SHALL document the formula, weighting, and data sources for each component
4. WHEN understanding payment flows THEN the system SHALL provide sequence diagrams showing x402 payment integration
5. WHEN troubleshooting errors THEN the system SHALL document all error codes, their meanings, and resolution steps

### Requirement 11

**User Story:** As a ConsumerAgent, I want to receive trust scores in a standardized JSON format, so that I can easily parse and use the data in my decision-making logic.

#### Acceptance Criteria

1. WHEN a trust score is returned THEN the system SHALL include the target account ID in the response
2. WHEN a trust score is returned THEN the system SHALL include the overall score value between 0 and 100
3. WHEN a trust score is returned THEN the system SHALL include a components object with individual scores for account age, diversity, volatility, token health, HCS quality, and risk penalty
4. WHEN a trust score is returned THEN the system SHALL include an array of risk flags describing any detected suspicious patterns
5. WHEN a trust score is returned THEN the system SHALL include a Unix timestamp indicating when the score was computed

### Requirement 12

**User Story:** As a security-conscious operator, I want all payment transactions to be verified on-chain, so that there is no possibility of payment fraud.

#### Acceptance Criteria

1. WHEN verifying a payment THEN the system SHALL query the Hedera network to confirm the transaction exists
2. WHEN verifying a payment THEN the system SHALL confirm the transaction amount matches the required payment
3. WHEN verifying a payment THEN the system SHALL confirm the transaction recipient matches the ProducerAgent account
4. WHEN verifying a payment THEN the system SHALL confirm the transaction memo matches the expected format
5. WHEN a payment cannot be verified THEN the system SHALL reject the request and return HTTP 402 with verification failure details

### Requirement 13

**User Story:** As a ProducerAgent, I want to enforce rate limits on ConsumerAgents, so that no single buyer can overwhelm my service.

#### Acceptance Criteria

1. WHEN a rate limit is negotiated THEN the system SHALL track API calls per ConsumerAgent per time window
2. WHEN a ConsumerAgent exceeds their rate limit THEN the system SHALL return HTTP 429 status with retry-after header
3. WHEN the rate limit time window expires THEN the system SHALL reset the call counter for that ConsumerAgent
4. WHEN no rate limit is negotiated THEN the system SHALL apply a default limit of 100 calls per day
5. WHEN rate limit violations occur repeatedly THEN the system SHALL log the violations to HCS for audit purposes

### Requirement 14

**User Story:** As a MeshOrchestrator, I want to maintain connection state between agents using HCS-10, so that agent relationships are verifiable and auditable.

#### Acceptance Criteria

1. WHEN a ConsumerAgent first interacts with a ProducerAgent THEN the system SHALL establish an HCS-10 connection with connection topic ID
2. WHEN a connection is established THEN the system SHALL record the connection details including both agent IDs, connection topic, and establishment timestamp
3. WHEN agents communicate THEN the system SHALL use the established connection topic for message exchange
4. WHEN a connection is terminated THEN the system SHALL publish a connection termination event to HCS
5. WHEN querying connection status THEN the system SHALL return current connection state including established, pending, or terminated status

### Requirement 15

**User Story:** As a system operator, I want comprehensive error handling and logging, so that I can diagnose and resolve issues quickly.

#### Acceptance Criteria

1. WHEN any error occurs THEN the system SHALL log the error with timestamp, error type, error message, and stack trace
2. WHEN an API call fails THEN the system SHALL return a structured error response with error code, message, and suggested resolution
3. WHEN critical errors occur THEN the system SHALL alert the operator through configured notification channels
4. WHEN errors are logged THEN the system SHALL include contextual information such as agent IDs, account IDs, and transaction IDs
5. WHEN reviewing logs THEN the system SHALL provide filtering and search capabilities by error type, agent ID, and time range
