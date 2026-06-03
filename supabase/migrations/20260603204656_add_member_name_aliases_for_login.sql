create or replace function public.normalize_member_name(p_name text)
returns text
language sql
immutable
set search_path = public
as $$
  with cleaned as (
    select trim(regexp_replace(upper(regexp_replace(coalesce(p_name, ''), '[^A-Za-z0-9]+', ' ', 'g')), '\s+', ' ', 'g')) as value
  ), aliased as (
    select regexp_replace(
      regexp_replace(
        regexp_replace(value, '\m(RACHEL|RACHEAL|RACHAEL)\M', 'RACHAEL', 'g'),
        '\m(HAMMEDAH|HAMEEDAH|HAMEDAH)\M',
        'HAMEEDAH',
        'g'
      ),
      '\m(OLUWATIMILEHIN|OLUWATEMILEHIN|OLUWATIMILEYIN)\M',
      'OLUWATIMILEYIN',
      'g'
    ) as value
    from cleaned
  )
  select value from aliased;
$$;
