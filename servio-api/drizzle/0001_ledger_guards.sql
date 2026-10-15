-- Money and history guards enforced by the database itself, so no code path can bypass them.

-- 1. booking_events and ledger_entries are append-only.
CREATE OR REPLACE FUNCTION servio_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = 'restrict_violation';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER booking_events_append_only BEFORE UPDATE OR DELETE ON booking_events
  FOR EACH ROW EXECUTE FUNCTION servio_append_only();
--> statement-breakpoint
CREATE TRIGGER ledger_entries_append_only BEFORE UPDATE OR DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION servio_append_only();
--> statement-breakpoint

-- 2. Double-entry: every ledger transaction must have >= 2 entries summing to zero.
--    Checked at COMMIT (deferred), after all entries of the transaction are inserted.
CREATE OR REPLACE FUNCTION servio_ledger_balanced() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  total bigint;
  n integer;
BEGIN
  SELECT COALESCE(SUM(amount_centavos), 0), COUNT(*) INTO total, n FROM ledger_entries WHERE txn_id = NEW.txn_id;
  IF n < 2 OR total <> 0 THEN
    RAISE EXCEPTION 'ledger transaction % is unbalanced (entries=%, sum=%)', NEW.txn_id, n, total
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER ledger_entries_balanced AFTER INSERT ON ledger_entries
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION servio_ledger_balanced();
--> statement-breakpoint

-- 3. Keep updated_at honest.
CREATE OR REPLACE FUNCTION servio_touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER users_touch BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION servio_touch_updated_at();
--> statement-breakpoint
CREATE TRIGGER pro_profiles_touch BEFORE UPDATE ON pro_profiles FOR EACH ROW EXECUTE FUNCTION servio_touch_updated_at();
--> statement-breakpoint
CREATE TRIGGER service_skus_touch BEFORE UPDATE ON service_skus FOR EACH ROW EXECUTE FUNCTION servio_touch_updated_at();
--> statement-breakpoint
CREATE TRIGGER bookings_touch BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION servio_touch_updated_at();
