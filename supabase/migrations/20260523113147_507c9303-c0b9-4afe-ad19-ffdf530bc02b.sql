create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  has_any_admin boolean;
begin
  insert into public.profiles (id, name, company)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.raw_user_meta_data ->> 'company', '')
  );

  select exists(select 1 from public.user_roles where role = 'admin') into has_any_admin;
  if has_any_admin then
    insert into public.user_roles (user_id, role) values (new.id, 'client');
  else
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;

  return new;
end;
$$;