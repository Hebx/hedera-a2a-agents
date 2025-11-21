/**
 * Trust Score Computation Engine
 * 
 * Computes trust scores from Arkhia analytics data.
 * Implements the scoring formula as specified in the PRD.
 * 
 * @packageDocumentation
 */

import {
  TrustScore,
  ScoreComponents,
  RiskFlag,
  ArkhiaAccountInfo,
  ArkhiaTransaction,
  TokenBalance,
  HCSMessage
} from './types'
import chalk from 'chalk'

/**
 * Trust Score Computation Engine
 */
export class TrustScoreComputationEngine {
  /**
   * Compute complete trust score
   * 
   * @param accountInfo - Account information from Arkhia
   * @param transactions - Transaction history
   * @param tokenBalances - Token holdings
   * @param hcsMessages - HCS message history
   * @returns Complete trust score with components and risk flags
   */
  async computeScore(
    accountInfo: ArkhiaAccountInfo,
    transactions: ArkhiaTransaction[],
    tokenBalances: TokenBalance[],
    hcsMessages: HCSMessage[]
  ): Promise<TrustScore> {
    console.log(chalk.blue(`🧮 Computing trust score for account ${accountInfo.account}...`))

    // Calculate individual components
    const accountAgeScore = this.calculateAccountAgeScore(accountInfo.created_timestamp)
    const diversityScore = this.calculateDiversityScore(transactions)
    const volatilityScore = this.calculateVolatilityScore(transactions)
    const tokenHealthScore = this.calculateTokenHealthScore(tokenBalances)
    const hcsQualityScore = this.calculateHCSQualityScore(hcsMessages)
    const { riskPenalty, riskFlags } = this.detectRiskFlags(accountInfo, transactions)

    // Aggregate components
    const components: ScoreComponents = {
      accountAge: accountAgeScore,
      diversity: diversityScore,
      volatility: volatilityScore,
      tokenHealth: tokenHealthScore,
      hcsQuality: hcsQualityScore,
      riskPenalty: riskPenalty
    }

    // Aggregate final score (0-100)
    const finalScore = this.aggregateScores(components)

    const trustScore: TrustScore = {
      account: accountInfo.account,
      score: finalScore,
      components,
      riskFlags,
      timestamp: Date.now()
    }

    console.log(chalk.green(`✅ Trust score computed: ${finalScore}/100`))
    console.log(chalk.gray(`   Components: age=${accountAgeScore}, diversity=${diversityScore}, volatility=${volatilityScore}, tokens=${tokenHealthScore}, hcs=${hcsQualityScore}, risk=${riskPenalty}`))

    return trustScore
  }

  /**
   * Calculate account age score
   * 
   * Scoring:
   * - 20 points for accounts older than 6 months
   * - 10 points for accounts 1-6 months old
   * - 3 points for accounts less than 1 month old
   * 
   * @param createdAt - Account creation timestamp (ISO string)
   * @returns Account age score (0-20)
   */
  private calculateAccountAgeScore(createdAt: string): number {
    const createdTime = new Date(createdAt).getTime()
    const now = Date.now()
    const ageMs = now - createdTime
    const ageMonths = ageMs / (1000 * 60 * 60 * 24 * 30) // Approximate months

    if (ageMonths > 6) {
      return 20
    } else if (ageMonths >= 1) {
      return 10
    } else {
      return 3
    }
  }

  /**
   * Calculate transaction diversity score
   * 
   * Scoring:
   * - 20 points for 25 or more unique counterparties
   * - 10 points for 10-24 unique accounts
   * - 5 points for fewer than 10 accounts
   * 
   * @param transactions - Transaction history
   * @returns Diversity score (0-20)
   */
  private calculateDiversityScore(transactions: ArkhiaTransaction[]): number {
    const uniqueCounterparties = new Set<string>()

    // Extract unique counterparties from transfers
    for (const tx of transactions) {
      if (tx.transfers) {
        for (const transfer of tx.transfers) {
          if (transfer.account) {
            uniqueCounterparties.add(transfer.account)
          }
        }
      }
    }

    const count = uniqueCounterparties.size

    if (count >= 25) {
      return 20
    } else if (count >= 10) {
      return 10
    } else {
      return 5
    }
  }

  /**
   * Calculate transfer stability/volatility score
   * 
   * Analyzes transaction patterns over 30 days:
   * - 20 points for low volatility (consistent patterns)
   * - 10 points for medium volatility
   * - 3 points for high volatility (erratic patterns)
   * 
   * @param transactions - Transaction history
   * @returns Volatility score (0-20)
   */
  private calculateVolatilityScore(transactions: ArkhiaTransaction[]): number {
    if (transactions.length === 0) {
      return 3 // New account with no transactions = high volatility
    }

    // Filter transactions from last 30 days
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000)
    const recentTxs = transactions.filter(tx => {
      const txTime = new Date(tx.consensus_timestamp).getTime()
      return txTime >= thirtyDaysAgo
    })

    if (recentTxs.length === 0) {
      return 3 // No recent activity = high volatility
    }

    // Calculate transaction amounts
    const amounts: number[] = []
    for (const tx of recentTxs) {
      if (tx.transfers) {
        let txAmount = 0
        for (const transfer of tx.transfers) {
          txAmount += Math.abs(transfer.amount || 0)
        }
        if (txAmount > 0) {
          amounts.push(txAmount)
        }
      }
    }

    if (amounts.length === 0) {
      return 3
    }

    // Calculate coefficient of variation (CV) as volatility measure
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length
    const variance = amounts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / amounts.length
    const stdDev = Math.sqrt(variance)
    const cv = mean > 0 ? stdDev / mean : 1 // Coefficient of variation

    // Classify volatility
    if (cv < 0.3) {
      return 20 // Low volatility
    } else if (cv < 0.7) {
      return 10 // Medium volatility
    } else {
      return 3  // High volatility
    }
  }

  /**
   * Calculate token health score
   * 
   * Evaluates token distribution:
   * - 10 points for healthy distribution (no single token >50% of portfolio)
   * - 0 points for unhealthy distribution
   * 
   * @param tokenBalances - Token holdings
   * @returns Token health score (0-10)
   */
  private calculateTokenHealthScore(tokenBalances: TokenBalance[]): number {
    if (tokenBalances.length === 0) {
      return 0 // No tokens = no health score
    }

    // Calculate total portfolio value (using balance as proxy)
    const totalValue = tokenBalances.reduce((sum, token) => sum + Math.abs(token.balance || 0), 0)

    if (totalValue === 0) {
      return 0
    }

    // Check if any single token exceeds 50% of portfolio
    for (const token of tokenBalances) {
      const percentage = Math.abs(token.balance || 0) / totalValue
      if (percentage > 0.5) {
        return 0 // Unhealthy concentration
      }
    }

    return 10 // Healthy distribution
  }

  /**
   * Calculate HCS interaction quality score
   * 
   * Scoring:
   * - +10 points for interactions with trusted topics
   * - -10 points for interactions with suspicious topics
   * - 0 points for no interactions or neutral topics
   * 
   * @param hcsMessages - HCS message history
   * @returns HCS quality score (-10 to +10)
   */
  private calculateHCSQualityScore(hcsMessages: HCSMessage[]): number {
    if (hcsMessages.length === 0) {
      return 0 // No HCS interactions
    }

    // TODO: Implement trusted/suspicious topic detection
    // For MVP, we'll use a simple heuristic:
    // - Check if messages contain known trusted patterns
    // - Check if messages contain known suspicious patterns
    
    // Placeholder: For now, return neutral score
    // In production, this would check against a registry of trusted/suspicious topics
    const hasTrustedPatterns = hcsMessages.some(msg => 
      msg.message && (msg.message.includes('trusted') || msg.message.includes('verified'))
    )
    
    const hasSuspiciousPatterns = hcsMessages.some(msg =>
      msg.message && (msg.message.includes('suspicious') || msg.message.includes('malicious'))
    )

    if (hasTrustedPatterns && !hasSuspiciousPatterns) {
      return 10
    } else if (hasSuspiciousPatterns && !hasTrustedPatterns) {
      return -10
    } else {
      return 0
    }
  }

  /**
   * Detect risk flags
   * 
   * Detects:
   * - Rapid outflows
   * - New account with large transfers
   * - Interactions with known malicious accounts
   * 
   * @param accountInfo - Account information
   * @param transactions - Transaction history
   * @returns Risk penalty (-20 to 0) and risk flags array
   */
  private detectRiskFlags(
    accountInfo: ArkhiaAccountInfo,
    transactions: ArkhiaTransaction[]
  ): { riskPenalty: number; riskFlags: RiskFlag[] } {
    const riskFlags: RiskFlag[] = []
    let totalPenalty = 0

    // Check account age
    const createdTime = new Date(accountInfo.created_timestamp).getTime()
    const now = Date.now()
    const ageDays = (now - createdTime) / (1000 * 60 * 60 * 24)
    const isNewAccount = ageDays < 30

    // Analyze recent transactions (last 7 days)
    const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000)
    const recentTxs = transactions.filter(tx => {
      const txTime = new Date(tx.consensus_timestamp).getTime()
      return txTime >= sevenDaysAgo
    })

    // Risk 1: Rapid outflows
    let totalOutflow = 0
    for (const tx of recentTxs) {
      if (tx.transfers) {
        for (const transfer of tx.transfers) {
          if (transfer.amount < 0) {
            totalOutflow += Math.abs(transfer.amount)
          }
        }
      }
    }

    // If account has lost >50% of balance in 7 days, flag as rapid outflow
    const currentBalance = accountInfo.balance?.balance || 0
    if (totalOutflow > currentBalance * 0.5 && totalOutflow > 1000000000) { // >1 HBAR
      riskFlags.push({
        type: 'rapid_outflow',
        severity: 'high',
        description: `Account has experienced rapid outflows: ${totalOutflow / 100000000} HBAR in last 7 days`,
        detectedAt: Date.now()
      })
      totalPenalty -= 10
    }

    // Risk 2: New account with large transfers
    if (isNewAccount && recentTxs.length > 0) {
      let maxTransfer = 0
      for (const tx of recentTxs) {
        if (tx.transfers) {
          for (const transfer of tx.transfers) {
            maxTransfer = Math.max(maxTransfer, Math.abs(transfer.amount || 0))
          }
        }
      }

      // Large transfer = >10 HBAR
      if (maxTransfer > 1000000000) { // 10 HBAR
        riskFlags.push({
          type: 'new_account_large_transfer',
          severity: 'medium',
          description: `New account (${Math.round(ageDays)} days old) with large transfer: ${maxTransfer / 100000000} HBAR`,
          detectedAt: Date.now()
        })
        totalPenalty -= 5
      }
    }

    // Risk 3: Malicious interactions (placeholder - would check against known malicious accounts)
    // For MVP, we'll skip this check as it requires a malicious account registry
    // In production, this would query a database of known malicious accounts

    // Ensure penalty is between -20 and 0
    const riskPenalty = Math.max(-20, Math.min(0, totalPenalty))

    return { riskPenalty, riskFlags }
  }

  /**
   * Aggregate component scores into final score
   * 
   * Final score = sum of all components, clamped to 0-100
   * 
   * @param components - Score components
   * @returns Final aggregated score (0-100)
   */
  private aggregateScores(components: ScoreComponents): number {
    const sum = 
      components.accountAge +
      components.diversity +
      components.volatility +
      components.tokenHealth +
      components.hcsQuality +
      components.riskPenalty

    // Clamp to 0-100
    return Math.max(0, Math.min(100, Math.round(sum)))
  }
}

