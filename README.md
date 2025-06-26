# Gridspertise Travel Management System

A comprehensive travel management application built with React, TypeScript, and Supabase, featuring AI-powered trip data extraction.

## Features

- **User Authentication**: Secure login/signup with Supabase Auth
- **Role-based Access**: Admin and regular user roles
- **AI-Powered Trip Registration**: Natural language processing for trip data extraction
- **Dashboard Views**: Separate dashboards for users and administrators
- **Trip Management**: Complete CRUD operations for travel records
- **Real-time Data**: Live updates with Supabase real-time subscriptions

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Backend**: Supabase (PostgreSQL, Auth, Real-time)
- **AI Integration**: Google Gemini API
- **Testing**: Vitest, React Testing Library
- **Styling**: Custom CSS with modern design principles

## Setup Instructions

### 1. Environment Configuration

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Fill in your credentials:
- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `VITE_GEMINI_API_KEY`: Your Google Gemini API key (optional)

### 2. Supabase Database Setup

Run the following SQL in your Supabase SQL editor:

```sql
-- Profiles table
CREATE TABLE profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE,
    email TEXT,
    role TEXT DEFAULT 'regular',
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (id)
);

-- Trips table
CREATE TABLE trips (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE,
    trip_date DATE,
    destination_country TEXT,
    destination_city TEXT,
    ticket_cost DECIMAL(10,2),
    accommodation_cost DECIMAL(10,2),
    daily_allowances DECIMAL(10,2),
    trip_type TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Auto-create profile trigger
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, email, role)
    VALUES (
        NEW.id,
        NEW.email,
        CASE WHEN NEW.email = 'admin@gridspertise.com' THEN 'admin' ELSE 'regular' END
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Users can view own trips" ON trips
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all trips" ON trips
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Run Development Server

```bash
npm run dev
```

### 5. Run Tests

```bash
npm test
```

### 6. TypeScript Build

The source code in `src/` is written entirely in TypeScript. A `tsconfig.json`
and `vite-env.d.ts` are provided so the project can be compiled with `tsc`
before the Vite build process. To compile the TypeScript sources run:

```bash
npm run build
```

When migrating new JavaScript files, tools such as **ts-morph** or
**ts-migrate** can help automate the conversion.

## Usage

### Admin Access
- Create an account with email: `admin@gridspertise.com`
- Admin users can view all trips and access administrative dashboard

### Regular Users
- Create account with any other email
- Can register and view their own trips
- Use AI chat interface for natural language trip registration

### AI Trip Registration
The system supports natural language input for trip registration:

**Example inputs:**
- "Viagem para Buenos Aires dia 20/08, gastei R$ 1.200 na passagem, R$ 800 no hotel e R$ 400 em diárias"
- "Preciso registrar uma viagem para São Paulo, passagem custou R$ 600, hotel R$ 300"
- "Trip to Paris next month, flight was $2000, hotel $1500, meals $800"

## Project Structure

```
src/
├── components/          # React components
├── lib/                # Library configurations
├── services/           # Business logic and API services
├── types/              # TypeScript type definitions
├── utils/              # Utility functions (from previous setup)
└── test/               # Test utilities and setup
```

## Testing

The project includes comprehensive testing setup:
- Unit tests for utility functions
- Component tests with React Testing Library
- Integration tests for user workflows
- Coverage reporting

Run tests with:
```bash
npm test              # Watch mode
npm run test:run      # Single run
npm run test:ui       # Visual test runner
npm run test:coverage # Coverage report
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

This project is proprietary to Gridspertise.
README.md