# TrustScore Oracle Setup Guide

## Quick Setup: Getting Agent IDs and HCS Topics

### Where to Get Agent IDs and HCS Topics

**Answer: Run the agent registration script!**

```bash
npm run setup:agents
```

This single command will:
1. ✅ Create new Hedera accounts for all agents (Producer, Consumer, Orchestrator)
2. ✅ Create HCS topics for each agent automatically
3. ✅ Generate private keys for each agent
4. ✅ **Write everything to your `.env` file automatically**

### What Gets Created

After running `npm run setup:agents`, you'll see output like:

```
🔧 Registering TrustScoreProducerAgent...
   ✅ Created agent account: 0.0.1234567
   ✅ Created inbound topic: 0.0.2345678
   ✅ Created outbound topic: 0.0.3456789
   
🔧 Registering TrustScoreConsumerAgent...
   ✅ Created agent account: 0.0.4567890
   ✅ Created inbound topic: 0.0.5678901
   ✅ Created outbound topic: 0.0.6789012
   
🔧 Registering MeshOrchestrator...
   ✅ Created agent account: 0.0.7890123
   ✅ Created inbound topic: 0.0.8901234  # This becomes MESH_TOPIC_ID
   ✅ Created outbound topic: 0.0.9012345
```

And your `.env` file will be automatically updated with:

```env
# Agent Credentials
PRODUCER_AGENT_ID=0.0.1234567
PRODUCER_TOPIC_ID=0.0.2345678
PRODUCER_PRIVATE_KEY=302e...

CONSUMER_AGENT_ID=0.0.4567890
CONSUMER_TOPIC_ID=0.0.5678901
CONSUMER_PRIVATE_KEY=302e...

ORCHESTRATOR_AGENT_ID=0.0.7890123
MESH_TOPIC_ID=0.0.8901234  # ← This is what you need!
ORCHESTRATOR_PRIVATE_KEY=302e...
```

### Agent IDs

**PRODUCER_AGENT_ID** and **CONSUMER_AGENT_ID**:
- These are **Hedera account IDs** created specifically for each agent
- Created by: `npm run setup:agents`
- Stored in: `.env` file (written automatically)
- **Alternative:** If not set, agents will use your `HEDERA_ACCOUNT_ID` (not recommended for production)

### HCS Topics

**MESH_TOPIC_ID** and **HCS_TOPIC_ID**:
- These are **Hedera Consensus Service (HCS) topic IDs**
- Created by: `npm run setup:agents` 
- `MESH_TOPIC_ID` = Orchestrator's inbound topic (where it receives messages)
- `HCS_TOPIC_ID` = Can be any existing HCS topic for event logging
- Stored in: `.env` file (written automatically)
- **Alternative:** You can use an existing topic ID you already have

### Step-by-Step Setup

**1. Make sure you have your main Hedera credentials:**

```env
HEDERA_ACCOUNT_ID=0.0.your-main-account
HEDERA_PRIVATE_KEY=302e...
```

**2. Run the agent registration:**

```bash
npm run setup:agents
```

**3. Check your `.env` file:**

The script automatically appends all agent credentials. You should see:

```env
# Agent Credentials
PRODUCER_AGENT_ID=0.0.xxxxx
PRODUCER_TOPIC_ID=0.0.xxxxx
PRODUCER_PRIVATE_KEY=xxxxx

CONSUMER_AGENT_ID=0.0.xxxxx
CONSUMER_TOPIC_ID=0.0.xxxxx
CONSUMER_PRIVATE_KEY=xxxxx

ORCHESTRATOR_AGENT_ID=0.0.xxxxx
MESH_TOPIC_ID=0.0.xxxxx  # ← Use this for MESH_TOPIC_ID
ORCHESTRATOR_PRIVATE_KEY=xxxxx
```

**4. Add remaining required variables:**

```env
# Arkhia API (get from https://arkhia.io)
ARKHIA_API_KEY=your_key_here

# Payment network for TrustScore Oracle
PAYMENT_NETWORK=hedera-testnet
```

**5. You're done!**

Now you have everything you need to run the TrustScore Oracle:

```bash
npm run demo:trustscore-oracle
```

### What If I Already Have Agent IDs?

If you've run `setup:agents` before, the IDs are already in your `.env` file. Just check:

```bash
grep "PRODUCER_AGENT_ID\|CONSUMER_AGENT_ID\|MESH_TOPIC_ID" .env
```

### What If I Don't Want Separate Agent Accounts?

You can skip running `setup:agents` and agents will use your main `HEDERA_ACCOUNT_ID`:

```env
# Skip agent registration - use main account
HEDERA_ACCOUNT_ID=0.0.your-account
HEDERA_PRIVATE_KEY=your-key

# Still need topics (can use existing ones)
MESH_TOPIC_ID=0.0.existing-topic  # Any existing HCS topic
HCS_TOPIC_ID=0.0.existing-topic   # Can be same as MESH_TOPIC_ID
```

However, **it's recommended to create dedicated agent accounts** for:
- Better security isolation
- Independent account management
- Proper agent-to-agent communication

### Troubleshooting

**Q: The setup script failed. What should I do?**

A: Check:
- Your `HEDERA_ACCOUNT_ID` is valid
- Your `HEDERA_PRIVATE_KEY` is correct
- Your account has enough HBAR for account creation fees
- You're connected to Hedera Testnet

**Q: I see topics created but not agent IDs. Why?**

A: The topics are created first. Agent accounts might take a moment. Check the full output for any errors.

**Q: Can I reuse existing topics?**

A: Yes! You can set `MESH_TOPIC_ID` to any existing HCS topic you have. Just make sure it exists on Hedera.

**Q: What's the difference between HCS_TOPIC_ID and MESH_TOPIC_ID?**

A:
- `MESH_TOPIC_ID`: Topic for Mesh Orchestrator (required for A2A communication)
- `HCS_TOPIC_ID`: General HCS topic for event logging (optional, can use existing)

### Summary

| Variable | Where to Get | Required? |
|----------|-------------|-----------|
| `PRODUCER_AGENT_ID` | `npm run setup:agents` | Optional (defaults to `HEDERA_ACCOUNT_ID`) |
| `CONSUMER_AGENT_ID` | `npm run setup:agents` | Optional (defaults to `HEDERA_ACCOUNT_ID`) |
| `MESH_TOPIC_ID` | `npm run setup:agents` | **Required** for orchestrator |
| `HCS_TOPIC_ID` | `npm run setup:agents` or existing topic | Optional |

**Recommended:** Just run `npm run setup:agents` and it handles everything! 🚀


