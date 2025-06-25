import React from 'react'

interface ErrorMessageProps {
  message: string
  onClose: () => void
}

export function ErrorMessage({ message, onClose }: ErrorMessageProps) {
  return (
    <div className="error-message">
      <span>{message}</span>
      <button className="close-button" onClick={onClose}>×</button>
    </div>
  )
}