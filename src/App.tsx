import React from 'react'
import { Calculator } from './components/Calculator'
import './App.css'

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            Testing Demo App
          </h1>
          <p className="text-lg text-gray-600">
            A React application with comprehensive testing setup using Vitest
          </p>
        </header>
        
        <main>
          <Calculator />
        </main>
        
        <footer className="text-center mt-12 text-gray-500">
          <p>Run tests with: <code className="bg-gray-200 px-2 py-1 rounded">npm test</code></p>
        </footer>
      </div>
    </div>
  )
}

export default App