/*
  # Adicionar coluna trip_reason à tabela trips

  1. Alterações
    - Adiciona coluna `trip_reason` à tabela `trips`
    - Define valores permitidos através de constraint CHECK
    - Adiciona índice para melhor performance nas consultas

  2. Valores permitidos para trip_reason
    - JOBI-M
    - LVM
    - SERVIÇOS
    - INDIRETO
    - CHILE
    - COLOMBIA
    - SALES
    - OUTROS
*/

-- Adicionar coluna trip_reason à tabela trips
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trips' AND column_name = 'trip_reason'
  ) THEN
    ALTER TABLE trips ADD COLUMN trip_reason TEXT;
  END IF;
END $$;

-- Adicionar constraint para valores permitidos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'trips_trip_reason_check'
  ) THEN
    ALTER TABLE trips ADD CONSTRAINT trips_trip_reason_check 
    CHECK (trip_reason = ANY (ARRAY[
      'JOBI-M'::text, 
      'LVM'::text, 
      'SERVIÇOS'::text, 
      'INDIRETO'::text, 
      'CHILE'::text, 
      'COLOMBIA'::text, 
      'SALES'::text, 
      'OUTROS'::text
    ]));
  END IF;
END $$;

-- Adicionar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_trips_reason ON trips(trip_reason);