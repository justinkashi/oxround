-- Fix RLS gaps found in the 2026-07-05 audit.
-- 1) Staff need to add/cancel bookings for members (CRM roster). Only self-insert existed.
CREATE POLICY bookings_staff_insert ON class_bookings FOR INSERT
  WITH CHECK (gym_id = auth_gym_id() AND is_staff());

-- 2) Memberships insert/update were owner-only; receptionists/managers must record payments
--    (recordPayment updates payment_status) and add members. Broaden to staff.
DROP POLICY IF EXISTS memberships_owner_insert ON memberships;
DROP POLICY IF EXISTS memberships_owner_update ON memberships;
CREATE POLICY memberships_staff_insert ON memberships FOR INSERT
  WITH CHECK (gym_id = auth_gym_id() AND is_staff());
CREATE POLICY memberships_staff_update ON memberships FOR UPDATE
  USING (gym_id = auth_gym_id() AND is_staff());
