import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { LoadingSpinner } from './LoadingSpinner'
import type { User } from '@supabase/supabase-js'
import type { ChatMessage, TripData } from '../types'

interface ChatInterfaceProps {
  user: User
  onTripSaved: () => void
  onError: (error: string) => void
}

type ChatStep = 'initial' | 'date' | 'country' | 'city' | 'tickets' | 'lodging' | 'allowances' | 'reason' | 'confirmation'

const TRIP_REASONS = [
  'JOBI-M',
  'LVM', 
  'SERVIÇOS',
  'INDIRETO',
  'CHILE',
  'COLOMBIA',
  'SALES',
  'OUTROS'
]

export function ChatInterface({ user, onTripSaved, onError }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [currentStep, setCurrentStep] = useState<ChatStep>('initial')
  const [tripData, setTripData] = useState<TripData>({
    trip_date: null,
    destination_country: null,
    destination_city: null,
    ticket_cost: null,
    accommodation_cost: null,
    daily_allowances: null,
    trip_type: null,
    trip_reason: null
  })
  const [loading, setLoading] = useState(false)
  
  // Ref para o container de mensagens para scroll automático
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatMessagesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    initializeChat()
  }, [])

  // Scroll automático sempre que as mensagens mudarem
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight
    }
  }

  const initializeChat = () => {
    setMessages([{
      type: 'ai',
      content: '👋 Olá! Vou te ajudar a registrar sua viagem passo a passo.\n\nVamos começar com a data da viagem.\n\n📅 **Qual foi a data da sua viagem?**\n\nExemplo: 24/05/2025 ou 24/05/25',
      timestamp: new Date()
    }])
    setCurrentStep('date')
  }

  const validateDate = (dateStr: string): string | null => {
    // Try different date formats
    const formats = [
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // DD/MM/YYYY
      /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/, // DD/MM/YY
      /^(\d{4})-(\d{1,2})-(\d{1,2})$/   // YYYY-MM-DD
    ]

    for (const format of formats) {
      const match = dateStr.match(format)
      if (match) {
        let day, month, year
        
        if (format === formats[2]) { // YYYY-MM-DD
          year = parseInt(match[1])
          month = parseInt(match[2])
          day = parseInt(match[3])
        } else { // DD/MM/YYYY or DD/MM/YY
          day = parseInt(match[1])
          month = parseInt(match[2])
          year = parseInt(match[3])
          
          // Convert 2-digit year to 4-digit
          if (year < 100) {
            year = year < 50 ? 2000 + year : 1900 + year
          }
        }

        // Validate date
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
        }
      }
    }
    return null
  }

  const validateCurrency = (value: string): number | null => {
    // Remove R$, spaces, and convert comma to dot
    const cleanValue = value.replace(/[R$\s]/g, '').replace(',', '.')
    const numValue = parseFloat(cleanValue)
    return isNaN(numValue) ? null : numValue
  }

  const validateTripReason = (reason: string): string | null => {
    const upperReason = reason.toUpperCase().trim()
    
    // Check if it's one of the valid reasons
    if (TRIP_REASONS.includes(upperReason)) {
      return upperReason
    }
    
    // Check for partial matches or common variations
    const reasonMap: Record<string, string> = {
      'JOBI': 'JOBI-M',
      'JOBIM': 'JOBI-M',
      'SERVICOS': 'SERVIÇOS',
      'SERVICO': 'SERVIÇOS',
      'SERVICE': 'SERVIÇOS',
      'SERVICES': 'SERVIÇOS',
      'OUTRO': 'OUTROS',
      'OTHER': 'OUTROS'
    }
    
    if (reasonMap[upperReason]) {
      return reasonMap[upperReason]
    }
    
    return null
  }

  const classifyTripType = (country: string): string => {
    const lowerCountry = country.toLowerCase()
    
    if (lowerCountry === 'brasil' || lowerCountry === 'brazil') {
      return 'Nacional'
    }
    
    const southAmericanCountries = [
      'argentina', 'chile', 'peru', 'colômbia', 'colombia', 'venezuela', 
      'uruguai', 'uruguay', 'paraguai', 'paraguay', 'bolívia', 'bolivia', 
      'equador', 'ecuador', 'guiana', 'suriname'
    ]
    
    if (southAmericanCountries.includes(lowerCountry)) {
      return 'Continental'
    }
    
    return 'Intercontinental'
  }

  const handleStepResponse = async () => {
    if (!inputMessage.trim()) return

    const userInput = inputMessage.trim()
    setInputMessage('')

    // Add user message
    const newMessages = [...messages, {
      type: 'user' as const,
      content: userInput,
      timestamp: new Date()
    }]
    setMessages(newMessages)

    let aiResponse = ''
    let nextStep: ChatStep = currentStep

    switch (currentStep) {
      case 'date':
        const validDate = validateDate(userInput)
        if (validDate) {
          setTripData(prev => ({ ...prev, trip_date: validDate }))
          aiResponse = '✅ Data registrada!\n\n🌍 **Qual é o país de destino?**\n\nExemplo: Brasil, Argentina, França, etc.'
          nextStep = 'country'
        } else {
          aiResponse = '❌ Data inválida. Por favor, use um dos formatos:\n• DD/MM/AAAA (ex: 24/05/2025)\n• DD/MM/AA (ex: 24/05/25)\n\n📅 **Qual foi a data da sua viagem?**'
        }
        break

      case 'country':
        if (userInput.length >= 2) {
          const tripType = classifyTripType(userInput)
          setTripData(prev => ({ 
            ...prev, 
            destination_country: userInput,
            trip_type: tripType
          }))
          aiResponse = `✅ País registrado: ${userInput}\n🎯 Tipo de viagem: ${tripType}\n\n🏙️ **Qual é a cidade de destino?**\n\nExemplo: São Paulo, Buenos Aires, Paris, etc.`
          nextStep = 'city'
        } else {
          aiResponse = '❌ Por favor, informe um país válido.\n\n🌍 **Qual é o país de destino?**'
        }
        break

      case 'city':
        if (userInput.length >= 2) {
          setTripData(prev => ({ ...prev, destination_city: userInput }))
          aiResponse = `✅ Cidade registrada: ${userInput}\n\n✈️ **Qual foi o valor gasto com passagens?**\n\nExemplo: R$ 1200 ou 1200,50`
          nextStep = 'tickets'
        } else {
          aiResponse = '❌ Por favor, informe uma cidade válida.\n\n🏙️ **Qual é a cidade de destino?**'
        }
        break

      case 'tickets':
        const ticketCost = validateCurrency(userInput)
        if (ticketCost !== null) {
          setTripData(prev => ({ ...prev, ticket_cost: ticketCost }))
          aiResponse = `✅ Valor das passagens: R$ ${ticketCost.toFixed(2)}\n\n🏨 **Qual foi o valor gasto com hospedagem?**\n\nExemplo: R$ 800 ou 800,00`
          nextStep = 'lodging'
        } else {
          aiResponse = '❌ Valor inválido. Use apenas números.\n\n✈️ **Qual foi o valor gasto com passagens?**\nExemplo: R$ 1200 ou 1200,50'
        }
        break

      case 'lodging':
        const lodgingCost = validateCurrency(userInput)
        if (lodgingCost !== null) {
          setTripData(prev => ({ ...prev, accommodation_cost: lodgingCost }))
          aiResponse = `✅ Valor da hospedagem: R$ ${lodgingCost.toFixed(2)}\n\n💰 **Qual foi o valor das diárias/alimentação?**\n\nExemplo: R$ 450 ou 450,00`
          nextStep = 'allowances'
        } else {
          aiResponse = '❌ Valor inválido. Use apenas números.\n\n🏨 **Qual foi o valor gasto com hospedagem?**\nExemplo: R$ 800 ou 800,00'
        }
        break

      case 'allowances':
        const allowancesCost = validateCurrency(userInput)
        if (allowancesCost !== null) {
          setTripData(prev => ({ ...prev, daily_allowances: allowancesCost }))
          aiResponse = `✅ Valor das diárias: R$ ${allowancesCost.toFixed(2)}\n\n🎯 **Qual é o motivo/centro de custo da viagem?**\n\nOpções disponíveis:\n• JOBI-M\n• LVM\n• SERVIÇOS\n• INDIRETO\n• CHILE\n• COLOMBIA\n• SALES\n• OUTROS\n\nDigite uma das opções acima:`
          nextStep = 'reason'
        } else {
          aiResponse = '❌ Valor inválido. Use apenas números.\n\n💰 **Qual foi o valor das diárias/alimentação?**\nExemplo: R$ 450 ou 450,00'
        }
        break

      case 'reason':
        const validReason = validateTripReason(userInput)
        if (validReason) {
          const updatedTripData = { ...tripData, trip_reason: validReason }
          setTripData(updatedTripData)
          
          // Show confirmation immediately after reason
          aiResponse = 'confirmation'
          nextStep = 'confirmation'
        } else {
          aiResponse = `❌ Motivo/centro de custo inválido. Por favor, escolha uma das opções:\n\n• JOBI-M\n• LVM\n• SERVIÇOS\n• INDIRETO\n• CHILE\n• COLOMBIA\n• SALES\n• OUTROS\n\n🎯 **Qual é o motivo/centro de custo da viagem?**`
        }
        break
    }

    // Add AI response
    const responseMessage: ChatMessage = {
      type: 'ai',
      content: aiResponse,
      data: aiResponse === 'confirmation' ? { ...tripData, trip_reason: validateTripReason(userInput) } : undefined,
      timestamp: new Date()
    }

    setMessages([...newMessages, responseMessage])
    setCurrentStep(nextStep)
  }

  const confirmTripData = async () => {
    try {
      setLoading(true)
      console.log('🔄 Salvando viagem:', tripData)
      
      // Validar dados obrigatórios
      if (!tripData.trip_date || !tripData.destination_country || !tripData.destination_city || 
          tripData.ticket_cost === null || tripData.accommodation_cost === null || 
          tripData.daily_allowances === null || !tripData.trip_reason) {
        throw new Error('Dados incompletos para salvar a viagem')
      }
      
      const tripInsert = {
        user_id: user.id,
        travel_date: tripData.trip_date,
        destination_country: tripData.destination_country,
        destination_city: tripData.destination_city,
        cost_tickets: tripData.ticket_cost,
        cost_lodging: tripData.accommodation_cost,
        cost_daily_allowances: tripData.daily_allowances,
        cost_center: tripData.trip_reason, // Use trip_reason as cost_center
        trip_type: tripData.trip_type,
        trip_reason: tripData.trip_reason
      }

      console.log('📤 Dados para inserção:', tripInsert)

      const { data, error } = await supabase
        .from('trips')
        .insert([tripInsert])
        .select()

      if (error) {
        console.error('❌ Erro do Supabase:', error)
        throw error
      }

      console.log('✅ Viagem salva com sucesso:', data)

      const successMessage: ChatMessage = {
        type: 'ai',
        content: '✅ Viagem registrada com sucesso!\n\nVocê pode ver ela no seu dashboard. Deseja registrar outra viagem?',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, successMessage])

      // Reset for new trip
      setTripData({
        trip_date: null,
        destination_country: null,
        destination_city: null,
        ticket_cost: null,
        accommodation_cost: null,
        daily_allowances: null,
        trip_type: null,
        trip_reason: null
      })
      setCurrentStep('initial')
      
      onTripSaved()

    } catch (error: any) {
      console.error('❌ Erro ao salvar viagem:', error)
      onError(`Erro ao registrar viagem: ${error.message || 'Erro desconhecido'}`)
    } finally {
      setLoading(false)
    }
  }

  const startNewTrip = () => {
    setTripData({
      trip_date: null,
      destination_country: null,
      destination_city: null,
      ticket_cost: null,
      accommodation_cost: null,
      daily_allowances: null,
      trip_type: null,
      trip_reason: null
    })
    
    const newTripMessage: ChatMessage = {
      type: 'ai',
      content: '🆕 Vamos registrar uma nova viagem!\n\n📅 **Qual foi a data da sua viagem?**\n\nExemplo: 24/05/2025 ou 24/05/25',
      timestamp: new Date()
    }
    setMessages(prev => [...prev, newTripMessage])
    setCurrentStep('date')
  }

  const formatCurrency = (value: number | null) => {
    if (!value) return '0,00'
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Não informado'
    return new Date(dateStr).toLocaleDateString('pt-BR')
  }

  return (
    <div>
      <h2>Registrar Nova Viagem</h2>
      
      <div className="chat-container">
        <div className="chat-header">
          🤖 Assistente de Viagem - Passo a Passo
        </div>
        
        <div className="chat-messages" ref={chatMessagesRef}>
          {messages.map((message, index) => (
            <div key={index} className={`message ${message.type}`}>
              <div className="message-content">
                {message.content === 'confirmation' && message.data ? (
                  <div className="confirmation-card">
                    <div className="confirmation-title">
                      📋 Resumo da sua viagem:
                    </div>
                    <div className="confirmation-data">
                      <p><strong>📅 Data:</strong> {formatDate(message.data.trip_date)}</p>
                      <p><strong>🌍 País:</strong> {message.data.destination_country}</p>
                      <p><strong>🏙️ Cidade:</strong> {message.data.destination_city}</p>
                      <p><strong>✈️ Passagem:</strong> R$ {formatCurrency(message.data.ticket_cost)}</p>
                      <p><strong>🏨 Hospedagem:</strong> R$ {formatCurrency(message.data.accommodation_cost)}</p>
                      <p><strong>💰 Diárias:</strong> R$ {formatCurrency(message.data.daily_allowances)}</p>
                      <p><strong>🎯 Motivo/Centro de Custo:</strong> {message.data.trip_reason}</p>
                      <p><strong>📊 Tipo:</strong> {message.data.trip_type}</p>
                      <p><strong>💵 Total:</strong> R$ {formatCurrency(
                        (message.data.ticket_cost || 0) + 
                        (message.data.accommodation_cost || 0) + 
                        (message.data.daily_allowances || 0)
                      )}</p>
                    </div>
                    <div className="confirmation-buttons">
                      <button 
                        className="btn btn-primary"
                        onClick={confirmTripData}
                        disabled={loading}
                      >
                        {loading ? 'Salvando...' : '✅ Confirmar e Salvar'}
                      </button>
                      <button 
                        className="btn btn-secondary"
                        onClick={startNewTrip}
                        disabled={loading}
                      >
                        ❌ Recomeçar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{whiteSpace: 'pre-line'}}>
                    {message.content}
                    {message.type === 'ai' && currentStep === 'initial' && message.content.includes('Deseja registrar outra viagem?') && (
                      <div style={{marginTop: '1rem'}}>
                        <button 
                          className="btn btn-primary"
                          onClick={startNewTrip}
                          style={{marginRight: '0.5rem'}}
                        >
                          🆕 Nova Viagem
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {/* Elemento invisível para scroll automático */}
          <div ref={messagesEndRef} />
        </div>
        
        <div className="chat-input">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !loading && currentStep !== 'confirmation' && currentStep !== 'initial' && handleStepResponse()}
            placeholder={
              currentStep === 'date' ? 'Ex: 24/05/2025' :
              currentStep === 'country' ? 'Ex: Brasil' :
              currentStep === 'city' ? 'Ex: São Paulo' :
              currentStep === 'tickets' ? 'Ex: R$ 1200' :
              currentStep === 'lodging' ? 'Ex: R$ 800' :
              currentStep === 'allowances' ? 'Ex: R$ 450' :
              currentStep === 'reason' ? 'Ex: JOBI-M' :
              'Digite sua resposta...'
            }
            disabled={loading || currentStep === 'confirmation' || currentStep === 'initial'}
          />
          <button 
            className="btn btn-primary"
            onClick={handleStepResponse}
            disabled={loading || !inputMessage.trim() || currentStep === 'confirmation' || currentStep === 'initial'}
          >
            {loading ? <LoadingSpinner /> : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  )
}