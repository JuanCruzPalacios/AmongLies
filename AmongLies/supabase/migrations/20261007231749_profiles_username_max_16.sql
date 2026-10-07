-- El nombre de usuario se usa como apodo en las salas, que admite hasta 16 caracteres.
alter table public.profiles drop constraint profiles_username_check;
alter table public.profiles add constraint profiles_username_check
  check (username ~ '^[A-Za-z0-9_]{3,16}$');
