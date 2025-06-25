import { describe, it, expect } from 'vitest'
import { factorial, isPrime, sum, formatCurrency } from '../math'

describe('Math utilities', () => {
  describe('factorial', () => {
    it('should return 1 for factorial of 0', () => {
      expect(factorial(0)).toBe(1)
    })

    it('should return 1 for factorial of 1', () => {
      expect(factorial(1)).toBe(1)
    })

    it('should calculate factorial correctly for positive numbers', () => {
      expect(factorial(5)).toBe(120)
      expect(factorial(4)).toBe(24)
      expect(factorial(3)).toBe(6)
    })

    it('should throw error for negative numbers', () => {
      expect(() => factorial(-1)).toThrow('Factorial is not defined for negative numbers')
    })
  })

  describe('isPrime', () => {
    it('should return false for numbers less than 2', () => {
      expect(isPrime(0)).toBe(false)
      expect(isPrime(1)).toBe(false)
      expect(isPrime(-5)).toBe(false)
    })

    it('should return true for prime numbers', () => {
      expect(isPrime(2)).toBe(true)
      expect(isPrime(3)).toBe(true)
      expect(isPrime(5)).toBe(true)
      expect(isPrime(7)).toBe(true)
      expect(isPrime(11)).toBe(true)
      expect(isPrime(13)).toBe(true)
    })

    it('should return false for composite numbers', () => {
      expect(isPrime(4)).toBe(false)
      expect(isPrime(6)).toBe(false)
      expect(isPrime(8)).toBe(false)
      expect(isPrime(9)).toBe(false)
      expect(isPrime(10)).toBe(false)
    })
  })

  describe('sum', () => {
    it('should return 0 for empty array', () => {
      expect(sum([])).toBe(0)
    })

    it('should calculate sum correctly', () => {
      expect(sum([1, 2, 3, 4, 5])).toBe(15)
      expect(sum([10, -5, 3])).toBe(8)
      expect(sum([0, 0, 0])).toBe(0)
    })
  })

  describe('formatCurrency', () => {
    it('should format USD currency by default', () => {
      expect(formatCurrency(1234.56)).toBe('$1,234.56')
    })

    it('should format different currencies', () => {
      expect(formatCurrency(1234.56, 'EUR')).toBe('€1,234.56')
    })

    it('should handle zero and negative amounts', () => {
      expect(formatCurrency(0)).toBe('$0.00')
      expect(formatCurrency(-100)).toBe('-$100.00')
    })
  })
})