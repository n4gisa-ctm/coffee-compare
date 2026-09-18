-- Coffee Compare: Supabase セットアップSQL
-- Supabaseダッシュボード → SQL Editor に貼り付けて Run してください。
--
-- 構成：全データを records テーブル（ユーザーごと・ストアごと・IDごと）に保存。
-- RLS（行レベルセキュリティ）で「自分の行しか読み書きできない」ことを保証する。

create table if not exists public.records (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  store text not null,
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, store, id)
);

alter table public.records enable row level security;

drop policy if exists "own rows" on public.records;
create policy "own rows" on public.records
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 複数の書き込みを1トランザクションで適用する関数。
-- アプリの整合性ルール（Brew・Comparison・Draft更新を不可分にする）をクラウド側でも守る。
create or replace function public.apply_ops(ops jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  op jsonb;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  for op in select * from jsonb_array_elements(ops) loop
    if op->>'type' = 'put' then
      insert into public.records (user_id, store, id, data)
      values (
        auth.uid(),
        op->>'store',
        coalesce(op->'value'->>'id', op->'value'->>'key'),
        op->'value'
      )
      on conflict (user_id, store, id)
      do update set data = excluded.data, updated_at = now();
    elsif op->>'type' = 'delete' then
      delete from public.records
      where user_id = auth.uid() and store = op->>'store' and id = op->>'key';
    elsif op->>'type' = 'clear' then
      delete from public.records
      where user_id = auth.uid() and store = op->>'store';
    else
      raise exception 'unknown op type: %', op->>'type';
    end if;
  end loop;
end;
$$;
