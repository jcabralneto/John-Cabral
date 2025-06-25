/*
# Configuração Completa do Sistema de Viagens

1. Tabelas Principais
   - `users` (usuários do sistema)
   - `trips` (viagens registradas)

2. Segurança
   - RLS habilitado em todas as tabelas
   - Políticas para usuários regulares e administradores
   - Suporte para usuários anônimos (necessário para chat)

3. Dados de Exemplo
   - Usuário administrador padrão
   - Usuários regulares de exemplo
   - Viagens de exemplo para demonstração
*/

-- Habilitar extensão UUID se não estiver habilitada
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Criar tabela users apenas se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users') THEN
        CREATE TABLE users (
            id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT,
            role TEXT DEFAULT 'regular' CHECK (role IN ('admin', 'regular')),
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    END IF;
END $$;

-- Adicionar constraint UNIQUE para email apenas se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'users_email_unique_not_null'
    ) THEN
        CREATE UNIQUE INDEX users_email_unique_not_null ON users (email) WHERE email IS NOT NULL;
    END IF;
END $$;

-- Adicionar índices para performance apenas se não existirem
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_email') THEN
        CREATE INDEX idx_users_email ON users (email);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_name') THEN
        CREATE INDEX idx_users_name ON users (name);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_name_lower') THEN
        CREATE INDEX idx_users_name_lower ON users (lower(name));
    END IF;
END $$;

-- Criar tabela trips apenas se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'trips') THEN
        CREATE TABLE trips (
            id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            travel_date DATE NOT NULL,
            destination_country TEXT NOT NULL,
            destination_city TEXT NOT NULL,
            cost_tickets NUMERIC(10,2) NOT NULL DEFAULT 0,
            cost_lodging NUMERIC(10,2) NOT NULL DEFAULT 0,
            cost_daily_allowances NUMERIC(10,2) NOT NULL DEFAULT 0,
            cost_center TEXT NOT NULL DEFAULT 'Não informado',
            trip_type TEXT CHECK (trip_type IN ('Nacional', 'Continental', 'Intercontinental')),
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    END IF;
END $$;

-- Inserir usuário admin padrão apenas se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@gridspertise.com') THEN
        INSERT INTO users (name, email, role) VALUES 
            ('Administrador', 'admin@gridspertise.com', 'admin');
    END IF;
END $$;

-- Inserir usuários de exemplo apenas se não existirem
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'joao@gridspertise.com') THEN
        INSERT INTO users (name, email, role) VALUES 
            ('João Silva', 'joao@gridspertise.com', 'regular');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'maria@gridspertise.com') THEN
        INSERT INTO users (name, email, role) VALUES 
            ('Maria Santos', 'maria@gridspertise.com', 'regular');
    END IF;
END $$;

-- Habilitar RLS nas tabelas (apenas se ainda não estiver habilitado)
DO $$
BEGIN
    -- Verificar e habilitar RLS para users
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c 
        JOIN pg_namespace n ON n.oid = c.relnamespace 
        WHERE c.relname = 'users' AND c.relrowsecurity = true
    ) THEN
        ALTER TABLE users ENABLE ROW LEVEL SECURITY;
    END IF;
    
    -- Verificar e habilitar RLS para trips
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c 
        JOIN pg_namespace n ON n.oid = c.relnamespace 
        WHERE c.relname = 'trips' AND c.relrowsecurity = true
    ) THEN
        ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Remover políticas existentes se houver (para evitar conflitos)
DROP POLICY IF EXISTS "Allow public read access" ON users;
DROP POLICY IF EXISTS "Allow admin user management" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Allow authenticated users to view their own trips" ON trips;
DROP POLICY IF EXISTS "Allow anonymous users to insert trips" ON trips;
DROP POLICY IF EXISTS "Allow authenticated users to insert their own trips" ON trips;
DROP POLICY IF EXISTS "Allow authenticated users to update their own trips" ON trips;
DROP POLICY IF EXISTS "Allow authenticated users to delete their own trips" ON trips;
DROP POLICY IF EXISTS "Allow anonymous users to select trips" ON trips;

-- Políticas para tabela users
CREATE POLICY "Allow public read access" ON users
    FOR SELECT TO public USING (true);

CREATE POLICY "Allow admin user management" ON users
    FOR ALL TO authenticated
    USING (
        (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
    )
    WITH CHECK (
        (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
    );

CREATE POLICY "Users can update own data" ON users
    FOR UPDATE TO authenticated
    USING (auth.uid() = id);

-- Políticas para tabela trips
CREATE POLICY "Allow authenticated users to view their own trips" ON trips
    FOR SELECT TO public
    USING (
        auth.uid() = user_id OR 
        (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
    );

CREATE POLICY "Allow anonymous users to select trips" ON trips
    FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anonymous users to insert trips" ON trips
    FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow authenticated users to insert their own trips" ON trips
    FOR INSERT TO public
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow authenticated users to update their own trips" ON trips
    FOR UPDATE TO public
    USING (auth.uid() = user_id);

CREATE POLICY "Allow authenticated users to delete their own trips" ON trips
    FOR DELETE TO public
    USING (auth.uid() = user_id);

-- Inserir viagens de exemplo apenas se não existirem
DO $$
DECLARE
    admin_id UUID;
    user1_id UUID;
    user2_id UUID;
BEGIN
    -- Buscar IDs dos usuários
    SELECT id INTO admin_id FROM users WHERE email = 'admin@gridspertise.com';
    SELECT id INTO user1_id FROM users WHERE email = 'joao@gridspertise.com';
    SELECT id INTO user2_id FROM users WHERE email = 'maria@gridspertise.com';
    
    -- Inserir viagens apenas se os usuários existirem e as viagens não existirem
    IF admin_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM trips WHERE user_id = admin_id AND destination_city = 'São Paulo' AND travel_date = '2024-01-15'
    ) THEN
        INSERT INTO trips (user_id, travel_date, destination_country, destination_city, cost_tickets, cost_lodging, cost_daily_allowances, cost_center, trip_type) 
        VALUES (admin_id, '2024-01-15', 'Brasil', 'São Paulo', 800.00, 300.00, 200.00, 'Administração', 'Nacional');
    END IF;
    
    IF user1_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM trips WHERE user_id = user1_id AND destination_city = 'Buenos Aires' AND travel_date = '2024-02-20'
    ) THEN
        INSERT INTO trips (user_id, travel_date, destination_country, destination_city, cost_tickets, cost_lodging, cost_daily_allowances, cost_center, trip_type) 
        VALUES (user1_id, '2024-02-20', 'Argentina', 'Buenos Aires', 1200.00, 800.00, 400.00, 'Vendas', 'Continental');
    END IF;
    
    IF user2_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM trips WHERE user_id = user2_id AND destination_city = 'Paris' AND travel_date = '2024-03-10'
    ) THEN
        INSERT INTO trips (user_id, travel_date, destination_country, destination_city, cost_tickets, cost_lodging, cost_daily_allowances, cost_center, trip_type) 
        VALUES (user2_id, '2024-03-10', 'França', 'Paris', 3500.00, 2000.00, 1000.00, 'Marketing', 'Intercontinental');
    END IF;
END $$;