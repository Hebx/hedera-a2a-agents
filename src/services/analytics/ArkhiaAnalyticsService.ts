/**
 * Arkhia Analytics Service
 * 
 * Interface to Arkhia API for Hedera account analytics.
 * Provides account information, transaction history, token holdings, and HCS messages.
 * 
 * @packageDocumentation
 */

import axios, { AxiosInstance } from 'axios'
import {
  ArkhiaAccountInfo,
  ArkhiaTransaction,
  TokenBalance,
  HCSMessage
} from './types'
import { loadEnvIfNeeded } from '../../utils/env'
import chalk from 'chalk'

// Load environment variables
loadEnvIfNeeded()

/**
 * Configuration for Arkhia Analytics Service
 */
export interface ArkhiaConfig {
  apiKey?: string                // Optional - will read from ARKHIA_API_KEY env if not provided
  network?: 'testnet' | 'mainnet' // Optional - defaults to 'testnet'
  baseUrl?: string
  cacheTTL?: number              // Cache TTL in milliseconds (default: 1 hour)
  maxRetries?: number            // Maximum retry attempts (default: 3)
  retryBaseDelay?: number        // Base delay for exponential backoff in ms (default: 1000)
}

/**
 * Cache entry
 */
interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

/**
 * Arkhia Analytics Service Implementation
 */
export class ArkhiaAnalyticsService {
  private client: AxiosInstance
  private config: Required<ArkhiaConfig>
  private cache: Map<string, CacheEntry<any>> = new Map()
  private readonly DEFAULT_BASE_URL = 'https://pool.arkhia.io'
  private readonly DEFAULT_CACHE_TTL = 3600000 // 1 hour

  constructor(config: ArkhiaConfig = {}) {
    // Get API key from config or environment
    const apiKey = config.apiKey || process.env.ARKHIA_API_KEY
    if (!apiKey) {
      throw new Error('Arkhia API key is required. Set ARKHIA_API_KEY environment variable or pass apiKey in config.')
    }

    // Get network from config or environment, default to testnet
    const network = config.network || (process.env.HEDERA_NETWORK === 'mainnet' ? 'mainnet' : 'testnet')

    this.config = {
      apiKey,
      network,
      baseUrl: config.baseUrl || this.DEFAULT_BASE_URL,
      cacheTTL: config.cacheTTL || this.DEFAULT_CACHE_TTL,
      maxRetries: config.maxRetries || 3,
      retryBaseDelay: config.retryBaseDelay || 1000
    }

    // Initialize Axios client
    // Arkhia API uses lowercase header: x-api-key
    this.client = axios.create({
      baseURL: this.config.baseUrl,
      headers: {
        'x-api-key': this.config.apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 seconds
    })

    console.log(chalk.blue(`🔗 Arkhia Analytics Service initialized for ${this.config.network}`))
  }

  /**
   * Get account information
   * 
   * @param accountId - Hedera account ID (e.g., "0.0.123456")
   * @returns Account information from Arkhia
   */
  async getAccountInfo(accountId: string): Promise<ArkhiaAccountInfo> {
    const cacheKey = `account:${accountId}`
    
    // Check cache
    const cached = this.getFromCache<ArkhiaAccountInfo>(cacheKey)
    if (cached) {
      console.log(chalk.gray(`📦 Cache hit for account ${accountId}`))
      return cached
    }

    return await this.retryWithBackoff(async () => {
      console.log(chalk.blue(`🔍 Fetching account info for ${accountId}...`))
      
      // Arkhia API endpoint: /hedera/{network}/api/v1/accounts/{accountId}
      const response = await this.client.get(`/hedera/${this.config.network}/api/v1/accounts/${accountId}`)

      const accountInfo = response.data as ArkhiaAccountInfo
      
      // Store in cache
      this.setCache(cacheKey, accountInfo)
      
      console.log(chalk.green(`✅ Account info retrieved for ${accountId}`))
      return accountInfo
    })
  }

  /**
   * Get transaction history
   * 
   * Note: Arkhia account endpoint includes transactions in the response.
   * We'll fetch account info and extract transactions from it.
   * 
   * @param accountId - Hedera account ID
   * @param limit - Maximum number of transactions to retrieve (default: 100)
   * @returns Array of transactions
   */
  async getTransactions(accountId: string, limit: number = 100): Promise<ArkhiaTransaction[]> {
    const cacheKey = `transactions:${accountId}:${limit}`
    
    // Check cache
    const cached = this.getFromCache<ArkhiaTransaction[]>(cacheKey)
    if (cached) {
      console.log(chalk.gray(`📦 Cache hit for transactions ${accountId}`))
      return cached
    }

    return await this.retryWithBackoff(async () => {
      console.log(chalk.blue(`🔍 Fetching transactions for ${accountId} (limit: ${limit})...`))
      
      // Arkhia account endpoint includes transactions in the response
      // Use query parameter to limit results
      const response = await this.client.get(`/hedera/${this.config.network}/api/v1/accounts/${accountId}`, {
        params: {
          limit: limit.toString()
        }
      })

      // Extract transactions from account response
      // Transactions are in response.data.transactions array
      const transactions = response.data.transactions || []
      
      // Limit to requested number
      const limitedTransactions = transactions.slice(0, limit)
      
      // Store in cache (shorter TTL for transactions as they change frequently)
      this.setCache(cacheKey, limitedTransactions, this.config.cacheTTL / 2)
      
      console.log(chalk.green(`✅ Retrieved ${limitedTransactions.length} transactions for ${accountId}`))
      return limitedTransactions
    })
  }

  /**
   * Get token balances
   * 
   * Note: Arkhia account endpoint includes token balances in balance.tokens array.
   * 
   * @param accountId - Hedera account ID
   * @returns Array of token balances
   */
  async getTokenBalances(accountId: string): Promise<TokenBalance[]> {
    const cacheKey = `tokens:${accountId}`
    
    // Check cache
    const cached = this.getFromCache<TokenBalance[]>(cacheKey)
    if (cached) {
      console.log(chalk.gray(`📦 Cache hit for token balances ${accountId}`))
      return cached
    }

    return await this.retryWithBackoff(async () => {
      console.log(chalk.blue(`🔍 Fetching token balances for ${accountId}...`))
      
      // Arkhia account endpoint includes tokens in balance.tokens array
      const response = await this.client.get(`/hedera/${this.config.network}/api/v1/accounts/${accountId}`)

      // Extract token balances from account response
      const tokens = response.data.balance?.tokens || []
      
      // Transform to TokenBalance format
      const balances: TokenBalance[] = tokens.map((token: any) => ({
        token_id: token.token_id,
        balance: token.balance || 0,
        decimals: 0 // Will need to fetch from token info if needed
      }))
      
      // Store in cache
      this.setCache(cacheKey, balances)
      
      console.log(chalk.green(`✅ Retrieved ${balances.length} token balances for ${accountId}`))
      return balances
    })
  }

  /**
   * Get HCS messages for account
   * 
   * @param accountId - Hedera account ID
   * @param topicIds - Optional array of topic IDs to filter by
   * @returns Array of HCS messages
   */
  async getHCSMessages(accountId: string, topicIds?: string[]): Promise<HCSMessage[]> {
    const cacheKey = `hcs:${accountId}:${topicIds?.join(',') || 'all'}`
    
    // Check cache
    const cached = this.getFromCache<HCSMessage[]>(cacheKey)
    if (cached) {
      console.log(chalk.gray(`📦 Cache hit for HCS messages ${accountId}`))
      return cached
    }

    return await this.retryWithBackoff(async () => {
      console.log(chalk.blue(`🔍 Fetching HCS messages for ${accountId}...`))
      
      // Arkhia API endpoint: /hedera/{network}/api/v1/accounts/{accountId}/messages
      // Note: HCS messages endpoint may vary - adjust based on actual API
      const params: any = {}
      if (topicIds && topicIds.length > 0) {
        params.topic_ids = topicIds.join(',')
      }

      const response = await this.client.get(`/hedera/${this.config.network}/api/v1/accounts/${accountId}/messages`, {
        params
      })

      const messages = response.data.messages || response.data as HCSMessage[]
      
      // Store in cache
      this.setCache(cacheKey, messages)
      
      console.log(chalk.green(`✅ Retrieved HCS messages for ${accountId}`))
      return Array.isArray(messages) ? messages : [messages]
    })
  }

  /**
   * Retry with exponential backoff
   * 
   * @param fn - Function to retry
   * @returns Result of function execution
   */
  private async retryWithBackoff<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null
    
    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        return await fn()
      } catch (error: any) {
        lastError = error
        
        // Check if it's a rate limit error
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after']
          const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : this.config.retryBaseDelay * Math.pow(2, attempt)
          
          console.log(chalk.yellow(`⏳ Rate limited, waiting ${waitTime}ms before retry ${attempt + 1}/${this.config.maxRetries}`))
          await new Promise(resolve => setTimeout(resolve, waitTime))
          continue
        }
        
        // For other errors, use exponential backoff
        if (attempt < this.config.maxRetries - 1) {
          const delay = this.config.retryBaseDelay * Math.pow(2, attempt)
          console.log(chalk.yellow(`⚠️  Attempt ${attempt + 1}/${this.config.maxRetries} failed, retrying in ${delay}ms...`))
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }
    
    // All retries exhausted
    console.error(chalk.red(`❌ All ${this.config.maxRetries} retry attempts failed`))
    throw lastError || new Error('Retry failed')
  }

  /**
   * Get from cache
   */
  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) {
      return null
    }

    // Check if expired
    const now = Date.now()
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  /**
   * Set cache
   */
  private setCache<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.config.cacheTTL
    })
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear()
    console.log(chalk.blue('🗑️  Cache cleared'))
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    }
  }
}

