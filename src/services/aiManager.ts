import { GoogleGenerativeAI } from '@google/generative-ai'
import type { TripData } from '../types'

export class MultiAIManager {
  private geminiAPI: GoogleGenerativeAI | null = null

  constructor() {
    this.initializeAPIs()
  }

  private async initializeAPIs() {
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY
      if (apiKey) {
        this.geminiAPI = new GoogleGenerativeAI(apiKey)
      }
    } catch (error) {
      console.warn('Gemini API não disponível:', error)
    }
  }

  private async callGemini(prompt: string): Promise<string> {
    if (!this.geminiAPI) throw new Error('Gemini API não configurado')
    
    const model = this.geminiAPI.getGenerativeModel({ model: "gemini-2.0-flash-exp" })
    const result = await model.generateContent(prompt)
    return result.response.text()
  }

  private extractTripDataLocal(text: string): TripData {
    const result: TripData = {
      trip_date: null,
      destination_country: null,
      destination_city: null,
      ticket_cost: null,
      accommodation_cost: null,
      daily_allowances: null,
      trip_type: null
    }

    // Regex patterns for extraction
    const patterns = {
      date: /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})|(\d{1,2}\s+de\s+\w+)|(\w+\s+\d{4})/gi,
      money: /R\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?|\d+)/gi,
      cities: /(são paulo|rio de janeiro|salvador|brasília|belo horizonte|fortaleza|buenos aires|santiago|lima|bogotá|caracas|montevideo|asunción|la paz|quito|paris|londres|nova york|madrid|barcelona|lisboa|tokyo|seoul)/gi
    }

    // Extract data using regex
    const dateMatch = text.match(patterns.date)
    if (dateMatch) result.trip_date = dateMatch[0]

    const cityMatch = text.match(patterns.cities)
    if (cityMatch) {
      result.destination_city = cityMatch[0]
      
      const cityCountryMap: Record<string, string> = {
        'são paulo': 'Brasil', 'rio de janeiro': 'Brasil', 'salvador': 'Brasil',
        'brasília': 'Brasil', 'belo horizonte': 'Brasil', 'fortaleza': 'Brasil',
        'buenos aires': 'Argentina', 'santiago': 'Chile', 'lima': 'Peru',
        'bogotá': 'Colômbia', 'caracas': 'Venezuela', 'montevideo': 'Uruguai',
        'asunción': 'Paraguai', 'la paz': 'Bolívia', 'quito': 'Equador',
        'paris': 'França', 'londres': 'Reino Unido', 'nova york': 'Estados Unidos',
        'madrid': 'Espanha', 'barcelona': 'Espanha', 'lisboa': 'Portugal',
        'tokyo': 'Japão', 'seoul': 'Coreia do Sul'
      }
      result.destination_country = cityCountryMap[cityMatch[0].toLowerCase()] || 'Não identificado'
    }

    const moneyMatches = text.match(patterns.money)
    if (moneyMatches && moneyMatches.length >= 1) {
      const lowerText = text.toLowerCase()
      moneyMatches.forEach((match) => {
        const value = parseFloat(match.replace('R$', '').replace(/\./g, '').replace(',', '.'))
        
        if (lowerText.includes('passagem') || lowerText.includes('ticket') || lowerText.includes('voo')) {
          result.ticket_cost = value
        } else if (lowerText.includes('hotel') || lowerText.includes('hospedagem') || lowerText.includes('acomodação')) {
          result.accommodation_cost = value
        } else if (lowerText.includes('diária') || lowerText.includes('alimentação') || lowerText.includes('refeição')) {
          result.daily_allowances = value
        } else {
          if (!result.ticket_cost) result.ticket_cost = value
          else if (!result.accommodation_cost) result.accommodation_cost = value
          else if (!result.daily_allowances) result.daily_allowances = value
        }
      })
    }

    // Classify trip type
    if (result.destination_country) {
      const country = result.destination_country.toLowerCase()
      if (country === 'brasil') {
        result.trip_type = 'Nacional'
      } else if (['argentina', 'chile', 'peru', 'colômbia', 'venezuela', 'uruguai', 'paraguai', 'bolívia', 'equador'].includes(country)) {
        result.trip_type = 'Continental'
      } else {
        result.trip_type = 'Intercontinental'
      }
    }

    return result
  }

  async extractTripData(userMessage: string): Promise<TripData> {
    const prompt = `
    Extraia as seguintes informações desta mensagem sobre viagem de forma precisa:
    "${userMessage}"

    Retorne APENAS um JSON válido com esses campos exatos:
    {
        "trip_date": "data da viagem (formato YYYY-MM-DD ou null)",
        "destination_country": "país de destino ou null",
        "destination_city": "cidade de destino ou null", 
        "ticket_cost": valor_numerico_passagem_ou_null,
        "accommodation_cost": valor_numerico_hospedagem_ou_null,
        "daily_allowances": valor_numerico_diarias_ou_null,
        "trip_type": "Nacional/Continental/Intercontinental baseado no país"
    }

    Regras para trip_type:
    - "Nacional": Brasil
    - "Continental": países sul-americanos (Argentina, Chile, etc.)
    - "Intercontinental": outros países

    NÃO inclua texto explicativo, APENAS o JSON.
    `

    // Try Gemini first
    try {
      console.log('Tentando Gemini API...')
      const response = await this.callGemini(prompt)
      const cleanResponse = response.replace(/```json\n?|\n?```/g, '').trim()
      return JSON.parse(cleanResponse)
    } catch (error) {
      console.warn('Gemini falhou:', error)
    }

    // Fallback to local processing
    console.log('Usando processamento local...')
    return this.extractTripDataLocal(userMessage)
  }
}