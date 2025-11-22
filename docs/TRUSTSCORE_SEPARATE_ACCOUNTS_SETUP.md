# TrustScore Oracle - Separate Accounts Setup Guide

## Current Configuration

**Consumer Agent (Buyer):**
- Account ID: `0.0.7132337` (currently using HEDERA_ACCOUNT_ID)
- Private Key: From `HEDERA_PRIVATE_KEY`
- Pays HBAR for trust scores

**Producer Agent (Seller):**
- Account ID: `0.0.7136519` (already receiving payments)
- Private Key: From `PRODUCER_PRIVATE_KEY` or `HEDERA_PRIVATE_KEY`
- Receives HBAR for providing trust scores

## New Configuration (After Setup)

**Consumer Agent (Buyer):**
- Account ID: `[NEW_ACCOUNT_ID]` ← **You'll provide this**
- Private Key: `[NEW_PRIVATE_KEY]` ← **You'll provide this**
- Pays HBAR to Producer

**Producer Agent (Seller):**
- Account ID: `0.0.7136519` (already configured)
- Private Key: `PRODUCER_PRIVATE_KEY` (already configured)
- Receives HBAR from Consumer

## Step-by-Step Setup

### Step 1: Provide Consumer Account Details

You'll provide:
1. Consumer Agent Account ID (e.g., `0.0.XXXXXX`)
2. Consumer Agent Private Key (ED25519 format, e.g., `302e0201...`)

### Step 2: Update `.env` File

Add/update these variables:

```env
# Consumer Agent (Buyer) - NEW ACCOUNT
CONSUMER_AGENT_ID=0.0.YOUR_NEW_ACCOUNT
CONSUMER_PRIVATE_KEY=302e0201...your_consumer_private_key

# Producer Agent (Seller) - ALREADY CONFIGURED
PRODUCER_AGENT_ID=0.0.7136519
PRODUCER_PRIVATE_KEY=302e0201...your_producer_private_key

# Optional: Keep main account for other operations
HEDERA_ACCOUNT_ID=0.0.7132337
HEDERA_PRIVATE_KEY=302e0201...your_main_private_key
```

### Step 3: Register Consumer Agent with HCS-11 Profile

Run the setup script with Consumer account:

```bash
# Set Consumer credentials temporarily
export HEDERA_ACCOUNT_ID=$CONSUMER_AGENT_ID
export HEDERA_PRIVATE_KEY=$CONSUMER_PRIVATE_KEY

# Register HCS-11 profile
npm run setup:trustscore-profile

# This will:
# 1. Create/verify profile topic
# 2. Create A2A inbound topic
# 3. Register HCS-11 profile
```

### Step 4: Verify Producer Agent (Already Done)

Producer Agent (`0.0.7136519`) is already:
- ✅ Receiving payments
- ✅ Registered with HCS-11 profile
- ✅ Has A2A inbound topic configured

### Step 5: Test Separate Accounts

Run the CLI to test:

```bash
# Terminal 1: Start Producer Agent
PRODUCER_AGENT_ID=0.0.7136519 npm run producer:start

# Terminal 2: Request trust score with Consumer Agent
CONSUMER_AGENT_ID=0.0.YOUR_NEW_ACCOUNT npm run trustscore 0.0.SOME_ACCOUNT
```

### Step 6: Verify Payment Flow

After running a trust score request, check:

1. **Consumer Account Balance:** Should decrease by ~1-2.5 HBAR
2. **Producer Account Balance:** Should increase by ~1-2.5 HBAR
3. **Transaction Memo:** Should show "A2A agent settlement via X402"

## Verification

After setup, you should see:

```
✅ Consumer Agent (Buyer):  0.0.YOUR_NEW_ACCOUNT  ← Pays
✅ Producer Agent (Seller): 0.0.7136519           ← Receives
```

**Different accounts = Proper separation!**

## Account Roles Summary

| Agent Type | Account ID | Role | Pays? | Receives? |
|------------|------------|------|-------|-----------|
| **Consumer** | `0.0.YOUR_NEW_ACCOUNT` | Buyer | ✅ Yes (pays HBAR) | ❌ No |
| **Producer** | `0.0.7136519` | Seller | ❌ No | ✅ Yes (receives HBAR) |

## Troubleshooting

### Consumer Agent Not Found

If you see "HCS-11 Profile Not Found" for Consumer:

```bash
# Make sure you registered the Consumer profile
HEDERA_ACCOUNT_ID=$CONSUMER_AGENT_ID npm run setup:trustscore-profile
```

### Payment Not Working

If payments aren't going through:

1. Verify Consumer account has enough HBAR balance
2. Check that Producer account (`0.0.7136519`) is configured correctly
3. Verify both accounts are on Hedera Testnet
4. Check transaction history on HashScan

### A2A Communication Issues

If agents can't communicate:

1. Verify both agents have HCS-11 profiles registered
2. Check that both have A2A inbound topics configured
3. Ensure `INBOUND_TOPIC_ID` is set for Consumer agent

## Next Steps

Once you provide the Consumer account details, we'll:
1. Update `.env` file with new Consumer credentials
2. Register Consumer Agent with HCS-11 profile
3. Test the separate accounts setup
4. Verify payment flow between different accounts

**Ready when you provide the account details!** 🚀

