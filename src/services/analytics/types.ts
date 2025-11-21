/**
 * Type definitions for TrustScore Oracle Analytics Service
 * 
 * @packageDocumentation
 */

/**
 * Trust Score data model
 */
export interface TrustScore {
  account: string              // Hedera account ID (0.0.xxxxx)
  score: number                // Overall score (0-100)
  components: ScoreComponents  // Individual component scores
  riskFlags: RiskFlag[]        // Detected risk patterns
  timestamp: number            // Unix timestamp of computation
}

/**
 * Score Components breakdown
 */
export interface ScoreComponents {
  accountAge: number           // 0-20 points
  diversity: number             // 0-20 points
  volatility: number            // 0-20 points
  tokenHealth: number           // 0-10 points
  hcsQuality: number            // -10 to +10 points
  riskPenalty: number           // -20 to 0 points
}

/**
 * Risk Flag
 */
export interface RiskFlag {
  type: 'rapid_outflow' | 'new_account_large_transfer' | 'malicious_interaction'
  severity: 'low' | 'medium' | 'high'
  description: string
  detectedAt: number
}

/**
 * Arkhia Account Info Response
 */
export interface ArkhiaAccountInfo {
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

/**
 * Arkhia Transaction
 */
export interface ArkhiaTransaction {
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

/**
 * Token Balance
 */
export interface TokenBalance {
  token_id: string
  balance: number
  decimals: number
  name?: string
  symbol?: string
}

/**
 * HCS Message
 */
export interface HCSMessage {
  topic_id: string
  consensus_timestamp: string
  message: string
  running_hash: string
  sequence_number: number
}

