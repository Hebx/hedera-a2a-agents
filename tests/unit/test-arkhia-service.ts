/**
 * Unit tests for ArkhiaAnalyticsService
 * 
 * Tests API calls, retry logic, caching, and error handling.
 */

import { ArkhiaAnalyticsService } from '../../src/services/analytics/ArkhiaAnalyticsService'
import { ArkhiaAccountInfo, ArkhiaTransaction, TokenBalance } from '../../src/services/analytics/types'
import axios from 'axios'
import chalk from 'chalk'

// Mock axios
jest.mock('axios')
const mockedAxios = axios as jest.Mocked<typeof axios>

describe('ArkhiaAnalyticsService', () => {
  let service: ArkhiaAnalyticsService
  const mockApiKey = 'test-api-key'

  beforeEach(() => {
    // Set environment variable
    process.env.ARKHIA_API_KEY = mockApiKey
    process.env.HEDERA_NETWORK = 'testnet'

    // Create service instance
    service = new ArkhiaAnalyticsService()

    // Clear cache
    service.clearCache()

    // Reset mocks
    jest.clearAllMocks()
  })

  afterEach(() => {
    delete process.env.ARKHIA_API_KEY
    delete process.env.HEDERA_NETWORK
  })

  describe('getAccountInfo', () => {
    it('should fetch account info successfully', async () => {
      const mockAccountInfo: ArkhiaAccountInfo = {
        account: '0.0.123456',
        balance: {
          balance: 1000000000,
          timestamp: '2024-01-01T00:00:00Z'
        },
        created_timestamp: '2024-01-01T00:00:00Z',
        key: {
          _type: 'ED25519',
          key: 'test-key'
        },
        auto_renew_period: 2592000,
        deleted: false,
        ethereum_nonce: 0,
        evm_address: '0x1234567890123456789012345678901234567890'
      }

      mockedAxios.create = jest.fn(() => ({
        get: jest.fn().mockResolvedValue({ data: mockAccountInfo }),
        post: jest.fn(),
        put: jest.fn(),
        delete: jest.fn(),
        patch: jest.fn(),
        request: jest.fn(),
        defaults: {},
        interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } }
      })) as any

      const result = await service.getAccountInfo('0.0.123456')

      expect(result).toEqual(mockAccountInfo)
    })

    it('should cache account info', async () => {
      const mockAccountInfo: ArkhiaAccountInfo = {
        account: '0.0.123456',
        balance: { balance: 1000000000, timestamp: '2024-01-01T00:00:00Z' },
        created_timestamp: '2024-01-01T00:00:00Z',
        key: { _type: 'ED25519', key: 'test-key' },
        auto_renew_period: 2592000,
        deleted: false,
        ethereum_nonce: 0,
        evm_address: '0x1234567890123456789012345678901234567890'
      }

      const mockGet = jest.fn().mockResolvedValue({ data: mockAccountInfo })
      mockedAxios.create = jest.fn(() => ({
        get: mockGet,
        post: jest.fn(),
        put: jest.fn(),
        delete: jest.fn(),
        patch: jest.fn(),
        request: jest.fn(),
        defaults: {},
        interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } }
      })) as any

      // First call
      await service.getAccountInfo('0.0.123456')
      expect(mockGet).toHaveBeenCalledTimes(1)

      // Second call should use cache
      await service.getAccountInfo('0.0.123456')
      expect(mockGet).toHaveBeenCalledTimes(1) // Still 1, cached
    })
  })

  describe('retry logic', () => {
    it('should retry on failure with exponential backoff', async () => {
      let callCount = 0
      const mockGet = jest.fn().mockImplementation(() => {
        callCount++
        if (callCount < 3) {
          return Promise.reject(new Error('Network error'))
        }
        return Promise.resolve({
          data: {
            account: '0.0.123456',
            balance: { balance: 1000000000, timestamp: '2024-01-01T00:00:00Z' },
            created_timestamp: '2024-01-01T00:00:00Z',
            key: { _type: 'ED25519', key: 'test-key' },
            auto_renew_period: 2592000,
            deleted: false,
            ethereum_nonce: 0,
            evm_address: '0x1234567890123456789012345678901234567890'
          }
        })
      })

      mockedAxios.create = jest.fn(() => ({
        get: mockGet,
        post: jest.fn(),
        put: jest.fn(),
        delete: jest.fn(),
        patch: jest.fn(),
        request: jest.fn(),
        defaults: {},
        interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } }
      })) as any

      const result = await service.getAccountInfo('0.0.123456')

      expect(mockGet).toHaveBeenCalledTimes(3)
      expect(result.account).toBe('0.0.123456')
    })
  })
})

// Run tests if executed directly
if (require.main === module) {
  console.log(chalk.blue('Running ArkhiaAnalyticsService unit tests...'))
  // Note: These tests require jest to be configured
  // For now, this is a placeholder structure
  console.log(chalk.yellow('⚠️  Tests require Jest configuration. Run with: npm test'))
}

