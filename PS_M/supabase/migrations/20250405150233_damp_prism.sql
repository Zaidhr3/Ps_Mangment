/*
  # Sales and Accounting Management Schema

  1. New Tables
    - `products`
      - `id` (uuid, primary key)
      - `name` (text)
      - `price` (numeric)
      - `stock` (integer)
      - `category` (enum: market, coffee)
      - `created_at` (timestamp)
    
    - `sales`
      - `id` (uuid, primary key)
      - `product_id` (uuid, foreign key)
      - `quantity` (integer)
      - `unit_price` (numeric)
      - `total_price` (numeric)
      - `discount_amount` (numeric)
      - `final_amount` (numeric)
      - `created_at` (timestamp)
    
    - `expenses`
      - `id` (uuid, primary key)
      - `description` (text)
      - `amount` (numeric)
      - `category` (enum: rent, electricity, water, other)
      - `date` (date)
      - `created_at` (timestamp)
    
    - `debts`
      - `id` (uuid, primary key)
      - `customer_name` (text)
      - `amount` (numeric)
      - `description` (text)
      - `status` (enum: pending, paid)
      - `paid_at` (timestamp)
      - `created_at` (timestamp)
    
    - `daily_summaries`
      - `id` (uuid, primary key)
      - `date` (date)
      - `sessions_revenue` (numeric)
      - `sales_revenue` (numeric)
      - `expenses_total` (numeric)
      - `discounts_total` (numeric)
      - `net_income` (numeric)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated access
*/

-- Create enums
CREATE TYPE product_category AS ENUM ('market', 'coffee');
CREATE TYPE expense_category AS ENUM ('rent', 'electricity', 'water', 'other');
CREATE TYPE debt_status AS ENUM ('pending', 'paid');

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price numeric NOT NULL CHECK (price >= 0),
  stock integer NOT NULL DEFAULT 0,
  category product_category NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create sales table
CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric NOT NULL CHECK (unit_price >= 0),
  total_price numeric NOT NULL CHECK (total_price >= 0),
  discount_amount numeric NOT NULL DEFAULT 0,
  final_amount numeric NOT NULL CHECK (final_amount >= 0),
  created_at timestamptz DEFAULT now()
);

-- Create expenses table
CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  category expense_category NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

-- Create debts table
CREATE TABLE IF NOT EXISTS debts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  description text,
  status debt_status NOT NULL DEFAULT 'pending',
  paid_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create daily_summaries table
CREATE TABLE IF NOT EXISTS daily_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL UNIQUE,
  sessions_revenue numeric NOT NULL DEFAULT 0,
  sales_revenue numeric NOT NULL DEFAULT 0,
  expenses_total numeric NOT NULL DEFAULT 0,
  discounts_total numeric NOT NULL DEFAULT 0,
  net_income numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_sales_created_at ON sales(created_at);
CREATE INDEX idx_expenses_date ON expenses(date);
CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_debts_status ON debts(status);
CREATE INDEX idx_daily_summaries_date ON daily_summaries(date);

-- Enable Row Level Security
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_summaries ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable all access for authenticated users on products"
  ON products FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Enable all access for authenticated users on sales"
  ON sales FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Enable all access for authenticated users on expenses"
  ON expenses FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Enable all access for authenticated users on debts"
  ON debts FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Enable all access for authenticated users on daily_summaries"
  ON daily_summaries FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Function to calculate daily summary
CREATE OR REPLACE FUNCTION calculate_daily_summary(summary_date date)
RETURNS void AS $$
DECLARE
  sessions_rev numeric;
  sales_rev numeric;
  expenses_tot numeric;
  discounts_tot numeric;
  net_inc numeric;
BEGIN
  -- Calculate sessions revenue
  SELECT COALESCE(SUM(final_amount), 0)
  INTO sessions_rev
  FROM sessions
  WHERE DATE(created_at) = summary_date
    AND status = 'completed';

  -- Calculate sales revenue
  SELECT COALESCE(SUM(final_amount), 0)
  INTO sales_rev
  FROM sales
  WHERE DATE(created_at) = summary_date;

  -- Calculate total expenses
  SELECT COALESCE(SUM(amount), 0)
  INTO expenses_tot
  FROM expenses
  WHERE date = summary_date;

  -- Calculate total discounts
  SELECT COALESCE(SUM(s.total_price - s.final_amount), 0) +
         COALESCE(SUM(sess.total_cost - sess.final_amount), 0)
  INTO discounts_tot
  FROM sales s
  FULL OUTER JOIN sessions sess ON DATE(sess.created_at) = DATE(s.created_at)
  WHERE DATE(COALESCE(s.created_at, sess.created_at)) = summary_date;

  -- Calculate net income
  net_inc := sessions_rev + sales_rev - expenses_tot;

  -- Insert or update daily summary
  INSERT INTO daily_summaries (
    date,
    sessions_revenue,
    sales_revenue,
    expenses_total,
    discounts_total,
    net_income
  )
  VALUES (
    summary_date,
    sessions_rev,
    sales_rev,
    expenses_tot,
    discounts_tot,
    net_inc
  )
  ON CONFLICT (date) DO UPDATE
  SET
    sessions_revenue = EXCLUDED.sessions_revenue,
    sales_revenue = EXCLUDED.sales_revenue,
    expenses_total = EXCLUDED.expenses_total,
    discounts_total = EXCLUDED.discounts_total,
    net_income = EXCLUDED.net_income;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to update daily summary after sales/expenses changes
CREATE OR REPLACE FUNCTION update_daily_summary()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM calculate_daily_summary(
    CASE
      WHEN TG_TABLE_NAME = 'expenses' THEN
        CASE
          WHEN TG_OP = 'DELETE' THEN OLD.date
          ELSE NEW.date
        END
      ELSE
        CASE
          WHEN TG_OP = 'DELETE' THEN DATE(OLD.created_at)
          ELSE DATE(NEW.created_at)
        END
    END
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic daily summary updates
CREATE TRIGGER update_summary_after_sale
  AFTER INSERT OR UPDATE OR DELETE ON sales
  FOR EACH ROW EXECUTE FUNCTION update_daily_summary();

CREATE TRIGGER update_summary_after_session
  AFTER INSERT OR UPDATE OR DELETE ON sessions
  FOR EACH ROW EXECUTE FUNCTION update_daily_summary();

CREATE TRIGGER update_summary_after_expense
  AFTER INSERT OR UPDATE OR DELETE ON expenses
  FOR EACH ROW EXECUTE FUNCTION update_daily_summary();

-- Insert sample products
INSERT INTO products (name, price, stock, category) VALUES
  ('كوكا كولا', 0.5, 100, 'market'),
  ('بيبسي', 0.5, 100, 'market'),
  ('شيبس', 0.25, 50, 'market'),
  ('قهوة تركية', 0.75, 100, 'coffee'),
  ('نسكافيه', 1.0, 100, 'coffee'),
  ('شاي', 0.5, 100, 'coffee');