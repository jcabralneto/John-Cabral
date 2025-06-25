import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Calculator } from '../Calculator'

describe('Calculator Component', () => {
  it('should render calculator with default values', () => {
    render(<Calculator />)
    
    expect(screen.getByText('Math Calculator')).toBeInTheDocument()
    expect(screen.getByTestId('factorial-input')).toHaveValue(5)
    expect(screen.getByTestId('factorial-result')).toHaveTextContent('120')
    expect(screen.getByTestId('sum-input')).toHaveValue('1,2,3,4,5')
    expect(screen.getByTestId('sum-result')).toHaveTextContent('15')
  })

  it('should update factorial when input changes', async () => {
    const user = userEvent.setup()
    render(<Calculator />)
    
    const factorialInput = screen.getByTestId('factorial-input')
    
    await user.clear(factorialInput)
    await user.type(factorialInput, '4')
    
    expect(screen.getByTestId('factorial-result')).toHaveTextContent('24')
  })

  it('should show prime number status', async () => {
    const user = userEvent.setup()
    render(<Calculator />)
    
    const factorialInput = screen.getByTestId('factorial-input')
    
    // Test with prime number
    await user.clear(factorialInput)
    await user.type(factorialInput, '7')
    
    expect(screen.getByText(/Is 7 prime\? Yes/)).toBeInTheDocument()
    
    // Test with non-prime number
    await user.clear(factorialInput)
    await user.type(factorialInput, '8')
    
    expect(screen.getByText(/Is 8 prime\? No/)).toBeInTheDocument()
  })

  it('should update sum when input changes', async () => {
    const user = userEvent.setup()
    render(<Calculator />)
    
    const sumInput = screen.getByTestId('sum-input')
    
    await user.clear(sumInput)
    await user.type(sumInput, '10,20,30')
    
    expect(screen.getByTestId('sum-result')).toHaveTextContent('60')
  })

  it('should handle invalid sum input gracefully', async () => {
    const user = userEvent.setup()
    render(<Calculator />)
    
    const sumInput = screen.getByTestId('sum-input')
    
    await user.clear(sumInput)
    await user.type(sumInput, '1,abc,3')
    
    expect(screen.getByTestId('sum-result')).toHaveTextContent('4')
  })

  it('should handle negative factorial input', async () => {
    const user = userEvent.setup()
    render(<Calculator />)
    
    const factorialInput = screen.getByTestId('factorial-input')
    
    await user.clear(factorialInput)
    await user.type(factorialInput, '-1')
    
    expect(screen.getByTestId('factorial-result')).toHaveTextContent('Invalid')
  })
})