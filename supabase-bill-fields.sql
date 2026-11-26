-- Run once in Supabase > SQL Editor so GSTIN and bill footer are saved for the whole shop (owner + staff, all devices)
alter table shops add column if not exists gst_no text;
alter table shops add column if not exists bill_footer text;
