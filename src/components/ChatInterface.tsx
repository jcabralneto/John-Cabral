import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { LoadingSpinner } from './LoadingSpinner'
import type { User } from '@supabase/supabase-js'
import type { ChatMessage, TripData } from '../types'
import type { MultiAIManager } from '../services/aiManager'

interface ChatInterfaceProps {
  user: User
  aiManager: MultiAIManager
  onTripSaved: () => void
  onError: (error: string) => void
}

export function ChatInterface({ user, aiManager, onTripSaved, onError }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [pendingTripData, setPendingTripData] = useState<TripData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    initializeChat()
  }, [])

  const initializeChat = () => {
    if (messages.length === 0) {
      setMessages([{
        type: 'ai',
        content: '👋 Olá! Sou seu assistente para registro de viagens. \n\nDescreva sua viagem e eu vou extrair automaticamente:\n• Data da viagem\n• Destino (país e cidade)\n• Custos (passagem, hospedagem, diárias)\n• Tipo da viagem\n• Centro de custo (opcional)\n\nExemplo: "Preciso registrar viagem para Buenos Aires dia 20/08, gastei R$ 1.200 na passagem, R$ 800 no hotel e R$ 400 em diárias"',
        timestamp: new Date()
      }])
    }
  }

  const handleChatMessage = async () => {
    if (!inputMessage.trim()) return

    const userMessage = inputMessage.trim()
    setInputMessage('')
    setChatLoading(true)

    const newMessages = [...messages, {
      type: 'user' as const,
      content: userMessage,
      timestamp: new Date()
    }]
    setMessages(newMessages)

    try {
      const tripData = await aiManager.extractTripData(userMessage)
      
      const aiResponse: ChatMessage = {
        type: 'ai',
        content: 'Analisando sua mensagem...',
        timestamp: new Date()
      }
      setMessages([...newMessages, aiResponse])

      const hasValidData = tripData.destination_country || tripData.destination_city || 
                         tripData.ticket_cost || tripData.accommodation_cost || tripData.daily_allowances

      if (hasValidData) {
        setPendingTripData(tripData)
        
        const confirmationMessage: ChatMessage = {
          type: 'ai',
          content: 'confirmation',
          data: tripData,
          timestamp: new Date()
        }
        setMessages([...newMessages, confirmationMessage])
      } else {
        const helpMessage: ChatMessage = {
          type: 'ai',
          content: 'Não consegui identificar todos os dados da sua viagem. Por favor, informe:\n\n• Data da viagem\n• País e cidade de destino\n• Valor da passagem (R$)\n• Valor da hospedagem (R$)\n• Valor das diárias (R$)\n• Centro de custo (opcional)\n\nExemplo: "Viagem para São Paulo dia 15/07, passagem R$ 800, hotel R$ 300, diárias R$ 200, centro de custo TI"',
          timestamp: new Date()
        }
        setMessages([...newMessages, helpMessage])
      }

    } catch (error) {
      console.error('Erro no chat:', error)
      const errorMessage: ChatMessage = {
        type: 'ai',
        content: 'Desculpe, houve um erro ao processar sua mensagem. Tente novamente ou digite as informações de forma mais clara.',
        timestamp: new Date()
      }
      setMessages([...newMessages, errorMessage])
    } finally {
      setChatLoading(false)
    }
  }

  const confirmTripData = async () => {
    if (!pendingTripData) return

    try {
      setLoading(true)
      
      // Map the data to the correct database schema
      const tripInsert = {
        user_id: user.id,
        travel_date: pendingTripData.trip_date,
        destination_country: pendingTripData.destination_country,
        destination_city: pendingTripData.destination_city,
        cost_tickets: pendingTripData.ticket_cost,
        cost_lodging: pendingTripData.accommodation_cost,
        cost_daily_allowances: pendingTripData.daily_allowances,
        cost_center: 'Não informado', // Default value
        trip_type: pendingTripData.trip_type
      }

      const { error } = await supabase
        .from('trips')
        .insert([tripInsert])

      if (error) throw error

      const successMessage: ChatMessage = {
        type: 'ai',
        content: '✅ Viagem registrada com sucesso! Você pode ver ela no seu dashboard.',
        timestamp: new Date()
      }
      setMessages([...messages, successMessage])

      setPendingTripData(null)
      onTripSaved()

    } catch (error: any) {
      console.error('Erro ao salvar viagem:', error)
      onError('Erro ao registrar viagem. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const rejectTripData = () => {
    setPendingTripData(null)
    const retryMessage: ChatMessage = {
      type: 'ai',
      content: 'Ok, vamos tentar novamente. Descreva sua viagem com mais detalhes.',
      timestamp: new Date()
    }
    setMessages([...messages, retryMessage])
  }

  const formatCurrency = (value: number | null) => {
    if (!value) return '0,00'
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
  }

  return (
    <div>
      <h2>Registrar Nova Viagem</h2>
      
      <div className="chat-container">
        <div className="chat-header">
          🤖 Assistente de Viagem IA
        </div>
        
        <div className="chat-messages">
          {messages.map((message, index) => (
            <div key={index} className={`message ${message.type}`}>
              <div className="message-content">
                {message.content === 'confirmation' && message.data ? (
                  <div className="confirmation-card">
                    <div className="confirmation-title">
                      📋 Dados extraídos da sua viagem:
                    </div>
                    <div className="confirmation-data">
                      <p><strong>📅 Data:</strong> {message.data.trip_date || 'Não informado'}</p>
                      <p><strong>🌍 País:</strong> {message.data.destination_country || 'Não informado'}</p>
                      <p><strong>🏙️ Cidade:</strong> {message.data.destination_city || 'Não informado'}</p>
                      <p><strong>✈️ Passagem:</strong> R$ {formatCurrency(message.data.ticket_cost)}</p>
                      <p><strong>🏨 Hospedagem:</strong> R$ {formatCurrency(message.data.accommodation_cost)}</p>
                      <p><strong>💰 Diárias:</strong> R$ {formatCurrency(message.data.daily_allowances)}</p>
                      <p><strong>🎯 Tipo:</strong> {message.data.trip_type || 'Não classificado'}</p>
                    </div>
                    <div className="confirmation-buttons">
                      <button 
                        className="btn btn-primary"
                        onClick={confirmTripData}
                        disabled={loading}
                      >
                        {loading ? 'Salvando...' : '✅ Confirmar'}
                      </button>
                      <button 
                        className="btn btn-secondary"
                        onClick={rejectTripData}
                      >
                        ❌ Corrigir
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{whiteSpace: 'pre-line'}}>
                    {message.content}
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {chatLoading && (
            <div className="message ai">
              <div className="message-content">
                <LoadingSpinner text="Processando com IA..." />
              </div>
            </div>
          )}
        </div>
        
        <div className="chat-input">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !chatLoading && handleChatMessage()}
            placeholder="Descreva sua viagem..."
            disabled={chatLoading}
          />
          <button 
            className="btn btn-primary"
            onClick={handleChatMessage}
            disabled={chatLoading || !inputMessage.trim()}
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  )
}