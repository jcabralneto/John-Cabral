import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { DatabaseService } from './services/databaseService';
import { AuthView } from './components/AuthView';
import { Navbar } from './components/Navbar';
import { UserDashboard } from './components/UserDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { ChatInterface } from './components/ChatInterface';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ErrorMessage } from './components/ErrorMessage';
import { SuccessMessage } from './components/SuccessMessage';
import type { User } from '@supabase/supabase-js';
import type { UserProfile, Trip } from './types';
import './App.css';

// Centraliza os e-mails de admin como um array para fácil manutenção e maior flexibilidade
const ADMIN_EMAILS = ['admin@gridspertise.com'];

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [currentView, setCurrentView] = useState<'auth' | 'userDashboard' | 'adminDashboard' | 'chat'>('auth');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [trips, setTrips] = useState<Trip[]>([]);
  const [allTrips, setAllTrips] = useState<Trip[]>([]);

  // Verifica o usuário logado e gerencia o estado de autenticação
  useEffect(() => {
    let mounted = true; // Flag para evitar atualizações de estado em componentes desmontados

    const initializeAuth = async () => {
      try {
        console.log('🔄 Inicializando autenticação...');
        
        // Adiciona um timeout para a verificação da sessão para evitar bloqueios
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Session timeout')), 8000)
        );

        // Compete entre a busca da sessão e o timeout
        const { data: { session }, error } = await Promise.race([sessionPromise, timeoutPromise]);
        
        if (error) {
          console.error('❌ Erro na sessão:', error.message);
          if (mounted) {
            setError('Erro ao verificar sessão. Tente fazer login novamente.');
            setLoading(false);
          }
          return;
        }

        if (session?.user && mounted) {
          console.log('✅ Sessão encontrada, carregando usuário...');
          await handleUserLogin(session.user);
        } else {
          console.log('ℹ️ Nenhuma sessão encontrada.');
          if (mounted) {
            setLoading(false);
          }
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido.';
        console.error('❌ Erro na inicialização da autenticação:', errorMessage);
        if (mounted) {
          if (errorMessage === 'Session timeout') {
            setError('Timeout na verificação de sessão. Verifique sua conexão.');
          } else {
            setError(`Erro ao inicializar autenticação: ${errorMessage}`);
          }
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Listener para mudanças no estado de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 Estado de autenticação alterado:', event);
      
      if (!mounted) return; // Não atualiza o estado se o componente estiver desmontado

      if (event === 'SIGNED_IN' && session?.user) {
        await handleUserLogin(session.user);
      } else if (event === 'SIGNED_OUT') {
        console.log('👋 Usuário deslogado');
        // Limpa todos os estados ao fazer logout
        setUser(null);
        setUserProfile(null);
        setCurrentView('auth');
        setTrips([]);
        setAllTrips([]);
        setError('');
        setSuccess('');
        setLoading(false);
      }
    });

    // Função de limpeza do useEffect
    return () => {
      mounted = false; // Define a flag como false ao desmontar o componente
      subscription.unsubscribe(); // Desinscreve-se do listener de autenticação
    };
  }, []);

  // Lida com o login do usuário, carregando o perfil e as viagens
  const handleUserLogin = async (authUser: User) => {
    try {
      console.log('🔄 Lidando com o login para:', authUser.email);
      setLoading(true);
      setError('');

      // Define o usuário imediatamente
      setUser(authUser);

      // Cria um perfil básico imediatamente para evitar bloqueios na UI
      const basicProfile: UserProfile = {
        id: authUser.id,
        name: authUser.email?.split('@')[0] || 'Usuário',
        email: authUser.email,
        // Usa o array ADMIN_EMAILS para verificar se o e-mail está incluído
        role: ADMIN_EMAILS.includes(authUser.email || '') ? 'admin' : 'regular',
      };

      console.log('✅ Perfil básico criado:', basicProfile);
      // Define o perfil básico primeiro e a view
      setUserProfile(basicProfile);
      setCurrentView(basicProfile.role === 'admin' ? 'adminDashboard' : 'userDashboard');
      setLoading(false); // Desativa o carregamento para mostrar a UI básica

      // Tenta obter ou criar o perfil completo em segundo plano
      try {
        console.log('🔄 Carregando perfil completo...');
        const profilePromise = DatabaseService.getOrCreateUserProfile(authUser.id, authUser.email || '');
        const timeoutProfilePromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Profile loading timeout')), 5000)
        );

        const profile = await Promise.race([profilePromise, timeoutProfilePromise]);

        if (profile && profile.id) {
          console.log('✅ Perfil completo carregado:', profile);
          setUserProfile(profile); // Atualiza com o perfil completo
          setCurrentView(profile.role === 'admin' ? 'adminDashboard' : 'userDashboard'); // Atualiza a view, caso o role tenha mudado
        }
      } catch (profileError: unknown) {
        const pErrorMsg = profileError instanceof Error ? profileError.message : 'Erro desconhecido.';
        console.warn('⚠️ Falha ao criar/carregar perfil, usando perfil básico:', pErrorMsg);
        // Continua usando o perfil básico se houver um erro no carregamento do perfil completo
      }

      // Carrega as viagens em segundo plano
      fetchTrips(basicProfile.role === 'admin', authUser.id).catch(error => {
        console.warn('⚠️ Erro ao carregar viagens:', error);
        // Não define o estado de erro na UI para falhas no carregamento de viagens
      });
      
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido.';
      console.error('❌ Erro ao lidar com o login do usuário:', errorMessage);
      
      // Permite que o usuário continue com um perfil básico em caso de erro crítico
      const fallbackProfile: UserProfile = {
        id: authUser.id,
        name: authUser.email?.split('@')[0] || 'Usuário',
        email: authUser.email,
        // Usa o array ADMIN_EMAILS para verificar se o e-mail está incluído
        role: ADMIN_EMAILS.includes(authUser.email || '') ? 'admin' : 'regular',
      };
      
      console.log('🔄 Usando perfil de fallback:', fallbackProfile);
      setUserProfile(fallbackProfile);
      setCurrentView(fallbackProfile.role === 'admin' ? 'adminDashboard' : 'userDashboard');
      setError(`Sistema carregado com dados básicos. Algumas funcionalidades podem estar limitadas. Erro: ${errorMessage}`);
      setLoading(false);
    }
  };

  // Busca as viagens do banco de dados
  const fetchTrips = async (isAdmin = false, userId?: string) => {
    try {
      console.log('🔄 Buscando viagens...', { isAdmin, userId });
      const tripsData = await DatabaseService.fetchTrips(userId, isAdmin);
      
      if (isAdmin) {
        setAllTrips(tripsData);
        console.log('✅ Viagens do admin carregadas:', tripsData.length);
      } else {
        setTrips(tripsData);
        console.log('✅ Viagens do usuário carregadas:', tripsData.length);
      }
    } catch (error) {
      console.warn('⚠️ Erro ao buscar viagens:', error);
      // Não define o estado de erro na UI para falhas no carregamento de viagens
    }
  };

  // Lida com o logout do usuário
  const handleLogout = async () => {
    try {
      console.log('🔄 Fazendo logout...');
      setLoading(true); // Ativa o spinner enquanto o logout é processado
      await supabase.auth.signOut();
      console.log('✅ Logout realizado com sucesso');
      // O estado será limpo pelo listener de mudança de estado de autenticação
      setSuccess('Logout realizado com sucesso!');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido.';
      console.error('❌ Erro ao fazer logout:', errorMessage);
      setError(`Erro ao fazer logout: ${errorMessage}`);
    } finally {
      setLoading(false); // Desativa o spinner, independentemente do resultado
    }
  };

  // Callback para quando uma viagem é salva (no ChatInterface)
  const handleTripSaved = () => {
    setSuccess('Viagem registrada com sucesso!');
    // Recarrega as viagens após uma nova ser salva
    if (userProfile && user) {
      fetchTrips(userProfile.role === 'admin', user.id);
    }
  };

  // Renderização condicional para a tela de carregamento inicial
  if (loading && !user && !userProfile) {
    return (
      <div className="app">
        <div className="container loading-container">
          <LoadingSpinner text="Verificando autenticação..." />
        </div>
      </div>
    );
  }

  // Renderização condicional para a tela de autenticação se não houver usuário logado
  if (!user) {
    return (
      <div className="app">
        <AuthView 
          error={error}
          success={success}
          setError={setError}
          setSuccess={setSuccess}
        />
      </div>
    );
  }

  // Renderização da interface principal do aplicativo
  return (
    <div className="app">
      <Navbar 
        user={user}
        userProfile={userProfile}
        currentView={currentView}
        setCurrentView={setCurrentView}
        onLogout={handleLogout}
      />

      <div className="container">
        {/* Exibe mensagens de erro ou sucesso */}
        {error && <ErrorMessage message={error} onClose={() => setError('')} />}
        {success && <SuccessMessage message={success} onClose={() => setSuccess('')} />}

        {/* Renderiza dashboards ou interface de chat com base na view atual */}
        {currentView === 'userDashboard' && (
          <UserDashboard 
            trips={trips}
            setCurrentView={setCurrentView}
          />
        )}

        {currentView === 'adminDashboard' && userProfile?.role === 'admin' && (
          <AdminDashboard allTrips={allTrips} />
        )}

        {currentView === 'chat' && user && (
          <ChatInterface 
            user={user}
            onTripSaved={handleTripSaved}
            onError={setError}
          />
        )}
      </div>
    </div>
  );
}

export default App;