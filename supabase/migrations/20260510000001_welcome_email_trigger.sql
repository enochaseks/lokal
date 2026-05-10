-- Trigger welcome email when a new user signs up
-- Requires: pg_net extension enabled

create or replace function public.handle_new_user_welcome()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform
    net.http_post(
      url := 'https://aabyxfcrrqivjupawxdu.supabase.co/functions/v1/send-welcome-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'type', 'INSERT',
        'table', 'users',
        'record', jsonb_build_object(
          'id', new.id,
          'email', new.email,
          'created_at', new.created_at
        )
      )
    );
  return new;
end;
$$;

-- Drop existing trigger if it exists
drop trigger if exists on_new_user_welcome on auth.users;

-- Create trigger on new user creation
create trigger on_new_user_welcome
  after insert on auth.users
  for each row
  execute function public.handle_new_user_welcome();
