-- prisma/migrations/20241218_initial_schema/migration.sql

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TEAM MEMBER TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS "team_member" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "name" TEXT NOT NULL,
    "phone_number" TEXT,
    "empid" TEXT,
    "department" TEXT,
    "manager_name" TEXT,
    "birthday" DATE,
    "us_id" TEXT UNIQUE NOT NULL,
    "email" TEXT,
    "first_name" TEXT,
    "last_name" TEXT,
    "role" TEXT DEFAULT 'member',
    "password" TEXT,
    "owner_id" TEXT,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "team_member_email_idx" ON "team_member"("email");
CREATE INDEX IF NOT EXISTS "team_member_phone_number_idx" ON "team_member"("phone_number");
CREATE INDEX IF NOT EXISTS "team_member_role_idx" ON "team_member"("role");

-- ============================================
-- VENDOR TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS "vendor" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "us_id" TEXT UNIQUE NOT NULL,
    "name" TEXT NOT NULL,
    "process_name" TEXT,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "vendor_process_name_idx" ON "vendor"("process_name");

-- ============================================
-- CONTACT TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS "contact" (
    "id" SERIAL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "source" TEXT,
    "details" TEXT,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "contact_email_idx" ON "contact"("email");
CREATE INDEX IF NOT EXISTS "contact_phone_idx" ON "contact"("phone");
CREATE INDEX IF NOT EXISTS "contact_source_idx" ON "contact"("source");

-- ============================================
-- REMINDERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS "reminders" (
    "reminder_id" SERIAL PRIMARY KEY,
    "sender_name" TEXT,
    "sender_phone" TEXT UNIQUE,
    "us_id" TEXT UNIQUE,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- UPDATE TRIGGER FUNCTION (idempotent)
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================
-- DROP EXISTING TRIGGERS (idempotent)
-- ============================================
DROP TRIGGER IF EXISTS update_team_member_updated_at ON "team_member";
DROP TRIGGER IF EXISTS update_vendor_updated_at ON "vendor";
DROP TRIGGER IF EXISTS update_contact_updated_at ON "contact";

-- ============================================
-- CREATE TRIGGERS
-- ============================================
CREATE TRIGGER update_team_member_updated_at 
    BEFORE UPDATE ON "team_member" 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vendor_updated_at 
    BEFORE UPDATE ON "vendor" 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contact_updated_at 
    BEFORE UPDATE ON "contact" 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();