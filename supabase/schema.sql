-- ============================================================================
-- SOULIN Herbal E-Commerce Schema, Seed Data, Grants, RLS & Realtime Setup
-- ============================================================================

-- 1. TABLES
create table if not exists public.soulin_products (
    id text primary key,
    name text not null,
    scent text not null default '',
    description text not null default '',
    type text not null check (type in ('jar', 'stick')),
    price integer not null check (price >= 1),
    stock integer not null check (stock >= 0),
    icon_class text not null default 'fa-jar',
    badge_text text not null default '',
    img text not null default '',
    sort_order integer not null default 0,
    updated_at timestamptz not null default now()
);

create table if not exists public.soulin_orders (
    order_id text primary key,
    timestamp_ms bigint not null,
    username text not null,
    customer_name text not null,
    items jsonb not null default '[]'::jsonb,
    subtotal integer not null default 0,
    shipping integer not null default 0,
    discount integer not null default 0,
    total integer not null default 0,
    address text not null,
    shipping_details jsonb,
    order_date_text text not null default '',
    status text not null,
    payment_method text not null default 'promptpay',
    payment_status text not null default 'pending',
    payment_slip_url text not null default '',
    payment_reference text not null default '',
    payment_gateway text not null default 'manual',
    paid_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.soulin_cms (
    id text primary key,
    title text not null,
    tag text not null,
    subtitle text not null,
    img text not null default '',
    gsheet_webhook text not null default '',
    payment_config jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now()
);

create table if not exists public.soulin_members (
    username text primary key,
    fullname text not null,
    email text not null default '',
    phone text not null default '',
    default_address text not null default '',
    auth_provider text not null default 'local',
    google_sub text not null default '',
    avatar_url text not null default '',
    updated_at timestamptz not null default now()
);

create table if not exists public.soulin_addresses (
    id text primary key,
    owner_key text not null,
    recipient text not null,
    phone text not null,
    province text not null,
    district text not null,
    subdistrict text not null,
    postal_code text not null,
    street text not null,
    note text not null default '',
    label text not null default 'บ้าน',
    is_default boolean not null default false,
    updated_at timestamptz not null default now()
);

-- 2. INDEXES FOR FAST SORTING & LOOKUPS
create index if not exists idx_soulin_orders_timestamp_ms
    on public.soulin_orders (timestamp_ms desc);

create index if not exists idx_soulin_orders_username
    on public.soulin_orders (username);

create index if not exists idx_soulin_addresses_owner_key
    on public.soulin_addresses (owner_key);

-- 3. INITIAL SEED DATA (8 PRODUCTS + MAIN CMS)
insert into public.soulin_products
    (id, name, scent, description, type, price, stock, icon_class, badge_text, img, sort_order)
values
    ('jar-1', 'SOULIN Original Herbal (กระปุก 20g)', 'สูตรดั้งเดิม', 'สมุนไพรหมักบ่ม 10 ชนิด กลิ่นหอมลึก เย็นสดชื่น คลายความอ่อนล้า ขนาด 20g', 'jar', 89, 50, 'fa-jar', 'กระปุกสมุนไพร 20g', 'https://cdn.imagetourls.com/uploads/tyImg/kWb97MRJ.jpg', 1),
    ('jar-2', 'SOULIN Fresh Peppermint (กระปุก 20g)', 'กลิ่นเปปเปอร์มินท์สด', 'ความสดชื่นตื่นตัวจากเปปเปอร์มินท์ธรรมชาติ ปลุกพลังสมองกระจ่างใส ขนาด 20g', 'jar', 89, 40, 'fa-jar', 'กระปุกสมุนไพร 20g', 'https://cdn.imagetourls.com/uploads/tyImg/1bnCzbMsn.jpg', 2),
    ('jar-3', 'SOULIN Citrus Vitality (กระปุก 20g)', 'กลิ่นส้มและส้มโอ', 'กลิ่นหอมสดใสผ่อนคลายด้วยอโรมาส้มซิตรัส เติมความชีวาในวันทำงาน ขนาด 20g', 'jar', 95, 35, 'fa-jar', 'กระปุกสมุนไพร 20g', 'https://cdn.imagetourls.com/uploads/tyImg/1heuOdjNT.jpg', 3),
    ('jar-4', 'SOULIN Deep Sleep Lavender (กระปุก 20g)', 'กลิ่นลาเวนเดอร์ผ่อนคลาย', 'ความหอมละมุนตระกูลดอกไม้ คลายความเครียด ช่วยให้นอนหลับสบาย ขนาด 20g', 'jar', 95, 30, 'fa-jar', 'กระปุกสมุนไพร 20g', 'https://cdn.imagetourls.com/uploads/tyImg/zqxQsznY.jpg', 4),
    ('stick-1', 'SOULIN Original Herbal (แท่งลูกกลิ้ง 10 ml)', 'สูตรดั้งเดิม', 'ยาดมแท่งทรงสลิมพกพาง่าย ขนาด 10 ml พร้อมหัวลูกกลิ้งนวดขมับ สูดสดชื่นได้ทุกที่', 'stick', 69, 60, 'fa-capsules', 'แท่งลูกกลิ้ง 10 ml', 'https://cdn.imagetourls.com/uploads/tyImg/qLwjLNbX.jpg', 5),
    ('stick-2', 'SOULIN Fresh Peppermint (แท่งลูกกลิ้ง 10 ml)', 'กลิ่นเปปเปอร์มินท์สด', 'เย็นสุดขั้วในรูปแบบแท่งลูกกลิ้ง 10 ml สูดสะดวก กลิ่นเปปเปอร์มินท์สดชื่นตื่นตัวทันที', 'stick', 69, 45, 'fa-capsules', 'แท่งลูกกลิ้ง 10 ml', 'https://cdn.imagetourls.com/uploads/tyImg/BRhnXw8s.jpg', 6),
    ('stick-3', 'SOULIN Citrus Vitality (แท่งลูกกลิ้ง 10 ml)', 'กลิ่นส้มและส้มโอ', 'ลูกกลิ้งเอสเซนเชียลออยล์กลิ่นส้มและส้มโอ ขนาด 10 ml กลิ่นหอมสดใส พกติดกระเป๋าสะดวก', 'stick', 75, 50, 'fa-capsules', 'แท่งลูกกลิ้ง 10 ml', 'https://cdn.imagetourls.com/uploads/tyImg/jkfoXhaj.jpg', 7),
    ('stick-4', 'SOULIN Deep Sleep Lavender (แท่งลูกกลิ้ง 10 ml)', 'กลิ่นลาเวนเดอร์ผ่อนคลาย', 'กลิ่นดอกลาเวนเดอร์อ่อนโยน ขนาด 10 ml แต้มขมับหรือข้อมือ ช่วยคลายกังวลและหลับสบาย', 'stick', 75, 40, 'fa-capsules', 'แท่งลูกกลิ้ง 10 ml', 'https://cdn.imagetourls.com/uploads/tyImg/rdkCFbnq.jpg', 8)
on conflict (id) do nothing;

insert into public.soulin_cms (id, title, tag, subtitle, img, gsheet_webhook)
values (
    'main',
    E'สูดความสดชื่น\nลึกถึงดวงวิญญาณ',
    '100% Natural Organic Herbs',
    'สัมผัสความผ่อนคลายกับยาดมสมุนไพรธรรมชาติแท้ SOULIN คัดสรรวัตถุดิบสมุนไพรกว่า 10 ชนิด เพื่อการเยียวยาจิตใจและคืนความสดชื่นในทุกๆ วัน',
    'https://cdn.phototourl.com/anon/2026-11-17-6fd33c34-28bf-4b63-b3ff-7da85f10f787.png',
    ''
)
on conflict (id) do nothing;

-- 4. EXPLICIT DATA API GRANTS
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on
    public.soulin_products,
    public.soulin_orders,
    public.soulin_cms,
    public.soulin_members,
    public.soulin_addresses
to anon, authenticated;

-- 5. ENABLE ROW LEVEL SECURITY ON ALL PUBLIC TABLES
alter table public.soulin_products enable row level security;
alter table public.soulin_orders enable row level security;
alter table public.soulin_cms enable row level security;
alter table public.soulin_members enable row level security;
alter table public.soulin_addresses enable row level security;

-- 6. STARTER POLICIES FOR TESTING STATIC FRONTEND WITH PUBLISHABLE KEY
-- Production upgrade path: migrate admin/member auth to Supabase Auth JWT and enforce
-- per-user `(select auth.uid())` checks plus `app_metadata` admin claims on write policies.

drop policy if exists "soulin_products_select" on public.soulin_products;
create policy "soulin_products_select" on public.soulin_products
    for select to anon, authenticated using (true);

drop policy if exists "soulin_products_insert" on public.soulin_products;
create policy "soulin_products_insert" on public.soulin_products
    for insert to anon, authenticated with check (price >= 1 and stock >= 0);

drop policy if exists "soulin_products_update" on public.soulin_products;
create policy "soulin_products_update" on public.soulin_products
    for update to anon, authenticated
    using (true)
    with check (price >= 1 and stock >= 0);

drop policy if exists "soulin_orders_select" on public.soulin_orders;
create policy "soulin_orders_select" on public.soulin_orders
    for select to anon, authenticated using (true);

drop policy if exists "soulin_orders_insert" on public.soulin_orders;
create policy "soulin_orders_insert" on public.soulin_orders
    for insert to anon, authenticated with check (total >= 0 and length(order_id) > 0);

drop policy if exists "soulin_orders_update" on public.soulin_orders;
create policy "soulin_orders_update" on public.soulin_orders
    for update to anon, authenticated
    using (true)
    with check (total >= 0 and length(order_id) > 0);

drop policy if exists "soulin_cms_select" on public.soulin_cms;
create policy "soulin_cms_select" on public.soulin_cms
    for select to anon, authenticated using (true);

drop policy if exists "soulin_cms_insert" on public.soulin_cms;
create policy "soulin_cms_insert" on public.soulin_cms
    for insert to anon, authenticated with check (id = 'main');

drop policy if exists "soulin_cms_update" on public.soulin_cms;
create policy "soulin_cms_update" on public.soulin_cms
    for update to anon, authenticated
    using (id = 'main')
    with check (id = 'main');

drop policy if exists "soulin_members_select" on public.soulin_members;
create policy "soulin_members_select" on public.soulin_members
    for select to anon, authenticated using (true);

drop policy if exists "soulin_members_insert" on public.soulin_members;
create policy "soulin_members_insert" on public.soulin_members
    for insert to anon, authenticated with check (length(username) >= 3);

drop policy if exists "soulin_members_update" on public.soulin_members;
create policy "soulin_members_update" on public.soulin_members
    for update to anon, authenticated
    using (true)
    with check (length(username) >= 3);

drop policy if exists "soulin_addresses_select" on public.soulin_addresses;
create policy "soulin_addresses_select" on public.soulin_addresses
    for select to anon, authenticated using (true);

drop policy if exists "soulin_addresses_insert" on public.soulin_addresses;
create policy "soulin_addresses_insert" on public.soulin_addresses
    for insert to anon, authenticated with check (length(owner_key) > 0);

drop policy if exists "soulin_addresses_update" on public.soulin_addresses;
create policy "soulin_addresses_update" on public.soulin_addresses
    for update to anon, authenticated
    using (true)
    with check (length(owner_key) > 0);

drop policy if exists "soulin_addresses_delete" on public.soulin_addresses;
create policy "soulin_addresses_delete" on public.soulin_addresses
    for delete to anon, authenticated using (true);

-- 7. ENABLE REALTIME REPLICATION FOR LIVE SYNC
do $$ begin
    alter publication supabase_realtime add table public.soulin_products;
exception when duplicate_object then null;
end $$;

do $$ begin
    alter publication supabase_realtime add table public.soulin_orders;
exception when duplicate_object then null;
end $$;

do $$ begin
    alter publication supabase_realtime add table public.soulin_cms;
exception when duplicate_object then null;
end $$;

-- 8. STORAGE BUCKET FOR PRODUCT & BANNER IMAGES
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'soulin-images',
    'soulin-images',
    true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "soulin_images_select" on storage.objects;
create policy "soulin_images_select"
    on storage.objects for select
    to anon, authenticated
    using (bucket_id = 'soulin-images');

drop policy if exists "soulin_images_insert" on storage.objects;
create policy "soulin_images_insert"
    on storage.objects for insert
    to anon, authenticated
    with check (bucket_id = 'soulin-images');

drop policy if exists "soulin_images_update" on storage.objects;
create policy "soulin_images_update"
    on storage.objects for update
    to anon, authenticated
    using (bucket_id = 'soulin-images')
    with check (bucket_id = 'soulin-images');

drop policy if exists "soulin_images_delete" on storage.objects;
create policy "soulin_images_delete"
    on storage.objects for delete
    to anon, authenticated
    using (bucket_id = 'soulin-images');

-- 9. AUDIT LOGS TABLE & REALTIME
create table if not exists public.soulin_audit_logs (
    log_id text primary key,
    timestamp_ms bigint not null,
    actor text not null default 'guest',
    actor_role text not null default 'guest',
    category text not null default 'system',
    action text not null,
    target_id text not null default '',
    summary text not null default '',
    severity text not null default 'info',
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists idx_soulin_audit_logs_ts_desc
    on public.soulin_audit_logs (timestamp_ms desc);

create index if not exists idx_soulin_audit_logs_category
    on public.soulin_audit_logs (category);

grant select, insert on table public.soulin_audit_logs to anon, authenticated;
revoke update, delete, truncate, trigger, references on table public.soulin_audit_logs from anon, authenticated;

alter table public.soulin_audit_logs enable row level security;

drop policy if exists "soulin_audit_logs_select" on public.soulin_audit_logs;
create policy "soulin_audit_logs_select"
    on public.soulin_audit_logs for select
    to anon, authenticated
    using (true);

drop policy if exists "soulin_audit_logs_insert" on public.soulin_audit_logs;
create policy "soulin_audit_logs_insert"
    on public.soulin_audit_logs for insert
    to anon, authenticated
    with check (true);

do $$ begin
    alter publication supabase_realtime add table public.soulin_audit_logs;
exception when duplicate_object then null;
end $$;
