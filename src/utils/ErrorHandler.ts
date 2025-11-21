/**
 * Error Handler Utility
 * 
 * Provides structured error handling, logging, and alerting for TrustScore Oracle.
 * Implements error categorization, context enrichment, and critical error alerting.
 * 
 * @packageDocumentation
 */

import chalk from 'chalk'

/**
 * Error categories
 */
export enum ErrorCategory {
  VALIDATION = 'VALIDATION',
  PAYMENT = 'PAYMENT',
  SERVICE = 'SERVICE',
  NETWORK = 'NETWORK',
  CRITICAL = 'CRITICAL'
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

/**
 * Structured error response
 */
export interface ErrorResponse {
  error: {
    code: string
    message: string
    category: ErrorCategory
    severity: ErrorSeverity
    details?: any
    resolution?: string
    timestamp: number
    context?: ErrorContext
  }
}

/**
 * Error context for enrichment
 */
export interface ErrorContext {
  agentId?: string
  accountId?: string
  transactionId?: string
  productId?: string
  endpoint?: string
  requestId?: string
  [key: string]: any
}

/**
 * Error log entry
 */
export interface ErrorLogEntry {
  id: string
  timestamp: number
  category: ErrorCategory
  severity: ErrorSeverity
  code: string
  message: string
  stackTrace?: string
  context: ErrorContext
  resolved: boolean
  resolution?: string
}

/**
 * Circuit breaker state
 */
enum CircuitState {
  CLOSED = 'CLOSED',      // Normal operation
  OPEN = 'OPEN',          // Failing, reject requests
  HALF_OPEN = 'HALF_OPEN' // Testing if service recovered
}

/**
 * Circuit breaker configuration
 */
interface CircuitBreakerConfig {
  failureThreshold: number      // Open circuit after N failures
  successThreshold: number       // Close circuit after N successes (half-open)
  timeout: number                // Time to wait before trying half-open (ms)
  resetTimeout: number           // Time to reset failure count (ms)
}

/**
 * Circuit breaker for API calls
 */
class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED
  private failureCount: number = 0
  private successCount: number = 0
  private lastFailureTime: number = 0
  private config: CircuitBreakerConfig

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = {
      failureThreshold: config?.failureThreshold || 5,
      successThreshold: config?.successThreshold || 2,
      timeout: config?.timeout || 60000, // 1 minute
      resetTimeout: config?.resetTimeout || 300000 // 5 minutes
    }
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      const timeSinceLastFailure = Date.now() - this.lastFailureTime
      if (timeSinceLastFailure >= this.config.timeout) {
        this.state = CircuitState.HALF_OPEN
        this.successCount = 0
      } else {
        throw new Error(`Circuit breaker is OPEN. Retry after ${Math.ceil((this.config.timeout - timeSinceLastFailure) / 1000)}s`)
      }
    }

    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++
      if (this.successCount >= this.config.successThreshold) {
        this.state = CircuitState.CLOSED
        this.failureCount = 0
        this.successCount = 0
      }
    } else {
      // Reset failure count on success
      this.failureCount = 0
    }
  }

  private onFailure(): void {
    this.failureCount++
    this.lastFailureTime = Date.now()

    if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN
    }
  }

  getState(): CircuitState {
    return this.state
  }

  reset(): void {
    this.state = CircuitState.CLOSED
    this.failureCount = 0
    this.successCount = 0
    this.lastFailureTime = 0
  }
}

/**
 * Error Handler Class
 */
export class ErrorHandler {
  private errorLogs: Map<string, ErrorLogEntry> = new Map()
  private circuitBreakers: Map<string, CircuitBreaker> = new Map()
  private alertingEnabled: boolean = false
  private alertingChannels: string[] = []

  constructor(alertingEnabled: boolean = false, alertingChannels: string[] = []) {
    this.alertingEnabled = alertingEnabled
    this.alertingChannels = alertingChannels
  }

  /**
   * Create structured error response
   */
  createErrorResponse(
    code: string,
    message: string,
    category: ErrorCategory,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    details?: any,
    context?: ErrorContext
  ): ErrorResponse {
    const resolution = this.getResolution(code, category)

    const errorResponse: ErrorResponse = {
      error: {
        code,
        message,
        category,
        severity,
        timestamp: Date.now()
      }
    }

    if (details !== undefined) {
      errorResponse.error.details = details
    }

    if (resolution !== undefined) {
      errorResponse.error.resolution = resolution
    }

    if (context !== undefined) {
      errorResponse.error.context = context
    }

    return errorResponse
  }

  /**
   * Log error with context enrichment
   */
  logError(
    error: Error,
    category: ErrorCategory,
    severity: ErrorSeverity,
    context?: ErrorContext
  ): string {
    const logId = `err_${Date.now()}_${Math.random().toString(36).substring(7)}`
    
    const logEntry: ErrorLogEntry = {
      id: logId,
      timestamp: Date.now(),
      category,
      severity,
      code: error.name || 'UNKNOWN_ERROR',
      message: error.message,
      context: context || {},
      resolved: false
    }

    if (error.stack !== undefined) {
      logEntry.stackTrace = error.stack
    }

    this.errorLogs.set(logId, logEntry)

    // Log to console with appropriate color
    const color = this.getSeverityColor(severity)
    console.log(color(`[${severity}] ${category}: ${error.message}`))
    if (context) {
      console.log(chalk.gray(`   Context: ${JSON.stringify(context)}`))
    }
    if (error.stack && severity === ErrorSeverity.CRITICAL) {
      console.log(chalk.red(`   Stack: ${error.stack}`))
    }

    // Alert on critical errors
    if (severity === ErrorSeverity.CRITICAL && this.alertingEnabled) {
      this.sendAlert(logEntry)
    }

    return logId
  }

  /**
   * Query error logs with filters
   */
  queryLogs(filters: {
    category?: ErrorCategory
    severity?: ErrorSeverity
    agentId?: string
    accountId?: string
    startTime?: number
    endTime?: number
    code?: string
  }): ErrorLogEntry[] {
    let logs = Array.from(this.errorLogs.values())

    if (filters.category) {
      logs = logs.filter(log => log.category === filters.category)
    }

    if (filters.severity) {
      logs = logs.filter(log => log.severity === filters.severity)
    }

    if (filters.agentId) {
      logs = logs.filter(log => log.context.agentId === filters.agentId)
    }

    if (filters.accountId) {
      logs = logs.filter(log => log.context.accountId === filters.accountId)
    }

    if (filters.code) {
      logs = logs.filter(log => log.code === filters.code)
    }

    if (filters.startTime) {
      logs = logs.filter(log => log.timestamp >= filters.startTime!)
    }

    if (filters.endTime) {
      logs = logs.filter(log => log.timestamp <= filters.endTime!)
    }

    return logs.sort((a, b) => b.timestamp - a.timestamp)
  }

  /**
   * Get circuit breaker for a service
   */
  getCircuitBreaker(serviceName: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (!this.circuitBreakers.has(serviceName)) {
      this.circuitBreakers.set(serviceName, new CircuitBreaker(config))
    }
    return this.circuitBreakers.get(serviceName)!
  }

  /**
   * Mark error as resolved
   */
  resolveError(logId: string, resolution?: string): void {
    const log = this.errorLogs.get(logId)
    if (log) {
      log.resolved = true
      if (resolution) {
        log.resolution = resolution
      }
    }
  }

  /**
   * Get error log by ID
   */
  getErrorLog(logId: string): ErrorLogEntry | undefined {
    return this.errorLogs.get(logId)
  }

  /**
   * Get resolution suggestion for error code
   */
  private getResolution(code: string, category: ErrorCategory): string | undefined {
    const resolutions: Record<string, string> = {
      'INVALID_ACCOUNT_ID': 'Verify account ID format is 0.0.xxxxx',
      'PAYMENT_REQUIRED': 'Include X-PAYMENT header with valid payment token',
      'PAYMENT_VERIFICATION_FAILED': 'Verify payment transaction and retry with new payment',
      'RATE_LIMIT_EXCEEDED': 'Wait for rate limit window to reset or upgrade plan',
      'SERVICE_UNAVAILABLE': 'Service temporarily unavailable, retry after a few moments',
      'NETWORK_ERROR': 'Check network connectivity and retry',
      'CIRCUIT_BREAKER_OPEN': 'Service is experiencing issues, retry later'
    }

    return resolutions[code] || `Check error details and retry. Category: ${category}`
  }

  /**
   * Get color for severity level
   */
  private getSeverityColor(severity: ErrorSeverity): (text: string) => string {
    switch (severity) {
      case ErrorSeverity.LOW:
        return chalk.gray
      case ErrorSeverity.MEDIUM:
        return chalk.yellow
      case ErrorSeverity.HIGH:
        return chalk.red
      case ErrorSeverity.CRITICAL:
        return chalk.bold.red
      default:
        return chalk.white
    }
  }

  /**
   * Send alert for critical errors
   */
  private async sendAlert(logEntry: ErrorLogEntry): Promise<void> {
    // Stub implementation - can be extended with email/Slack/PagerDuty
    console.log(chalk.bold.red(`🚨 CRITICAL ERROR ALERT: ${logEntry.message}`))
    console.log(chalk.red(`   Log ID: ${logEntry.id}`))
    console.log(chalk.red(`   Context: ${JSON.stringify(logEntry.context)}`))
    
    // In production, this would send to configured channels
    // Example: await this.sendToSlack(logEntry)
    // Example: await this.sendToPagerDuty(logEntry)
  }

  /**
   * Clear old error logs (older than specified time)
   */
  clearOldLogs(maxAge: number): void {
    const cutoff = Date.now() - maxAge
    for (const [id, log] of this.errorLogs.entries()) {
      if (log.timestamp < cutoff) {
        this.errorLogs.delete(id)
      }
    }
  }

  /**
   * Get error statistics
   */
  getStatistics(): {
    total: number
    byCategory: Record<ErrorCategory, number>
    bySeverity: Record<ErrorSeverity, number>
    unresolved: number
  } {
    const logs = Array.from(this.errorLogs.values())
    
    const byCategory: Record<ErrorCategory, number> = {
      [ErrorCategory.VALIDATION]: 0,
      [ErrorCategory.PAYMENT]: 0,
      [ErrorCategory.SERVICE]: 0,
      [ErrorCategory.NETWORK]: 0,
      [ErrorCategory.CRITICAL]: 0
    }

    const bySeverity: Record<ErrorSeverity, number> = {
      [ErrorSeverity.LOW]: 0,
      [ErrorSeverity.MEDIUM]: 0,
      [ErrorSeverity.HIGH]: 0,
      [ErrorSeverity.CRITICAL]: 0
    }

    logs.forEach(log => {
      byCategory[log.category]++
      bySeverity[log.severity]++
    })

    return {
      total: logs.length,
      byCategory,
      bySeverity,
      unresolved: logs.filter(log => !log.resolved).length
    }
  }
}

// Global error handler instance
export const globalErrorHandler = new ErrorHandler(
  process.env.ERROR_ALERTING_ENABLED === 'true',
  process.env.ERROR_ALERTING_CHANNELS?.split(',') || []
)

