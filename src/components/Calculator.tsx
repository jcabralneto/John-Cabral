import React, { useState } from 'react'
import { factorial, isPrime, sum } from '../utils/math'

export function Calculator() {
  const [number, setNumber] = useState<number>(5)
  const [numbers, setNumbers] = useState<string>('1,2,3,4,5')

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10)
    if (!isNaN(value)) {
      setNumber(value)
    }
  }

  const parseNumbers = (str: string): number[] => {
    return str.split(',').map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n))
  }

  const numberArray = parseNumbers(numbers)

  return (
    <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Math Calculator</h2>
      
      <div className="space-y-6">
        {/* Factorial Calculator */}
        <div className="border-b pb-4">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Factorial</h3>
          <div className="flex items-center space-x-2">
            <input
              type="number"
              value={number}
              onChange={handleNumberChange}
              min="0"
              className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="factorial-input"
            />
            <span className="text-gray-600">! =</span>
            <span className="font-bold text-blue-600" data-testid="factorial-result">
              {number >= 0 ? factorial(number) : 'Invalid'}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Is {number} prime? <span className="font-semibold">{isPrime(number) ? 'Yes' : 'No'}</span>
          </p>
        </div>

        {/* Sum Calculator */}
        <div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Sum</h3>
          <div className="space-y-2">
            <input
              type="text"
              value={numbers}
              onChange={(e) => setNumbers(e.target.value)}
              placeholder="1,2,3,4,5"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="sum-input"
            />
            <p className="text-sm text-gray-600">
              Sum: <span className="font-bold text-green-600" data-testid="sum-result">{sum(numberArray)}</span>
            </p>
            <p className="text-xs text-gray-500">Enter numbers separated by commas</p>
          </div>
        </div>
      </div>
    </div>
  )
}