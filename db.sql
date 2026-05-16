CREATE DATABASE upenergy_crm;

\c upenergy_crm

CREATE TABLE agents (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(50) NOT NULL,
  region VARCHAR(100),
  phone VARCHAR(30),
  channel VARCHAR(30),
  email VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tickets (
  id SERIAL PRIMARY KEY,
  ticket_ref VARCHAR(20) UNIQUE NOT NULL,
  customer_name VARCHAR(100) NOT NULL,
  customer_phone VARCHAR(30),
  customer_region VARCHAR(100),
  serial_number VARCHAR(50),
  product VARCHAR(50),
  issue_type VARCHAR(100),
  description TEXT,
  source VARCHAR(50),
  reporter_role VARCHAR(50),
  reported_by VARCHAR(100),
  assigned_agent VARCHAR(100),
  priority VARCHAR(20) DEFAULT 'Medium',
  status VARCHAR(30) DEFAULT 'Open',
  resolution TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ticket_timeline (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER REFERENCES tickets(id) ON DELETE CASCADE,
  event_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE carbon_credits (
  id SERIAL PRIMARY KEY,
  cc_ref VARCHAR(20) UNIQUE NOT NULL,
  product VARCHAR(50),
  serial_number VARCHAR(50),
  region VARCHAR(100),
  credits_issued NUMERIC(10,2),
  status VARCHAR(30) DEFAULT 'Pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tickets_updated_at
BEFORE UPDATE ON tickets
FOR EACH ROW EXECUTE FUNCTION update_updated_at();