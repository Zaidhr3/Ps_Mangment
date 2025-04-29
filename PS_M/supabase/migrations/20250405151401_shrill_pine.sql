/*
  # Add Daily Summaries Table and Functions

  1. New Tables
    - `daily_summaries`
      - `id` (uuid, primary key)
      - `date` (date, unique)
      - `sessions_revenue` (numeric)
      - `sales_revenue` (numeric)
      - `expenses_total` (numeric)
      - `discounts_total` (numeric)
      - `net_income` (numeric)
      - `created_at` (timestamp)

  2. Functions
    - `calculate_daily_summary` - Calculates summary for a specific date
    - `update_daily_summary` - Trigger function to update summaries

  3. Security
    - Enable RLS
    - Add policies for authenticated users
*/

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

-- Create index
CREATE INDEX IF NOT EXISTS idx_daily_summaries_date ON daily_summaries(date);

-- Enable Row Level Security
ALTER TABLE daily_summaries ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Enable all access for authenticated users on daily_summaries"
  ON daily_summaries
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

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

-- Trigger function to update daily summary
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
DROP TRIGGER IF EXISTS update_summary_after_sale ON sales;
CREATE TRIGGER update_summary_after_sale
  AFTER INSERT OR UPDATE OR DELETE ON sales
  FOR EACH ROW EXECUTE FUNCTION update_daily_summary();

DROP TRIGGER IF EXISTS update_summary_after_session ON sessions;
CREATE TRIGGER update_summary_after_session
  AFTER INSERT OR UPDATE OR DELETE ON sessions
  FOR EACH ROW EXECUTE FUNCTION update_daily_summary();

DROP TRIGGER IF EXISTS update_summary_after_expense ON expenses;
CREATE TRIGGER update_summary_after_expense
  AFTER INSERT OR UPDATE OR DELETE ON expenses
  FOR EACH ROW EXECUTE FUNCTION update_daily_summary();