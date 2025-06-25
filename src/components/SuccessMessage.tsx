import React from 'react'

interface SuccessMessageProps {
  message: string
  onClose: () => void
}

export function SuccessMessage({ message, onClose }: SuccessMessageProps) {
  return (
    <div className="success-message">
      <span>{message}</span>
      <button className="close-button" onClick={onClose}>×</button>
    </div>
  )
}