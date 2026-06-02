alter table public.member_access_attempts
add column if not exists submitted_name text,
add column if not exists failure_reason text;

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
  ), tokens as (
    select
      *,
      array(
        select distinct token
        from regexp_split_to_table(submitted, '\s+') as token
        where char_length(token) >= 2
      ) as submitted_tokens,
      array(
        select distinct token
        from regexp_split_to_table(allowed, '\s+') as token
        where char_length(token) >= 2
      ) as allowed_tokens
    from compacted
  ), scored as (
    select
      *,
      coalesce(array_length(submitted_tokens, 1), 0) as submitted_count,
      coalesce(array_length(allowed_tokens, 1), 0) as allowed_count,
      (
        select count(*)
        from unnest(allowed_tokens) as token
        where position(token in submitted_compact) > 0
      ) as allowed_overlap,
      not exists (
        select 1
        from unnest(submitted_tokens) as token
        where position(token in allowed_compact) = 0
      ) as submitted_tokens_are_real,
      not exists (
        select 1
        from unnest(allowed_tokens) as token
        where position(token in submitted_compact) = 0
      ) as all_allowed_tokens_present
    from tokens
  )
  select submitted = allowed
    or submitted_key = allowed_key
    or submitted_compact = allowed_compact
    or (
      char_length(submitted_compact) >= 6
      and char_length(allowed_compact) >= 6
      and submitted_tokens_are_real
      and all_allowed_tokens_present
    )
    or (
      char_length(submitted_compact) >= 8
      and submitted_tokens_are_real
      and submitted_count >= 2
      and allowed_overlap >= 2
    )
  from scored;
$$;
