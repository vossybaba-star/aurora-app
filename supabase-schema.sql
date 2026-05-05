-- Aurora App - Supabase Schema
-- Run this in the Supabase SQL editor to create all required tables.

-- Enable UUID extension (usually already enabled)
create extension if not exists "uuid-ossp";

-- ---- email_connections ----
create table if not exists email_connections (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  grant_id text not null,
  email text not null,
  provider text not null default 'other',
  access_token text,
  connected_at timestamptz not null default now(),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, email)
);

alter table email_connections enable row level security;

create policy "Users can manage their own email connections"
  on email_connections for all
  using (auth.uid() = user_id);

-- ---- sent_emails ----
create table if not exists sent_emails (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_id uuid references opportunities(id) on delete set null,
  email_connection_id uuid references email_connections(id) on delete set null,
  nylas_message_id text,
  nylas_thread_id text,
  to_email text not null,
  to_name text,
  subject text not null,
  body text not null,
  status text not null default 'sent', -- sent, opened, replied, failed
  opened_at timestamptz,
  open_count integer not null default 0,
  replied_at timestamptz,
  reply_message_id text,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table sent_emails enable row level security;

create policy "Users can manage their own sent emails"
  on sent_emails for all
  using (auth.uid() = user_id);

-- Service role can update sent_emails (for webhooks)
create policy "Service role can update sent_emails"
  on sent_emails for update
  using (true);
