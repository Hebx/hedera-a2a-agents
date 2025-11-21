/**
 * Product Registry
 * 
 * Manages the catalog of available trust score products with pricing and terms.
 * 
 * @packageDocumentation
 */

import { ProductRegistryEntry } from './types'
import chalk from 'chalk'

/**
 * Product Registry Implementation
 */
export class ProductRegistry {
  private products: Map<string, ProductRegistryEntry> = new Map()

  constructor() {
    // Initialize with default product
    this.initializeDefaultProduct()
  }

  /**
   * Initialize default trust score product
   */
  private initializeDefaultProduct(): void {
    const defaultProduct: ProductRegistryEntry = {
      productId: 'trustscore.basic.v1',
      version: 'v1',
      name: 'Basic Trust Score',
      description: 'Comprehensive trust score for Hedera accounts based on on-chain analytics',
      producerAgentId: '', // Will be set when producer registers
      endpoint: '/trustscore/:accountId',
      defaultPrice: '0.3', // 0.3 HBAR
      currency: 'HBAR',
      network: 'hedera-testnet',
      rateLimit: {
        calls: 100,
        period: 86400 // 24 hours
      },
      sla: {
        uptime: '99.9%',
        responseTime: '< 2s'
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    this.registerProduct(defaultProduct)
    console.log(chalk.blue('📦 Default product registered: trustscore.basic.v1'))
  }

  /**
   * Register a new product
   * 
   * @param product - Product to register
   */
  registerProduct(product: ProductRegistryEntry): void {
    this.products.set(product.productId, product)
    console.log(chalk.green(`✅ Product registered: ${product.productId}`))
  }

  /**
   * Get product by ID
   * 
   * @param productId - Product ID
   * @returns Product entry or null if not found
   */
  getProduct(productId: string): ProductRegistryEntry | null {
    return this.products.get(productId) || null
  }

  /**
   * Get all products
   * 
   * @returns Array of all registered products
   */
  getAllProducts(): ProductRegistryEntry[] {
    return Array.from(this.products.values())
  }

  /**
   * Update product price
   * 
   * @param productId - Product ID
   * @param newPrice - New price in HBAR
   */
  updatePrice(productId: string, newPrice: string): void {
    const product = this.products.get(productId)
    if (!product) {
      throw new Error(`Product ${productId} not found`)
    }

    product.defaultPrice = newPrice
    product.updatedAt = Date.now()
    this.products.set(productId, product)
    
    console.log(chalk.yellow(`💰 Price updated for ${productId}: ${newPrice} ${product.currency}`))
  }

  /**
   * Update product pricing and notify subscribers
   * 
   * @param productId - Product ID
   * @param updates - Partial product updates
   */
  updateProduct(productId: string, updates: Partial<ProductRegistryEntry>): void {
    const product = this.products.get(productId)
    if (!product) {
      throw new Error(`Product ${productId} not found`)
    }

    const updatedProduct: ProductRegistryEntry = {
      ...product,
      ...updates,
      updatedAt: Date.now()
    }

    this.products.set(productId, updatedProduct)
    console.log(chalk.yellow(`📝 Product updated: ${productId}`))
  }

  /**
   * Deprecate a product
   * 
   * @param productId - Product ID
   * @param noticeDays - Days until removal (default: 14)
   */
  deprecateProduct(productId: string, noticeDays: number = 14): void {
    const product = this.products.get(productId)
    if (!product) {
      throw new Error(`Product ${productId} not found`)
    }

    // Mark as deprecated (could add a deprecated field to ProductRegistryEntry)
    console.log(chalk.yellow(`⚠️  Product ${productId} marked as deprecated. Removal in ${noticeDays} days.`))
    
    // In production, would set a deprecated flag and schedule removal
    // For MVP, we'll just log the deprecation
  }

  /**
   * Get product count
   */
  getProductCount(): number {
    return this.products.size
  }

  /**
   * Clear all products (for testing)
   */
  clear(): void {
    this.products.clear()
    this.initializeDefaultProduct()
    console.log(chalk.blue('🗑️  Product registry cleared and reset'))
  }
}

