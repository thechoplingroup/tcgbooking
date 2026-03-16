-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- User roles
create type user_role as enum ('client', 'stylist', 'admin');

-- Profiles table (extends Supabase auth.users)
create table profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  role user_role not null default 'client',
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Stylists
create table stylists (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade unique not null,
  name text not null,
  bio text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- Services
create table services (
  id uuid primary key default uuid_generate_v4(),
  stylist_id uuid references stylists(id) on delete cascade not null,
  name text not null,
  duration_minutes integer not null,
  internal_price_cents integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Operational hours
create table operational_hours (
  id uuid primary key default uuid_generate_v4(),
  stylist_id uuid references stylists(id) on delete cascade not null,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  open_time time not null,
  close_time time not null,
  unique (stylist_id, day_of_week)
);

-- Blocked times
create table blocked_times (
  id uuid primary key default uuid_generate_v4(),
  stylist_id uuid references stylists(id) on delete cascade not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  reason text
);

-- Appointments
create type appointment_status as enum ('pending', 'confirmed', 'cancelled');

create table appointments (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references profiles(id) on delete set null,
  stylist_id uuid references stylists(id) on delete cascade not null,
  service_id uuid references services(id) on delete set null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status appointment_status not null default 'pending',
  created_at timestamptz not null default now()
);

-- Indexes
create index on appointments (stylist_id, start_at);
create index on appointments (client_id);
create index on blocked_times (stylist_id, start_at, end_at);

-- Auto-update updated_at on profiles
create or replace function handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on profiles
  for each row execute procedure handle_updated_at();

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, role, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'client')::user_role,
    new.raw_user_meta_data->>'full_name'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- RLS
alter table profiles enable row level security;
alter table stylists enable row level security;
alter table services enable row level security;
alter table operational_hours enable row level security;
alter table blocked_times enable row level security;
alter table appointments enable row level security;

-- Profiles: users see own row, admins see all
create policy "Users can view own profile"
  on profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

-- Stylists: public read
create policy "Stylists are publicly readable"
  on stylists for select using (true);

create policy "Stylists can manage own record"
  on stylists for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('stylist', 'admin'))
    and user_id = auth.uid()
  );

-- Services: public read for active
create policy "Active services are publicly readable"
  on services for select using (is_active = true);

create policy "Stylists manage own services"
  on services for all using (
    exists (
      select 1 from stylists s
      join profiles p on p.id = auth.uid()
      where s.id = services.stylist_id and s.user_id = auth.uid()
      and p.role in ('stylist', 'admin')
    )
  );

-- Operational hours: public read
create policy "Operational hours are publicly readable"
  on operational_hours for select using (true);

create policy "Stylists manage own hours"
  on operational_hours for all using (
    exists (
      select 1 from stylists where id = operational_hours.stylist_id and user_id = auth.uid()
    )
  );

-- Blocked times: public read
create policy "Blocked times are publicly readable"
  on blocked_times for select using (true);

create policy "Stylists manage own blocked times"
  on blocked_times for all using (
    exists (
      select 1 from stylists where id = blocked_times.stylist_id and user_id = auth.uid()
    )
  );

-- Appointments: client sees own, stylist sees theirs
create policy "Clients view own appointments"
  on appointments for select using (client_id = auth.uid());

create policy "Stylists view their appointments"
  on appointments for select using (
    exists (select 1 from stylists where id = appointments.stylist_id and user_id = auth.uid())
  );

create policy "Clients can create appointments"
  on appointments for insert with check (client_id = auth.uid());

create policy "Clients can cancel own appointments"
  on appointments for update using (client_id = auth.uid());

create policy "Stylists can manage their appointments"
  on appointments for update using (
    exists (select 1 from stylists where id = appointments.stylist_id and user_id = auth.uid())
  );
