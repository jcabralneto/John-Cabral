/*
  # Correção Completa do Sistema de Viagens

  1. Correções de RLS
    - Simplificar e corrigir políticas de segurança
    - Garantir que usuários possam acessar seus próprios dados
    - Manter acesso administrativo funcionando

  2. Correções de Schema
    - Garantir que todas as colunas necessárias existam
    - Corrigir constraints e índices

  3. Função de Trigger
    - Corrigir função de criação automática de perfil
*/

-- 1. LIMPAR POLÍTICAS EXISTENTES
DROP POLICY IF EXISTS "Allow admin to manage all users" ON users;
DROP POLICY IF EXISTS "Allow authenticated users to read all profiles" ON users;
DROP POLICY IF EXISTS "Allow profile creation during signup" ON users;
DROP POLICY IF EXISTS "Users can manage own profile" ON users;
DROP POLICY IF EXISTS "Admin can manage all trips" ON trips;
DROP POLICY IF EXISTS "Allow anonymous trip insertion" ON trips;
DROP POLICY IF EXISTS "Allow anonymous trip selection" ON trips;
DROP POLICY IF EXISTS "Users can delete own trips" ON trips;
DROP POLICY IF EXISTS "Users can insert own trips" ON trips;
DROP POLICY IF EXISTS "Users can read own trips" ON trips;
DROP POLICY IF EXISTS "Users can update own trips" ON trips;

-- 2. CORRIGIR FUNÇÃO DE TRIGGER
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO users (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    CASE 
      WHEN NEW.email = 'admin@gridspertise.com' THEN 'admin' 
      ELSE 'regular' 
    END
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = EXCLUDED.role;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recriar trigger se não existir
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 3. POLÍTICAS SIMPLIFICADAS PARA USERS
CREATE POLICY "Enable read access for authenticated users" 
  ON users FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Enable insert for authenticated users" 
  ON users FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Enable update for users based on user_id" 
  ON users FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = id) 
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Enable admin full access" 
  ON users FOR ALL 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND email = 'admin@gridspertise.com'
    )
  );

-- 4. POLÍTICAS SIMPLIFICADAS PARA TRIPS
CREATE POLICY "Enable read for users on own trips" 
  ON trips FOR SELECT 
  TO authenticated 
  USING (auth.uid() = user_id);

CREATE POLICY "Enable insert for authenticated users" 
  ON trips FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable update for users on own trips" 
  ON trips FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable delete for users on own trips" 
  ON trips FOR DELETE 
  TO authenticated 
  USING (auth.uid() = user_id);

CREATE POLICY "Enable admin full access on trips" 
  ON trips FOR ALL 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND email = 'admin@gridspertise.com'
    )
  );

-- 5. GARANTIR QUE TODAS AS COLUNAS EXISTAM
DO $$
BEGIN
  -- Verificar e adicionar trip_reason se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trips' AND column_name = 'trip_reason'
  ) THEN
    ALTER TABLE trips ADD COLUMN trip_reason TEXT;
  END IF;
END $$;

-- 6. ATUALIZAR CONSTRAINTS
DO $$
BEGIN
  -- Remover constraint antiga se existir
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'trips_trip_reason_check'
  ) THEN
    ALTER TABLE trips DROP CONSTRAINT trips_trip_reason_check;
  END IF;
  
  -- Adicionar nova constraint
  ALTER TABLE trips ADD CONSTRAINT trips_trip_reason_check 
  CHECK (trip_reason IS NULL OR trip_reason = ANY (ARRAY[
    'JOBI-M'::text, 
    'LVM'::text, 
    'SERVIÇOS'::text, 
    'INDIRETO'::text, 
    'CHILE'::text, 
    'COLOMBIA'::text, 
    'SALES'::text, 
    'OUTROS'::text
  ]));
END $$;

-- 7. CRIAR ÍNDICES NECESSÁRIOS
CREATE INDEX IF NOT EXISTS idx_trips_reason ON trips(trip_reason);
CREATE INDEX IF NOT EXISTS idx_users_email_auth ON users(email);

-- 8. INSERIR USUÁRIO ADMIN SE NÃO EXISTIR
DO $$
BEGIN
  -- Verificar se existe usuário admin na tabela auth.users
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@gridspertise.com') THEN
    -- Garantir que o perfil admin existe na tabela users
    INSERT INTO users (id, name, email, role)
    SELECT id, 'Admin', email, 'admin'
    FROM auth.users 
    WHERE email = 'admin@gridspertise.com'
    ON CONFLICT (id) DO UPDATE SET
      role = 'admin',
      email = EXCLUDED.email;
  END IF;
END $$;