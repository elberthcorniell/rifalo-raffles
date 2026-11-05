-- Let an admin undo a mistaken confirm or reject and return the purchase to pending.
-- Rejected purchases remember the tickets they held so a revert can reserve those
-- same numbers again, when they are still free.

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS held_ticket_ids uuid[] NOT NULL DEFAULT '{}';

UPDATE public.purchases p
SET held_ticket_ids = sub.ids
FROM (
  SELECT purchase_id, array_agg(id ORDER BY number) AS ids
  FROM public.tickets
  WHERE purchase_id IS NOT NULL
  GROUP BY purchase_id
) sub
WHERE p.id = sub.purchase_id
  AND cardinality(p.held_ticket_ids) = 0;

CREATE OR REPLACE FUNCTION private.assign_random_tickets(
  p_raffle_id uuid,
  p_quantity integer,
  p_purchase_id uuid
)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_numbers text[];
  v_ids uuid[];
  v_count integer;
BEGIN
  IF p_quantity IS NULL OR p_quantity < 1 THEN
    RAISE EXCEPTION 'Quantity must be at least 1';
  END IF;

  WITH picked AS (
    SELECT t.id
    FROM public.tickets t
    WHERE t.raffle_id = p_raffle_id
      AND t.status = 'available'
    ORDER BY random()
    LIMIT p_quantity
    FOR UPDATE SKIP LOCKED
  ),
  updated AS (
    UPDATE public.tickets t
    SET status = 'reserved', purchase_id = p_purchase_id
    FROM picked
    WHERE t.id = picked.id
    RETURNING t.id, t.display_number, t.number
  )
  SELECT
    array_agg(u.display_number ORDER BY u.number),
    array_agg(u.id ORDER BY u.number),
    count(*)::integer
  INTO v_numbers, v_ids, v_count
  FROM updated u;

  IF v_count IS NULL OR v_count < p_quantity THEN
    RAISE EXCEPTION 'Not enough available tickets. Requested: %, available: %',
      p_quantity,
      coalesce(v_count, 0);
  END IF;

  UPDATE public.purchases
  SET held_ticket_ids = coalesce(v_ids, '{}'::uuid[])
  WHERE id = p_purchase_id;

  RETURN v_numbers;
END;
$$;

CREATE OR REPLACE FUNCTION private.reject_purchase(
  p_purchase_id uuid,
  p_reviewed_by uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status FROM public.purchases WHERE id = p_purchase_id FOR UPDATE;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Purchase not found';
  END IF;
  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'Purchase is not pending (status=%)', v_status;
  END IF;

  UPDATE public.purchases
  SET status = 'rejected',
      reviewed_at = now(),
      reviewed_by = p_reviewed_by,
      notes = coalesce(p_notes, notes),
      held_ticket_ids = coalesce(
        (
          SELECT array_agg(t.id ORDER BY t.number)
          FROM public.tickets t
          WHERE t.purchase_id = p_purchase_id
        ),
        '{}'::uuid[]
      )
  WHERE id = p_purchase_id;

  UPDATE public.tickets
  SET status = 'available', purchase_id = NULL
  WHERE purchase_id = p_purchase_id
    AND status = 'reserved';
END;
$$;

CREATE OR REPLACE FUNCTION private.revert_purchase(p_purchase_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_kind text;
  v_quantity integer;
  v_org_id uuid;
  v_raffle_id uuid;
  v_held uuid[];
  v_reward_id uuid;
  v_missing integer;
  v_ready integer;
  v_reserved integer;
  v_linked integer;
  v_taken text;
BEGIN
  SELECT status, kind, quantity, org_id, raffle_id, held_ticket_ids
  INTO v_status, v_kind, v_quantity, v_org_id, v_raffle_id, v_held
  FROM public.purchases
  WHERE id = p_purchase_id
  FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Compra no encontrada';
  END IF;

  IF v_kind IS DISTINCT FROM 'paid' THEN
    RAISE EXCEPTION 'Solo se pueden revertir compras de pago. Los boletos de referido se anulan al revertir la compra original.';
  END IF;

  IF v_status = 'pending' THEN
    RAISE EXCEPTION 'La compra ya está pendiente';
  END IF;

  IF v_status NOT IN ('confirmed', 'rejected') THEN
    RAISE EXCEPTION 'No se puede revertir una compra en estado %', v_status;
  END IF;

  -- Lock the org before tickets so this does not deadlock with a new purchase,
  -- which locks the org first and then available tickets.
  PERFORM 1 FROM public.organizations WHERE id = v_org_id FOR UPDATE;

  IF v_status = 'confirmed' THEN
    SELECT id
    INTO v_reward_id
    FROM public.purchases
    WHERE reward_source_purchase_id = p_purchase_id
    FOR UPDATE;

    IF v_reward_id IS NOT NULL THEN
      PERFORM 1
      FROM public.tickets
      WHERE purchase_id = v_reward_id
      FOR UPDATE;

      UPDATE public.tickets
      SET status = 'available', purchase_id = NULL
      WHERE purchase_id = v_reward_id;

      DELETE FROM public.purchases WHERE id = v_reward_id;
    END IF;

    PERFORM 1
    FROM public.tickets
    WHERE purchase_id = p_purchase_id
    FOR UPDATE;

    UPDATE public.tickets
    SET status = 'reserved'
    WHERE purchase_id = p_purchase_id
      AND status = 'sold';

    SELECT
      count(*) FILTER (WHERE status = 'reserved')::integer,
      count(*)::integer
    INTO v_reserved, v_linked
    FROM public.tickets
    WHERE purchase_id = p_purchase_id;

    IF v_linked IS DISTINCT FROM v_quantity OR v_reserved IS DISTINCT FROM v_quantity THEN
      RAISE EXCEPTION 'No se puede revertir: se esperaban % boletos de esta compra y hay %.',
        v_quantity,
        coalesce(v_linked, 0);
    END IF;
  ELSE
    PERFORM public.assert_org_ticket_quota(v_org_id, v_quantity);

    IF v_held IS NOT NULL AND cardinality(v_held) > 0 THEN
      IF cardinality(v_held) <> v_quantity THEN
        RAISE EXCEPTION 'No se puede revertir: el registro de boletos no coincide con la cantidad de la compra.';
      END IF;

      PERFORM 1
      FROM public.tickets
      WHERE id = ANY (v_held)
      ORDER BY id
      FOR UPDATE;

      SELECT
        count(*) FILTER (WHERE t.id IS NULL)::integer,
        count(*) FILTER (
          WHERE t.id IS NOT NULL
            AND t.status = 'available'
            AND t.raffle_id = v_raffle_id
            AND t.purchase_id IS NULL
        )::integer,
        string_agg('#' || t.display_number, ', ' ORDER BY t.number) FILTER (
          WHERE t.id IS NOT NULL
            AND NOT (
              t.status = 'available'
              AND t.raffle_id = v_raffle_id
              AND t.purchase_id IS NULL
            )
        )
      INTO v_missing, v_ready, v_taken
      FROM unnest(v_held) AS held(id)
      LEFT JOIN public.tickets t ON t.id = held.id;

      IF coalesce(v_missing, 0) > 0 THEN
        RAISE EXCEPTION 'No se puede revertir porque faltan boletos de esta compra.';
      END IF;

      IF v_taken IS NOT NULL THEN
        RAISE EXCEPTION 'No se puede revertir porque estos boletos ya están asignados a otra compra: %', v_taken;
      END IF;

      IF coalesce(v_ready, 0) <> v_quantity THEN
        RAISE EXCEPTION 'No se puede revertir porque los boletos ya no están libres.';
      END IF;

      UPDATE public.tickets
      SET status = 'reserved', purchase_id = p_purchase_id
      WHERE id = ANY (v_held)
        AND status = 'available'
        AND raffle_id = v_raffle_id
        AND purchase_id IS NULL;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'No se puede revertir porque los boletos cambiaron mientras se procesaba.';
      END IF;

      SELECT count(*)::integer
      INTO v_reserved
      FROM public.tickets
      WHERE purchase_id = p_purchase_id
        AND status = 'reserved';

      IF v_reserved IS DISTINCT FROM v_quantity THEN
        RAISE EXCEPTION 'No se puede revertir porque los boletos cambiaron mientras se procesaba.';
      END IF;
    ELSE
      PERFORM private.assign_random_tickets(v_raffle_id, v_quantity, p_purchase_id);
    END IF;
  END IF;

  UPDATE public.purchases
  SET status = 'pending',
      reviewed_at = NULL,
      reviewed_by = NULL
  WHERE id = p_purchase_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_revert_purchase(p_purchase_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  PERFORM private.revert_purchase(p_purchase_id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_revert_purchase(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_revert_purchase(uuid) TO service_role;
