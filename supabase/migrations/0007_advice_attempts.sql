-- Un fallo de la IA ya no cuesta el día entero.
--
-- Hasta aquí, reclamar el día y marcar el intento eran el mismo acto: se
-- escribía `last_attempt_date` antes de llamar al proveedor, así que un
-- timeout dejaba al usuario sin consejo hasta el día siguiente por mucho que
-- volviera a entrar. Con la latencia real de los modelos eso pasaba a menudo.
--
-- El reclamo pasa a contar intentos en vez de responder sí/no una sola vez:
-- se permiten unos pocos por día y luego se para. Sigue sin haber bucle —que
-- era lo que el diseño original quería evitar—, pero un fallo transitorio ya
-- se recupera en la siguiente navegación.

alter table user_advice add column attempt_count integer not null default 0;

-- Reclama un intento del día de forma atómica. Devuelve true sólo si a esta
-- ejecución le toca llamar a la IA; el bloqueo de fila de Postgres serializa
-- las pestañas simultáneas, así que dos nunca reciben true a la vez.
--
-- No lo concede cuando el consejo de hoy ya está guardado (no hay nada que
-- generar) ni cuando el día agotó sus intentos.
create or replace function claim_advice_day(p_day date) returns boolean
language plpgsql as $$
declare
  -- Mantener en sintonía con ADVICE_ATTEMPTS_PER_DAY en lib/advice.ts, que
  -- decide lo mismo sin ir a la base para no gastar una llamada de más.
  v_max constant integer := 3;
  v_claimed boolean;
begin
  insert into user_advice (user_id, last_attempt_date, attempt_count)
  values (auth.uid(), p_day, 1)
  on conflict (user_id) do update
    set last_attempt_date = p_day,
        -- El contador arranca de cero en cuanto cambia el día
        attempt_count = case
          when user_advice.last_attempt_date is distinct from p_day then 1
          else user_advice.attempt_count + 1
        end,
        updated_at = now()
    where user_advice.last_advice_date is distinct from p_day
      and (
        user_advice.last_attempt_date is distinct from p_day
        or user_advice.attempt_count < v_max
      )
  returning true into v_claimed;

  return coalesce(v_claimed, false);
end;
$$;
