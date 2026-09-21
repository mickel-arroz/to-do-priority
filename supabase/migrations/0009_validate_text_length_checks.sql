-- Segundo paso, opcional y separado a propósito: marca como validadas las
-- constraints que `0008` dejó `not valid`, lo que equivale a declarar que
-- TODAS las filas que ya existen también cumplen el tope.
--
-- SEGURIDAD: `validate constraint` solo lee. No borra, no actualiza y no
-- bloquea escrituras (toma un SHARE UPDATE EXCLUSIVE, que convive con
-- insert/update/delete). Si alguna fila vieja se pasa del tope, la sentencia
-- falla con el error 23514 nombrando la constraint y no cambia nada: la fila
-- sigue ahí, intacta.
--
-- En una base nueva es instantáneo. En producción, ejecuta primero la consulta
-- de diagnóstico del encabezado de `0008`:
--   - si todo da 0, este archivo pasa entero;
--   - si algo da más de 0, deja esa línea comentada. La constraint `not valid`
--     de `0008` ya protege toda escritura nueva; validar solo añade la
--     garantía retroactiva, y eso exige decidir antes qué hacer con esas filas
--     (acortarlas es una decisión tuya, no de esta migración).

alter table categories       validate constraint categories_name_length_check;
alter table tasks            validate constraint tasks_title_length_check;
alter table tasks            validate constraint tasks_description_length_check;
alter table subtasks         validate constraint subtasks_title_length_check;
alter table habits           validate constraint habits_name_length_check;
alter table habits           validate constraint habits_description_length_check;
alter table task_completions validate constraint task_completions_title_snapshot_length_check;
