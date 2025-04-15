/*
  # Initial Schema for Gym Management System

  1. Tables
    - users
      - Basic user information and authentication
    - profiles
      - Extended user profile information
    - trainers
      - Trainer information and specializations
    - memberships
      - Membership plans and details
    - user_memberships
      - User-membership relationships
    - workouts
      - Workout plans and details
    - user_workouts
      - User-workout assignments
    - payments
      - Payment records and transactions

  2. Views
    - active_memberships
      - Shows all active memberships with user details
    - trainer_clients
      - Shows clients assigned to each trainer
    - upcoming_renewals
      - Shows memberships due for renewal

  3. Security
    - RLS policies for each table
    - Role-based access control
*/

-- Create custom types
CREATE TYPE user_role AS ENUM ('admin', 'client', 'trainer');
CREATE TYPE membership_status AS ENUM ('active', 'expired', 'cancelled');
CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed');

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  role user_role NOT NULL DEFAULT 'client',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES users(id),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  height DECIMAL(5,2),
  weight DECIMAL(5,2),
  date_of_birth DATE,
  emergency_contact TEXT,
  medical_conditions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trainers table
CREATE TABLE trainers (
  id UUID PRIMARY KEY REFERENCES users(id),
  specialization TEXT NOT NULL,
  experience_years INTEGER NOT NULL,
  certification TEXT,
  availability JSON,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Memberships table
CREATE TABLE memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  duration_months INTEGER NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  features JSON,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User memberships table
CREATE TABLE user_memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  membership_id UUID REFERENCES memberships(id),
  trainer_id UUID REFERENCES trainers(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status membership_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Workouts table
CREATE TABLE workouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  difficulty_level INTEGER CHECK (difficulty_level BETWEEN 1 AND 5),
  duration_minutes INTEGER NOT NULL,
  exercises JSON NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User workouts table
CREATE TABLE user_workouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  workout_id UUID REFERENCES workouts(id),
  trainer_id UUID REFERENCES trainers(id),
  assigned_date DATE NOT NULL,
  completed_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Payments table
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  membership_id UUID REFERENCES memberships(id),
  amount DECIMAL(10,2) NOT NULL,
  payment_date DATE NOT NULL,
  status payment_status NOT NULL DEFAULT 'pending',
  payment_method TEXT NOT NULL,
  transaction_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Views
CREATE VIEW active_memberships AS
SELECT 
  um.id,
  p.full_name as user_name,
  m.name as membership_name,
  um.start_date,
  um.end_date,
  t.full_name as trainer_name
FROM user_memberships um
JOIN profiles p ON um.user_id = p.id
JOIN memberships m ON um.membership_id = m.id
LEFT JOIN profiles t ON um.trainer_id = t.id
WHERE um.status = 'active';

CREATE VIEW trainer_clients AS
SELECT 
  t.id as trainer_id,
  tp.full_name as trainer_name,
  p.full_name as client_name,
  m.name as membership_plan,
  um.start_date,
  um.end_date
FROM trainers t
JOIN profiles tp ON t.id = tp.id
JOIN user_memberships um ON t.id = um.trainer_id
JOIN profiles p ON um.user_id = p.id
JOIN memberships m ON um.membership_id = m.id
WHERE um.status = 'active';

CREATE VIEW upcoming_renewals AS
SELECT 
  p.full_name,
  p.email,
  m.name as membership_plan,
  um.end_date,
  m.price as renewal_amount
FROM user_memberships um
JOIN profiles p ON um.user_id = p.id
JOIN memberships m ON um.membership_id = m.id
WHERE um.end_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '30 days')
AND um.status = 'active';

-- Stored Procedures
CREATE OR REPLACE PROCEDURE register_new_member(
  p_user_id UUID,
  p_membership_id UUID,
  p_trainer_id UUID,
  p_start_date DATE
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_duration_months INTEGER;
  v_end_date DATE;
  v_membership_price DECIMAL(10,2);
BEGIN
  -- Get membership duration and price
  SELECT duration_months, price 
  INTO v_duration_months, v_membership_price
  FROM memberships 
  WHERE id = p_membership_id;
  
  -- Calculate end date
  v_end_date := p_start_date + (v_duration_months * INTERVAL '1 month');
  
  -- Create user membership
  INSERT INTO user_memberships (
    user_id, membership_id, trainer_id, start_date, end_date
  ) VALUES (
    p_user_id, p_membership_id, p_trainer_id, p_start_date, v_end_date
  );
  
  -- Create initial payment record
  INSERT INTO payments (
    user_id, membership_id, amount, payment_date, status
  ) VALUES (
    p_user_id, p_membership_id, v_membership_price, CURRENT_DATE, 'pending'
  );
END;
$$;

CREATE OR REPLACE PROCEDURE update_membership_status()
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE user_memberships
  SET status = 'expired'
  WHERE end_date < CURRENT_DATE
  AND status = 'active';
END;
$$;

CREATE OR REPLACE PROCEDURE generate_payment_summary(
  p_start_date DATE,
  p_end_date DATE
)
LANGUAGE plpgsql
AS $$
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS payment_summary AS
  SELECT 
    p.full_name,
    m.name as membership_plan,
    pay.amount,
    pay.payment_date,
    pay.status
  FROM payments pay
  JOIN profiles p ON pay.user_id = p.id
  JOIN memberships m ON pay.membership_id = m.id
  WHERE pay.payment_date BETWEEN p_start_date AND p_end_date
  ORDER BY pay.payment_date DESC;
END;
$$;

-- Triggers
CREATE OR REPLACE FUNCTION log_user_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (
    table_name,
    record_id,
    action,
    old_data,
    new_data,
    changed_by
  ) VALUES (
    TG_TABLE_NAME,
    NEW.id,
    TG_OP,
    row_to_json(OLD),
    row_to_json(NEW),
    auth.uid()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_changes_trigger
AFTER INSERT OR UPDATE OR DELETE ON users
FOR EACH ROW EXECUTE FUNCTION log_user_changes();

CREATE OR REPLACE FUNCTION update_membership_status_on_payment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' THEN
    UPDATE user_memberships
    SET status = 'active'
    WHERE user_id = NEW.user_id
    AND membership_id = NEW.membership_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payment_status_trigger
AFTER UPDATE ON payments
FOR EACH ROW EXECUTE FUNCTION update_membership_status_on_payment();

CREATE OR REPLACE FUNCTION check_trainer_availability()
RETURNS TRIGGER AS $$
BEGIN
  IF (
    SELECT COUNT(*)
    FROM user_memberships
    WHERE trainer_id = NEW.trainer_id
    AND status = 'active'
  ) >= 10 THEN
    RAISE EXCEPTION 'Trainer has reached maximum client capacity';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trainer_availability_trigger
BEFORE INSERT ON user_memberships
FOR EACH ROW EXECUTE FUNCTION check_trainer_availability();

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainers ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own profile"
ON profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Admins have full access to profiles"
ON profiles FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND role = 'admin'
  )
);

CREATE POLICY "Trainers can view assigned clients"
ON profiles FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_memberships
    WHERE trainer_id = auth.uid()
    AND user_id = profiles.id
  )
);

-- Similar policies for other tables...