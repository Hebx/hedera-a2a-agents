# x402-Hedera Integration Status

## Current Implementation

We are **following the x402-hedera Express server pattern** but using our own implementation that integrates with Hedron's architecture.

### What We're Using

1. **`a2a-x402` npm package** - Core x402 protocol functions
   - `processPayment()` - Creates payment authorizations
   - `verifyPayment()` - Verifies payment signatures
   - `settlePayment()` - Executes payment settlements

2. **Custom `X402FacilitatorServer`** - Our facilitator implementation
   - Supports both Hedera native HBAR and EVM USDC payments
   - Implements `verify()` and `settle()` methods
   - Executes real Hedera transfers using `@hashgraph/sdk`
   - Executes real USDC transfers using `ethers.js`

3. **Express Server Pattern** - Following x402-hedera conventions
   - Returns `402 Payment Required` when no `X-PAYMENT` header
   - Verifies payment via facilitator before processing
   - Returns payment requirements in 402 response

### What We're NOT Using

- **x402-hedera repository directly** - We're not importing from the GitHub repo
- **x402-express middleware** - We implement payment gating manually in routes
- **x402-hedera facilitator** - We use our own `X402FacilitatorServer`

## Why Our Approach?

1. **Integration with Hedron SDK** - Our facilitator integrates with Hedron's agent architecture
2. **Hedera Native Support** - Direct Hedera SDK integration for HBAR transfers
3. **Agent-to-Agent Focus** - Designed for autonomous agent payments, not just web APIs
4. **A2A Protocol Integration** - Works seamlessly with A2A and AP2 protocols

## Payment Flow Comparison

### x402-hedera Pattern (Reference)
```
Client → Server (402) → Facilitator (verify/settle) → Server (200)
```

### Our Implementation
```
ConsumerAgent → ProducerAgent (402) → X402FacilitatorServer (verify/settle) → ProducerAgent (200)
```

## Key Differences

| Aspect | x402-hedera | Our Implementation |
|--------|-------------|-------------------|
| **Facilitator** | Separate server process | Integrated class (`X402FacilitatorServer`) |
| **Payment Auth** | Uses `processPayment` from `a2a-x402` | Uses `processPayment` for EVM, custom for Hedera |
| **Hedera Support** | Native Hedera transfers | Native Hedera transfers via `@hashgraph/sdk` |
| **Agent Integration** | Web API focused | Agent-to-agent focused |
| **Middleware** | `x402-express` middleware | Manual route handlers |

## Verification

Our implementation:
- ✅ Returns `402 Payment Required` correctly
- ✅ Verifies payments via facilitator
- ✅ Executes real Hedera HBAR transfers
- ✅ Executes real USDC transfers (Base Sepolia)
- ✅ Follows x402 protocol standards
- ✅ Uses `a2a-x402` package for core functions

## Testing

Run the x402 payment integration test:
```bash
npm run test:trustscore-integration
# or
npx ts-node tests/integration/test-trustscore-x402-payment.ts
```

## References

- [x402-hedera Repository](https://github.com/hedera-dev/x402-hedera)
- [x402-hedera Express Example](https://github.com/hedera-dev/x402-hedera/tree/main/examples/typescript/servers/express)
- [x402 Protocol Spec](https://x402.org)

