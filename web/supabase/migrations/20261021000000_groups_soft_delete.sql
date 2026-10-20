-- Groups can be removed (and restored by Undo) like other rows: set deleted_at.
alter table public.groups add column deleted_at timestamptz null;
