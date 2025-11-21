/**
 * Unit tests for ProductRegistry
 * 
 * Tests product registration, retrieval, updates, and deprecation.
 */

import { ProductRegistry } from '../../src/marketplace/ProductRegistry'
import { ProductRegistryEntry } from '../../src/marketplace/types'
import chalk from 'chalk'

describe('ProductRegistry', () => {
  let registry: ProductRegistry

  beforeEach(() => {
    registry = new ProductRegistry()
  })

  describe('getProduct', () => {
    it('should return default product', () => {
      const product = registry.getProduct('trustscore.basic.v1')
      
      expect(product).not.toBeNull()
      expect(product?.productId).toBe('trustscore.basic.v1')
      expect(product?.defaultPrice).toBe('0.3')
      expect(product?.currency).toBe('HBAR')
    })

    it('should return null for non-existent product', () => {
      const product = registry.getProduct('nonexistent.product')
      
      expect(product).toBeNull()
    })
  })

  describe('registerProduct', () => {
    it('should register a new product', () => {
      const newProduct: ProductRegistryEntry = {
        productId: 'trustscore.premium.v1',
        version: 'v1',
        name: 'Premium Trust Score',
        description: 'Enhanced trust score with additional metrics',
        producerAgentId: '0.0.123456',
        endpoint: '/trustscore/premium/:accountId',
        defaultPrice: '1.0',
        currency: 'HBAR',
        network: 'hedera-testnet',
        rateLimit: {
          calls: 1000,
          period: 86400
        },
        sla: {
          uptime: '99.99%',
          responseTime: '< 1s'
        },
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      registry.registerProduct(newProduct)
      const retrieved = registry.getProduct('trustscore.premium.v1')

      expect(retrieved).not.toBeNull()
      expect(retrieved?.productId).toBe('trustscore.premium.v1')
      expect(retrieved?.defaultPrice).toBe('1.0')
    })
  })

  describe('updatePrice', () => {
    it('should update product price', () => {
      registry.updatePrice('trustscore.basic.v1', '0.5')
      const product = registry.getProduct('trustscore.basic.v1')

      expect(product?.defaultPrice).toBe('0.5')
      expect(product?.updatedAt).toBeGreaterThan(product?.createdAt || 0)
    })

    it('should throw error for non-existent product', () => {
      expect(() => {
        registry.updatePrice('nonexistent.product', '0.5')
      }).toThrow('Product nonexistent.product not found')
    })
  })

  describe('getAllProducts', () => {
    it('should return all registered products', () => {
      const products = registry.getAllProducts()

      expect(products.length).toBeGreaterThan(0)
      expect(products.some(p => p.productId === 'trustscore.basic.v1')).toBe(true)
    })
  })

  describe('getProductCount', () => {
    it('should return correct product count', () => {
      const initialCount = registry.getProductCount()
      
      const newProduct: ProductRegistryEntry = {
        productId: 'test.product',
        version: 'v1',
        name: 'Test Product',
        description: 'Test',
        producerAgentId: '0.0.123',
        endpoint: '/test',
        defaultPrice: '0.1',
        currency: 'HBAR',
        network: 'hedera-testnet',
        rateLimit: { calls: 100, period: 86400 },
        sla: { uptime: '99%', responseTime: '< 2s' },
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      registry.registerProduct(newProduct)
      const newCount = registry.getProductCount()

      expect(newCount).toBe(initialCount + 1)
    })
  })
})

// Run tests if executed directly
if (require.main === module) {
  console.log(chalk.blue('Running ProductRegistry unit tests...'))
  console.log(chalk.yellow('⚠️  Tests require Jest configuration. Run with: npm test'))
}

