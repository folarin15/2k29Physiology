create or replace function public.member_name_matches(p_submitted_name text, p_allowed_name text)
returns boolean
language sql
immutable
set search_path = public
as $$
  with names as (
    select
      public.normalize_member_name(p_submitted_name) as submitted,
      public.normalize_member_name(p_allowed_name) as allowed
  ), compacted as (
    select
      submitted,
      allowed,
      public.normalize_member_name_key(submitted) as submitted_key,
      public.normalize_member_name_key(allowed) as allowed_key,
      regexp_replace(submitted, '\s+', '', 'g') as submitted_compact,
      regexp_replace(allowed, '\s+', '', 'g') as allowed_compact
    from names
  )
  select submitted = allowed
    or submitted_key = allowed_key
    or submitted_compact = allowed_compact
    or (
      char_length(submitted_compact) >= 6
      and char_length(allowed_compact) >= 6
      and not exists (
        select 1
        from regexp_split_to_table(submitted, '\s+') as token
        where char_length(token) >= 2
          and position(token in allowed_compact) = 0
      )
      and not exists (
        select 1
        from regexp_split_to_table(allowed, '\s+') as token
        where char_length(token) >= 2
          and position(token in submitted_compact) = 0
      )
    )
  from compacted;
$$;
