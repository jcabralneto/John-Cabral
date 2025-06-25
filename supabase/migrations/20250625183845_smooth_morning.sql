/*
# Configuração Completa do Banco de Dados Supabase

Execute este SQL no SQL Editor do Supabase:
https://supabase.com/dashboard/project/jfheipwozfewogwxuxqt/sql

## 1. Criação das Tabelas
*/

-- Habilitar extensão UUID se não estiver habilitada
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Criar tabela users (principal)
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    role TEXT DEFAULT 'regular' CHECK (role IN ('admin', 'regular')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criar tabela trips (principal)
CREATE TABLE IF NOT EXISTS trips (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    travel_date DATE,
    destination_country TEXT NOT NULL,
    destination_city TEXT NOT NULL,
    cost_tickets NUMERIC(10,2) NOT NULL DEFAULT 0,
    cost_lodging NUMERIC(10,2) NOT NULL DEFAULT 0,
    cost_daily_allowances NUMERIC(10,2) NOT NULL DEFAULT 0,
    cost_center TEXT NOT NULL DEFAULT 'Não informado',
    trip_type TEXT CHECK (trip_type IN ('Nacional', 'Continental', 'Intercontinental')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir usuário admin padrão
INSERT INTO users (name, email, role) VALUES 
    ('Administrador', 'admin@gridspertise.com', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Inserir alguns usuários de exemplo
INSERT INTO users (name, email, role) VALUES 
    ('João Silva', 'joao@gridspertise.com', 'regular'),
    ('Maria Santos', 'maria@gridspertise.com', 'regular')
ON CONFLICT (email) DO NOTHING;

/*
## 2. Configuração de Segurança (RLS)
*/

-- Habilitar RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes se houver
DROP POLICY IF EXISTS "Allow public read access to users" ON users;
DROP POLICY IF EXISTS "Allow authenticated users to view their own trips" ON trips;
DROP POLICY IF EXISTS "Allow anonymous users to insert trips" ON trips;
DROP POLICY IF EXISTS "Allow authenticated users to insert their own trips" ON trips;
DROP POLICY IF EXISTS "Allow authenticated users to update their own trips" ON trips;
DROP POLICY IF EXISTS "Allow authenticated users to delete their own trips" ON trips;
DROP POLICY IF EXISTS "Allow admin user management" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;

-- Políticas para tabela users
CREATE POLICY "Allow public read access to users" ON users
    FOR SELECT TO public USING (true);

CREATE POLICY "Allow admin user management" ON users
    FOR ALL TO authenticated
    USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Users can update own data" ON users
    FOR UPDATE TO authenticated
    USING (auth.uid() = id);

-- Políticas para tabela trips
CREATE POLICY "Allow authenticated users to view their own trips" ON trips
    FOR SELECT TO authenticated
    USING (
        auth.uid() = user_id OR 
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Allow anonymous users to insert trips" ON trips
    FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow authenticated users to insert their own trips" ON trips
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow authenticated users to update their own trips" ON trips
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Allow authenticated users to delete their own trips" ON trips
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

/*
## 3. Inserir Dados de Exemplo
*/

-- Inserir algumas viagens de exemplo
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
    
    -- Inserir viagens de exemplo
    INSERT INTO trips (user_id, travel_date, destination_country, destination_city, cost_tickets, cost_lodging, cost_daily_allowances, cost_center, trip_type) VALUES
        (admin_id, '2024-01-15', 'Brasil', 'São Paulo', 800.00, 300.00, 200.00, 'Administração', 'Nacional'),
        (user1_id, '2024-02-20', 'Argentina', 'Buenos Aires', 1200.00, 800.00, 400.00, 'Vendas', 'Continental'),
        (user2_id, '2024-03-10', 'França', 'Paris', 3500.00, 2000.00, 1000.00, 'Marketing', 'Intercontinental');
END $$;

/*
## 4. Verificação Final
*/

-- Verificar se tudo foi criado corretamente
SELECT 
    'users' as tabela, 
    COUNT(*) as registros 
FROM users
UNION ALL
SELECT 
    'trips' as tabela, 
    COUNT(*) as registros 
FROM trips;

-- Verificar estrutura das tabelas
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name IN ('users', 'trips')
ORDER BY table_name, ordinal_position;

-- Verificar políticas RLS
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename IN ('users', 'trips')
ORDER BY tablename, policyname;