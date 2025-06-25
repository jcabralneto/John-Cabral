import React, { useState, useEffect, useRef } from "react";
import { createClient, User } from "@supabase/supabase-js";

const SUPABASE_URL = "https://jfheipwozfewogwxuxqt.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmaGVpcHdvemZld29nd3h1eHF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk3NDg1MjQsImV4cCI6MjA2NTMyNDUyNH0.RQCcFUahD1MzzJJSh0jqMnSOFTwDq5y9Mzxr5JtheSY";
const ADMIN_EMAIL = "admin@gridspertise.com";
const TRIP_REASONS = ["JOBI-M", "LVM", "SERVIÇOS", "INDIRETO", "CHILE", "COLOMBIA", "SALES", "OUTROS"];
const TRIP_TYPES = ["Nacional", "Continental", "Intercontinental"];
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

type Trip = {
  id: string;
  user_id: string;
  profiles?: { email: string };
  trip_date: string;
  destination_country: string;
  destination_city: string;
  ticket_cost: number;
  accommodation_cost: number;
  daily_allowances: number;
  trip_type: string;
  cost_center?: string;
  trip_reason?: string;
  created_at: string;
};

type UserProfile = {
  id: string;
  name: string;
  email: string;
  role: string;
};

function formatCurrency(value: number | null | undefined) {
  if (!value) return "0,00";
  return Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
}
function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "";
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("pt-BR");
  } catch {
    return dateStr || "";
  }
}

function LoadingSpinner() {
  return <span>⏳</span>;
}
function Navbar({ user, userProfile, setCurrentView, onLogout }: {
  user: User | null;
  userProfile: UserProfile | null;
  setCurrentView: (view: string) => void;
  onLogout: () => void;
}) {
  return (
    <nav className="navbar">
      <h1 style={{ fontSize: "1.6rem", color: "#003366", margin: 0 }}>
        Gridspertise Travel
      </h1>
      {user && userProfile && (
        <div className="navbar-right">
          <button
            className="btn btn-secondary"
            onClick={() =>
              setCurrentView(
                userProfile.role === "admin" ? "adminDashboard" : "userDashboard"
              )
            }
          >
            {userProfile.role === "admin"
              ? "Admin Dashboard"
              : "Minhas Viagens"}
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setCurrentView("chat")}
          >
            Nova Viagem
          </button>
          <div className="navbar-email">{user.email}</div>
          <button className="btn btn-danger" onClick={onLogout}>
            Sair
          </button>
        </div>
      )}
    </nav>
  );
}

function UserDashboard({ trips }: { trips: Trip[] }) {
  return (
    <div>
      <h2>Minhas Viagens</h2>
      {!trips.length ? (
        <div style={{ textAlign: "center", padding: "3rem" }}>
          Você não tem viagens registradas.
        </div>
      ) : (
        <div style={{ overflowX: "auto", marginTop: 10 }}>
          <table>
            <thead>
              <tr>
                {["Data", "Destino", "Motivo", "Tipo", "Total (R$)"].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trips.map((trip) => (
                <tr key={trip.id}>
                  <td>{formatDate(trip.trip_date)}</td>
                  <td>
                    {trip.destination_city || "-"}, {trip.destination_country || "-"}
                  </td>
                  <td>{trip.cost_center || trip.trip_reason || "-"}</td>
                  <td>{trip.trip_type || "-"}</td>
                  <td>
                    {formatCurrency(
                      (Number(trip.ticket_cost) || 0) +
                        (Number(trip.accommodation_cost) || 0) +
                        (Number(trip.daily_allowances) || 0)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AdminDashboard({ allTrips, loading }: { allTrips: Trip[]; loading: boolean }) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [tripType, setTripType] = useState("");
  const [tripReason, setTripReason] = useState("");
  const filteredTrips = allTrips.filter((trip) => {
    let ok = true;
    if (startDate) ok = ok && trip.trip_date >= startDate;
    if (endDate) ok = ok && trip.trip_date <= endDate;
    if (tripType) ok = ok && trip.trip_type === tripType;
    if (tripReason) ok = ok && (trip.cost_center || trip.trip_reason) === tripReason;
    return ok;
  });
  const totalTrips = filteredTrips.length;
  const totalCost = filteredTrips.reduce(
    (sum, trip) =>
      sum +
      (Number(trip.ticket_cost) || 0) +
      (Number(trip.accommodation_cost) || 0) +
      (Number(trip.daily_allowances) || 0),
    0
  );
  const byReason: Record<string, number> = {};
  filteredTrips.forEach((trip) => {
    const r = trip.cost_center || trip.trip_reason || "OUTROS";
    byReason[r] = (byReason[r] || 0) + 1;
  });
  return (
    <div>
      <h2>Dashboard Administrativo</h2>
      <div className="filter-group">
        <label>Data Inicial:</label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        <label>Data Final:</label>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
        <label>Tipo de Viagem:</label>
        <select value={tripType} onChange={(e) => setTripType(e.target.value)}>
          <option value="">Todos</option>
          {TRIP_TYPES.map((t) => (
            <option value={t} key={t}>
              {t}
            </option>
          ))}
        </select>
        <label>Centro de Custo:</label>
        <select value={tripReason} onChange={(e) => setTripReason(e.target.value)}>
          <option value="">Todos</option>
          {TRIP_REASONS.map((t) => (
            <option value={t} key={t}>
              {t}
            </option>
          ))}
        </select>
        {(startDate || endDate || tripType || tripReason) && (
          <button
            style={{
              marginLeft: "1.3rem",
              background: "#003366",
              color: "#fff",
              padding: "0.5rem 1rem",
              borderRadius: "5px",
              border: "none",
              fontWeight: 600,
              cursor: "pointer",
            }}
            onClick={() => {
              setStartDate("");
              setEndDate("");
              setTripType("");
              setTripReason("");
            }}
          >
            Limpar Filtros
          </button>
        )}
      </div>
      <div className="dashboard-kpi">
        <div className="kpi-card">
          <div className="kpi-title">{totalTrips}</div>
          <div className="kpi-label">Total de Viagens</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-title">R$ {formatCurrency(totalCost)}</div>
          <div className="kpi-label">Custo Total</div>
        </div>
        {Object.entries(byReason).map(([reason, count]) => (
          <div key={reason} className="kpi-reason">
            <div style={{ fontWeight: "bold", color: "#5e6672" }}>{reason}</div>
            <div
              style={{
                color: "#003366",
                fontWeight: "bold",
                fontSize: "1.08rem",
              }}
            >
              {count} viagens
            </div>
          </div>
        ))}
      </div>
      <h3 style={{ marginTop: "2.5rem", color: "#003366" }}>Todas as Viagens</h3>
      {loading ? (
        <div className="loading">Carregando...</div>
      ) : (
        <div style={{ overflowX: "auto", marginTop: 10 }}>
          <table>
            <thead>
              <tr>
                {["Data", "Destino", "Motivo", "Tipo", "Usuário", "Total (R$)"].map(
                  (h) => (
                    <th key={h}>{h}</th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {filteredTrips.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center" }}>
                    Nenhum resultado.
                  </td>
                </tr>
              ) : (
                filteredTrips.map((trip) => (
                  <tr key={trip.id}>
                    <td>{formatDate(trip.trip_date)}</td>
                    <td>
                      {trip.destination_city || "-"}, {trip.destination_country || "-"}
                    </td>
                    <td>{trip.cost_center || trip.trip_reason || "-"}</td>
                    <td>{trip.trip_type || "-"}</td>
                    <td>
                      {trip.profiles && trip.profiles.email
                        ? trip.profiles.email
                        : trip.user_id || "-"}
                    </td>
                    <td>
                      {formatCurrency(
                        (Number(trip.ticket_cost) || 0) +
                          (Number(trip.accommodation_cost) || 0) +
                          (Number(trip.daily_allowances) || 0)
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
function ChatInterface({ user, onTripSaved, onError }: {
  user: User;
  onTripSaved: () => void;
  onError: (msg: string) => void;
}) {
  const [messages, setMessages] = useState<{ type: 'ai' | 'user'; content: string }[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [currentStep, setCurrentStep] = useState<'date'|'country'|'city'|'tickets'|'lodging'|'allowances'|'reason'|'confirmation'>('date');
  const [tripData, setTripData] = useState({
    trip_date: null as string | null,
    destination_country: null as string | null,
    destination_city: null as string | null,
    ticket_cost: null as number | null,
    accommodation_cost: null as number | null,
    daily_allowances: null as number | null,
    trip_type: null as string | null,
    trip_reason: null as string | null,
  });
  const [loading, setLoading] = useState(false);
  const chatMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initializeChat();
  }, []);

  useEffect(() => {
    if (chatMessagesRef.current)
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
  }, [messages]);

  function initializeChat() {
    setMessages([
      {
        type: "ai",
        content:
          "👋 Olá! Vou te ajudar a registrar sua viagem passo a passo.\n\n📅 Qual foi a data da sua viagem? (Ex: 24/05/2025 ou 24/05/25)",
      },
    ]);
    setCurrentStep("date");
  }

  function validateDate(dateStr: string) {
    const formats = [
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
      /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/,
      /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
    ];
    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        let day, month, year;
        if (format === formats[2]) {
          year = parseInt(match[1]);
          month = parseInt(match[2]);
          day = parseInt(match[3]);
        } else {
          day = parseInt(match[1]);
          month = parseInt(match[2]);
          year = parseInt(match[3]);
          if (year < 100) year = year < 50 ? 2000 + year : 1900 + year;
        }
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          return `${year}-${month.toString().padStart(2, "0")}-${day
            .toString()
            .padStart(2, "0")}`;
        }
      }
    }
    return null;
  }

  function validateCurrency(value: string) {
    const cleanValue = value.replace(/[R$\s.]/g, "").replace(",", ".");
    const numValue = parseFloat(cleanValue);
    return isNaN(numValue) ? null : numValue;
  }

  function validateTripReason(reason: string) {
    const upperReason = reason.toUpperCase().trim();
    const reasonMap: Record<string, string> = {
      JOBI: "JOBI-M",
      JOBIM: "JOBI-M",
      SERVICOS: "SERVIÇOS",
      SERVICO: "SERVIÇOS",
      SERVICE: "SERVIÇOS",
      SERVICES: "SERVIÇOS",
      OUTRO: "OUTROS",
      OTHER: "OUTROS",
    };
    if (TRIP_REASONS.includes(upperReason)) return upperReason;
    return reasonMap[upperReason] || null;
  }

  function classifyTripType(country: string) {
    const lowerCountry = country.toLowerCase();
    if (lowerCountry === "brasil" || lowerCountry === "brazil") return "Nacional";
    const southAmericanCountries = [
      "argentina",
      "chile",
      "peru",
      "colômbia",
      "colombia",
      "venezuela",
      "uruguai",
      "uruguay",
      "paraguai",
      "paraguay",
      "bolívia",
      "bolivia",
      "equador",
      "ecuador",
      "guiana",
      "suriname",
    ];
    if (southAmericanCountries.includes(lowerCountry)) return "Continental";
    return "Intercontinental";
  }

  async function handleStepResponse() {
    if (!inputMessage.trim()) return;
    const userInput = inputMessage.trim();
    setInputMessage("");
    setMessages((prev) => [
      ...prev,
      { type: "user", content: userInput },
    ]);
    let aiResponse = "";
    let nextStep = currentStep;
    switch (currentStep) {
      case "date": {
        const validDate = validateDate(userInput);
        if (validDate) {
          setTripData((prev) => ({ ...prev, trip_date: validDate }));
          aiResponse = "✅ Data registrada!\n\n🌍 País de destino? (Ex: Brasil, Argentina)";
          nextStep = "country";
        } else {
          aiResponse = "❌ Data inválida. Tente: 24/05/2025";
        }
        break;
      }
      case "country": {
        if (userInput.length >= 2) {
          const tripType = classifyTripType(userInput);
          setTripData((prev) => ({ ...prev, destination_country: userInput, trip_type: tripType }));
          aiResponse = `✅ País: ${userInput} (${tripType})\n\n🏙️ Cidade de destino?`;
          nextStep = "city";
        } else {
          aiResponse = "❌ Informe um país válido.";
        }
        break;
      }
      case "city": {
        if (userInput.length >= 2) {
          setTripData((prev) => ({ ...prev, destination_city: userInput }));
          aiResponse = `✅ Cidade: ${userInput}\n\n✈️ Custo das passagens? (Ex: R$ 1200)`;
          nextStep = "tickets";
        } else {
          aiResponse = "❌ Informe uma cidade válida.";
        }
        break;
      }
      case "tickets": {
        const ticketCost = validateCurrency(userInput);
        if (ticketCost !== null) {
          setTripData((prev) => ({ ...prev, ticket_cost: ticketCost }));
          aiResponse = `✅ Passagens: R$ ${formatCurrency(ticketCost)}\n\n🏨 Hospedagem?`;
          nextStep = "lodging";
        } else {
          aiResponse = "❌ Valor inválido. Use números.";
        }
        break;
      }
      case "lodging": {
        const lodgingCost = validateCurrency(userInput);
        if (lodgingCost !== null) {
          setTripData((prev) => ({ ...prev, accommodation_cost: lodgingCost }));
          aiResponse = `✅ Hospedagem: R$ ${formatCurrency(lodgingCost)}\n\n💰 Diárias/alimentação?`;
          nextStep = "allowances";
        } else {
          aiResponse = "❌ Valor inválido. Use números.";
        }
        break;
      }
      case "allowances": {
        const allowancesCost = validateCurrency(userInput);
        if (allowancesCost !== null) {
          setTripData((prev) => ({ ...prev, daily_allowances: allowancesCost }));
          aiResponse = `✅ Diárias: R$ ${formatCurrency(allowancesCost)}\n\n🎯 Motivo/Centro de custo? Opções: ${TRIP_REASONS.join(", ")}`;
          nextStep = "reason";
        } else {
          aiResponse = "❌ Valor inválido. Use números.";
        }
        break;
      }
      case "reason": {
        const validReason = validateTripReason(userInput);
        if (validReason) {
          setTripData((prev) => ({ ...prev, trip_reason: validReason }));
          aiResponse = "📋 Confirma os dados? (Digite 'sim' para salvar ou 'não' para cancelar)";
          nextStep = "confirmation";
        } else {
          aiResponse = `❌ Motivo inválido. Opções: ${TRIP_REASONS.join(", ")}`;
        }
        break;
      }
      case "confirmation": {
        if (userInput.toLowerCase() === "sim") {
          await confirmTripData();
          return;
        } else if (userInput.toLowerCase() === "não") {
          setMessages((prev) => [
            ...prev,
            { type: "ai", content: "Operação cancelada. Se quiser registrar nova viagem, comece informando a data." },
          ]);
          setTripData({
            trip_date: null,
            destination_country: null,
            destination_city: null,
            ticket_cost: null,
            accommodation_cost: null,
            daily_allowances: null,
            trip_type: null,
            trip_reason: null,
          });
          setCurrentStep("date");
          return;
        } else {
          aiResponse = "Por favor, digite 'sim' para salvar ou 'não' para cancelar.";
        }
        break;
      }
      default:
        aiResponse = "Passo não reconhecido.";
    }
    setMessages((prev) => [
      ...prev,
      { type: "ai", content: aiResponse },
    ]);
    setCurrentStep(nextStep);
  }

  async function confirmTripData() {
    setLoading(true);
    try {
      if (!tripData.trip_date || !tripData.destination_country || !tripData.destination_city ||
          tripData.ticket_cost === null || tripData.accommodation_cost === null ||
          tripData.daily_allowances === null || !tripData.trip_reason) {
        throw new Error('Preencha todas as informações antes de salvar.');
      }
      const tripInsert = {
        user_id: user.id,
        trip_date: tripData.trip_date,
        destination_country: tripData.destination_country,
        destination_city: tripData.destination_city,
        ticket_cost: tripData.ticket_cost,
        accommodation_cost: tripData.accommodation_cost,
        daily_allowances: tripData.daily_allowances,
        cost_center: tripData.trip_reason,
        trip_type: tripData.trip_type,
      };
      const { error } = await supabase.from('trips').insert([tripInsert]);
      if (error) throw new Error(error.message);
      setMessages((prev) => [
        ...prev,
        { type: "ai", content: "✅ Viagem registrada com sucesso!" },
      ]);
      setTripData({
        trip_date: null,
        destination_country: null,
        destination_city: null,
        ticket_cost: null,
        accommodation_cost: null,
        daily_allowances: null,
        trip_type: null,
        trip_reason: null,
      });
      setCurrentStep("date");
      onTripSaved();
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { type: "ai", content: `❌ Erro ao salvar viagem: ${err.message}` },
      ]);
      onError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="chat-container" style={{ maxWidth: 560, margin: "2rem auto", border: "1px solid #d5d6dc", borderRadius: 10, padding: 16 }}>
      <div className="chat-messages" ref={chatMessagesRef} style={{ height: 320, overflowY: "auto", background: "#f6f7f9", padding: 10, marginBottom: 16 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ textAlign: m.type === 'user' ? 'right' : 'left', margin: '8px 0' }}>
            <span style={{
              display: 'inline-block',
              background: m.type === 'user' ? '#003366' : '#dde3f6',
              color: m.type === 'user' ? '#fff' : '#202e3c',
              borderRadius: 8,
              padding: '8px 16px',
              maxWidth: '80%',
              fontSize: '1rem',
            }}>{m.content}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={inputMessage}
          onChange={e => setInputMessage(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !loading && handleStepResponse()}
          placeholder={
            currentStep === 'date' ? 'Ex: 24/05/2025' :
            currentStep === 'country' ? 'Ex: Brasil' :
            currentStep === 'city' ? 'Ex: São Paulo' :
            currentStep === 'tickets' ? 'Ex: 1200' :
            currentStep === 'lodging' ? 'Ex: 800' :
            currentStep === 'allowances' ? 'Ex: 450' :
            currentStep === 'reason' ? 'Ex: JOBI-M' :
            ''
          }
          disabled={loading}
          style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid #ccc' }}
        />
        <button className="btn btn-primary" onClick={handleStepResponse} disabled={loading || !inputMessage.trim()}>
          {loading ? <LoadingSpinner /> : 'Enviar'}
        </button>
      </div>
    </div>
  );
}

// =====================
// APP PRINCIPAL
// =====================

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [currentView, setCurrentView] = useState<'auth'|'userDashboard'|'adminDashboard'|'chat'>('auth');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [trips, setTrips] = useState<Trip[]>([]);
  const [allTrips, setAllTrips] = useState<Trip[]>([]);

  // Autenticação + carregamento de perfil
  useEffect(() => {
    let mounted = true;
    const checkSession = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (session && mounted) {
        setUser(session.user);
        await fetchUserProfile(session.user.id);
      } else {
        setCurrentView('auth');
      }
      setLoading(false);
    };
    checkSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setLoading(true);
      setUser(session?.user ?? null);
      if (session && session.user) {
        await fetchUserProfile(session.user.id);
      } else {
        setUserProfile(null);
        setCurrentView('auth');
        setTrips([]);
        setAllTrips([]);
      }
      setLoading(false);
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error: profileError } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (profileError && profileError.code !== 'PGRST116') throw profileError;
      if(data) {
        setUserProfile(data);
        setCurrentView(data.role === 'admin' ? 'adminDashboard' : 'userDashboard');
        fetchTrips(data.role === 'admin', userId);
      } else {
        setError('Perfil de usuário não encontrado.');
        setCurrentView('auth');
        await supabase.auth.signOut();
      }
    } catch (err) {
      setError('Erro ao carregar perfil.');
      setCurrentView('auth');
    }
  };

  const fetchTrips = async (isAdmin = false, userId?: string) => {
    setLoading(true);
    try {
      if (isAdmin) {
        const { data, error } = await supabase.from('trips').select('*, profiles:user_id (email), cost_center AS trip_reason').order('created_at', { ascending: false });
        if (error) throw error;
        setAllTrips(data || []);
      } else if (userId) {
        const { data, error } = await supabase.from('trips').select('*, cost_center AS trip_reason').eq('user_id', userId).order('created_at', { ascending: false });
        if (error) throw error;
        setTrips(data || []);
      }
    } catch {
      setError('Erro ao carregar viagens.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && userProfile && (currentView === 'userDashboard' || currentView === 'adminDashboard')) {
      fetchTrips(userProfile.role === 'admin', user.id);
    }
  }, [currentView, user, userProfile]);

  const [authMode, setAuthMode] = useState<'login'|'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError(''); setSuccess('');
    try {
      if (authMode === 'login') {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      } else {
        const { error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        setSuccess('Conta criada! Verifique seu e-mail.');
        setAuthMode('login');
      }
    } catch (err: any) { setError(err.message || 'Falha na autenticação.'); }
    finally { setLoading(false); }
  };

  const handleLogout = async () => {
    setLoading(true); setError(''); setSuccess('');
    await supabase.auth.signOut();
    setLoading(false); setSuccess('Logout realizado com sucesso.');
  };

  const handleTripSavedByChat = () => {
    setSuccess('Viagem registrada com sucesso!');
    if (user && userProfile) {
      fetch
// ... (mantenha os imports e utilitários acima)

function ChatInterface({ user, onTripSaved, onError }) {
  // ... (código igual ao enviado anteriormente na parte 3)
  // [Cole exatamente o código da ChatInterface enviado na última resposta]
}

// =====================
// APP PRINCIPAL
// =====================

export default function App() {
  // ... (toda lógica da função App, igual à última resposta)
  // [Cole exatamente o código da função App enviado na última resposta]
}
