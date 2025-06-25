import React from 'react'

interface LoadingSpinnerProps {
  text?: string
}

export function LoadingSpinner({ text = 'Carregando...' }: LoadingSpinnerProps) {
  return (
    <div className="loading">
      <div className="spinner"></div>
      {text}
    </div>
  )
}