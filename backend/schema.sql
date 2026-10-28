-- Korean Gift marketplace schema. Run once in the selected Supabase project's SQL editor.
begin;
create table public.kg_admins (
 user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.kg_admins enable row level security;
revoke all on public.kg_admins from anon,authenticated;
create function public.kg_is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.kg_admins where user_id=(select auth.uid()));
$$;
revoke all on function public.kg_is_admin() from public;
grant execute on function public.kg_is_admin() to authenticated;

create table public.kg_submissions (
 id uuid primary key,
 owner_id uuid not null references auth.users(id),
 manufacturer text not null check(length(trim(manufacturer)) between 1 and 120),
 contact_name text not null check(length(trim(contact_name)) between 1 and 80),
 contact_email text not null check(length(contact_email) between 3 and 254 and contact_email like '%@%'),
 contact_phone text not null default '' check(length(contact_phone)<=40),
 name text not null check(length(trim(name)) between 1 and 100),
 description text not null check(length(trim(description)) between 1 and 3000),
 specs text not null check(length(trim(specs)) between 1 and 3000),
 name_en text not null default '' check(length(name_en)<=100),
 description_en text not null default '' check(length(description_en)<=3000),
 specs_en text not null default '' check(length(specs_en)<=3000),
 price_krw bigint not null check(price_krw between 1 and 100000000),
 image_path text not null check(length(image_path) between 1 and 300 and image_path !~ '\.\.'),
 approved_image_path text check(length(approved_image_path)<=300 and approved_image_path !~ '\.\.'),
 publish_en boolean not null default true,
 rights_confirmed boolean not null check(rights_confirmed),
 privacy_consent boolean not null check(privacy_consent),
 status text not null default 'pending' check(status in ('pending','approved','rejected','unpublished')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.kg_submissions enable row level security;
create policy kg_submission_owner_read on public.kg_submissions for select to authenticated using(owner_id=(select auth.uid()) or (select public.kg_is_admin()));
create policy kg_submission_insert on public.kg_submissions for insert to authenticated with check(
 owner_id=(select auth.uid()) and status='pending' and approved_image_path is null
 and name_en='' and description_en='' and specs_en=''
 and image_path like auth.uid()::text || '/' || id::text || '/%'
 and exists(select 1 from storage.objects where bucket_id='kg-submissions' and name=image_path)
);
create policy kg_submission_admin_update on public.kg_submissions for update to authenticated using((select public.kg_is_admin())) with check((select public.kg_is_admin()));
revoke all on public.kg_submissions from anon,authenticated;
grant select on public.kg_submissions to authenticated;
grant insert(id,owner_id,manufacturer,contact_name,contact_email,contact_phone,name,description,specs,price_krw,image_path,rights_confirmed,privacy_consent) on public.kg_submissions to authenticated;
grant update(name,description,specs,name_en,description_en,specs_en,price_krw,image_path,approved_image_path,publish_en) on public.kg_submissions to authenticated;

create table public.kg_products (
 id uuid primary key references public.kg_submissions(id),
 name text not null,description text not null,specs text not null,
 name_en text not null,description_en text not null,specs_en text not null,
 price_krw bigint not null check(price_krw between 1 and 100000000),
 image_path text not null,
 published_at timestamptz not null default now()
);
alter table public.kg_products enable row level security;
revoke all on public.kg_products from anon,authenticated;
grant select on public.kg_products to anon,authenticated;
create policy kg_products_public on public.kg_products for select to anon,authenticated using(true);

create function public.kg_touch_submission() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=now();return new;end $$;
create trigger kg_touch_submission before update on public.kg_submissions for each row execute function public.kg_touch_submission();
revoke all on function public.kg_touch_submission() from public;

create function public.kg_approve(submission_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare item public.kg_submissions;
begin
 if not public.kg_is_admin() then raise exception 'Admin role required' using errcode='42501';end if;
 select * into item from public.kg_submissions where id=submission_id for update;
 if not found then raise exception 'Submission not found';end if;
 if length(trim(item.name_en))=0 or length(trim(item.description_en))=0 or length(trim(item.specs_en))=0 then raise exception 'English copy is required for bilingual publication';end if;
 if item.approved_image_path is null or not exists(select 1 from storage.objects where bucket_id='kg-products' and name=item.approved_image_path) then raise exception 'Approved image missing';end if;
 insert into public.kg_products(id,name,description,specs,name_en,description_en,specs_en,price_krw,image_path)
 values(item.id,item.name,item.description,item.specs,item.name_en,item.description_en,item.specs_en,item.price_krw,item.approved_image_path)
 on conflict(id) do update set name=excluded.name,description=excluded.description,specs=excluded.specs,name_en=excluded.name_en,description_en=excluded.description_en,specs_en=excluded.specs_en,price_krw=excluded.price_krw,image_path=excluded.image_path;
 update public.kg_submissions set status='approved',publish_en=true where id=submission_id;
end $$;
create function public.kg_reject(submission_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.kg_is_admin() then raise exception 'Admin role required' using errcode='42501';end if;
 perform 1 from public.kg_submissions where id=submission_id for update;
 if not found then raise exception 'Submission not found';end if;
 delete from public.kg_products where id=submission_id;
 update public.kg_submissions set status='rejected' where id=submission_id;
end $$;
create function public.kg_unpublish(submission_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.kg_is_admin() then raise exception 'Admin role required' using errcode='42501';end if;
 perform 1 from public.kg_submissions where id=submission_id for update;
 if not found then raise exception 'Submission not found';end if;
 delete from public.kg_products where id=submission_id;
 update public.kg_submissions set status='unpublished' where id=submission_id;
end $$;
revoke all on function public.kg_approve(uuid),public.kg_reject(uuid),public.kg_unpublish(uuid) from public;
grant execute on function public.kg_approve(uuid),public.kg_reject(uuid),public.kg_unpublish(uuid) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('kg-submissions','kg-submissions',false,5242880,array['image/jpeg','image/png','image/webp']),
('kg-products','kg-products',true,5242880,array['image/jpeg','image/png','image/webp']);
create policy kg_private_upload on storage.objects for insert to authenticated with check(
 bucket_id='kg-submissions' and (storage.foldername(name))[1]=auth.uid()::text
 and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
);
create policy kg_private_read on storage.objects for select to authenticated using(
 bucket_id='kg-submissions' and ((storage.foldername(name))[1]=auth.uid()::text or (select public.kg_is_admin()))
);
create policy kg_public_upload on storage.objects for insert to authenticated with check(
 bucket_id='kg-products' and (select public.kg_is_admin())
 and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
);
-- No manufacturer update/delete on submissions or stored files; no public access to private submission images.
commit;
-- Create the owner's Auth user first, then grant admin access with SQL:
-- insert into public.kg_admins(user_id) select id from auth.users where email='OWNER_EMAIL';
