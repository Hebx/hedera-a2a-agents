# Integration Tests

## TrustScore Oracle Phase 1 Tests

### Running Tests

```bash
# Run Phase 1 integration tests
npx ts-node tests/integration/test-trustscore-oracle-phase1.ts
```

### Test Results

**Phase 1 Status:**
- ✅ **Computation Engine**: PASS - All scoring components working correctly
- ✅ **Product Registry**: PASS - Product management working correctly  
- ⚠️ **Arkhia Service**: FAIL - Requires valid ARKHIA_API_KEY and correct API endpoints

### Notes

- Arkhia API test failure is expected if:
  - `ARKHIA_API_KEY` is not set in `.env`
  - API endpoints differ from expected format
  - Network connectivity issues

- All tests use minimal balances (0.001 HBAR) to avoid breaking testnet accounts

### Environment Variables Required

```bash
ARKHIA_API_KEY=your_arkhia_api_key
HEDERA_ACCOUNT_ID=0.0.xxxxx
HEDERA_NETWORK=testnet
```

