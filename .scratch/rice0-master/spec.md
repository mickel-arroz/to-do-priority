INTENCIÓN: Fix
El árbol contiene múltiples correcciones de bugs, ajustes de UI y pequeñas mejoras sobre un sistema existente.

RESUMEN
Se requiere corregir diversos errores en hábitos, metas, comportamiento de modales en mobile y gestos de navegación, así como rediseñar la experiencia de modales y menús móviles, eliminar la racha del dashboard, formatear fechas relativas de vencimiento, aumentar caracteres de subtareas y añadir pegado inteligente con autogeneración de subtareas.

SPEC

PROBLEMA
El sistema presenta fallos en el cálculo de días completados para metas y hábitos basados en tareas vinculadas repetibles, mal comportamiento de modales y menús móviles en pantallas pequeñas (incluyendo enfoque automático no deseado y falta de ocupación total de pantalla), problemas con el botón de retroceso cerrando la app en vez de la modal, elementos visuales innecesarios como la racha en el dashboard, visualización inflexible de fechas de vencimiento, límites estrictos de caracteres en subtareas y ausencia de parseo de texto con saltos de línea o listas al pegar.

SOLUCIÓN
Ajustar la lógica de creación de tareas con prioridad 4 por defecto, corregir la evaluación de éxito de hábitos y metas considerando tareas recurrentes por fecha de vencimiento sin importar si ya pasaron, interceptar el gesto de retroceso del navegador/móvil para cerrar modales abiertas, deshabilitar el autose foco en modales para mobile y tablets, eliminar el widget de racha del dashboard, rediseñar todas las modales y el menú móvil para ocupar el 100% de la pantalla y fijar cabeceras y pies de página en modales con scroll interno, actualizar el formato de fecha a 'Ayer' y 'Mañana', ampliar el límite de caracteres de subtareas a 200 en base de datos y UI, e implementar la detección de saltos de línea y listas al pegar texto para crear subtareas automáticamente.

DECISIONES DE IMPLEMENTACIÓN
- Las nuevas tareas creadas tendrán prioridad 4 por defecto.
- La evaluación del éxito de una meta o hábito se basará en si las tareas vinculadas con fecha de vencimiento coincidente con el día del calendario fueron completadas, permitiendo completarlas de forma retroactiva.
- Se añadirá un listener global para el evento de retroceso (history/back gesture) cuando una modal esté activa para cerrar la modal en lugar de navegar hacia atrás.
- Se evitará el autofocus en inputs dentro de modales cuando el viewport corresponda a mobile o tablet.
- Se elimina el componente de racha de la vista home/dashboard.
- Las modales y el menú desplegable del navbar mobile ocuparán la totalidad de la pantalla y mantendrán header y footer estáticos con scroll interno exclusivo para el contenido.
- Las fechas de vencimiento mostrarán 'Ayer' o 'Mañana' si corresponden al día anterior o posterior al actual respectivamente.
- Se ampliará el límite del campo de subtareas a 200 caracteres en la base de datos, modelos y componentes de UI.
- Se interceptará el evento de pegado (paste) en las subtareas para analizar si el texto contiene saltos de línea o listas y fragmentarlo en múltiples subtareas.

DECISIONES DE TESTING
- Verificar la creación de tareas con prioridad 4 por defecto.
- Validar el cálculo de éxito en metas y hábitos con tareas repetibles y completadas tardíamente.
- Comprobar que el gesto o botón de atrás cierra la modal activa sin salir de la vista actual.
- Asegurar que las modales en mobile no aplican autofocus en dispositivos móviles/tablets.
- Verificar la ausencia de la racha en el dashboard.
- Comprobar que modales y menús móviles ocupan toda la pantalla y mantienen cabecera y pie fijos con scroll interno.
- Validar el despliegue correcto de los textos 'Ayer' y 'Mañana' según la fecha de vencimiento.
- Verificar el límite de 200 caracteres en subtareas.
- Comprobar la creación automática de múltiples subtareas al pegar texto con listas o saltos de línea.

FUERA DE ALCANCE
- Modificación de la lógica de notificaciones push.
- Rediseño de vistas de escritorio que no sean modales.

CHECKS DEL SPEC
- [ ] Todas las nuevas tareas se crean con prioridad 4 seleccionada por defecto.
- [ ] Los hábitos y metas marcan el día como exitoso si las tareas vinculadas y programadas para ese día se completan, incluso de forma posterior.
- [ ] El gesto de volver atrás con una modal abierta cierra exclusivamente la modal.
- [ ] No se realiza focus automático en inputs al abrir modales en dispositivos móviles o tablets.
- [ ] La racha ha sido eliminada de la vista home o dashboard.
- [ ] Las modales y el menú del navbar mobile ocupan toda la pantalla y tienen scroll exclusivo para el contenido manteniendo header y footer fijos.
- [ ] Las fechas de vencimiento muestran 'Ayer' o 'Mañana' cuando corresponde.
- [ ] El límite de caracteres para subtareas es de 200 en UI, modelo y base de datos.
- [ ] Pegar texto con saltos de línea o listas en subtareas genera múltiples subtareas automáticamente.

TICKETS

TICKET t1: Corrección de prioridad por defecto en nuevas tareas
Configurar la lógica de creación de tareas para que la prioridad 4 esté seleccionada por defecto.
CHECKS
- [ ] Al crear una nueva tarea, la prioridad seleccionada por defecto es 4.

TICKET t2: Corrección de cálculo de hábitos y metas con tareas vinculadas
Actualizar la lógica de evaluación de metas y hábitos para considerar tareas recurrentes y permitir marcarlas como exitosas de forma retroactiva si se completan días después.
CHECKS
- [ ] Un hábito o meta marca el día como exitoso si las tareas vinculadas programadas para ese día se completan, incluso de manera posterior.
- [ ] Las tareas vinculadas se evalúan por su título y fecha de vencimiento sin verse afectadas por la duplicación de tareas repetitivas.

TICKET t3: Manejo del gesto de retroceso y autofocus en modales móviles
Interceptar el evento de retroceso para cerrar modales abiertas en lugar de salir de la app o cambiar de página, y desactivar el autofocus en inputs para dispositivos móviles y tablets.
CHECKS
- [ ] Al hacer el gesto o acción de volver atrás con una modal abierta, la modal se cierra y la app no retrocede de página.
- [ ] Abrir una modal en mobile o tablet no realiza focus automático en el primer input.

TICKET t4: Ajustes de UI y diseño responsivo para modales y dashboard
Eliminar la racha del dashboard, hacer que modales y menús mobile ocupen toda la pantalla, fijar header y footer en modales con scroll interno, y actualizar el formato de fechas a 'Ayer' y 'Mañana'.
CHECKS
- [ ] La racha ya no aparece en la vista home o dashboard.
- [ ] Todas las modales y el menú del navbar mobile ocupan toda la pantalla en dispositivos móviles.
- [ ] El header y el footer de las modales permanecen fijos visibles mientras el scroll actúa solo sobre el contenido.
- [ ] Las fechas de vencimiento un día antes o un día después muestran 'Ayer' y 'Mañana' respectivamente.

TICKET t5: Ampliación de caracteres y pegado inteligente en subtareas
Extender el límite de caracteres de subtareas a 200 en base de datos, modelo y UI, e implementar el listener de pegado para detectar saltos de línea y listas y convertirlos en subtareas independientes.
CHECKS
- [ ] Se pueden guardar subtareas de hasta 200 caracteres en la UI y base de datos.
- [ ] Pegar texto con saltos de línea, listas enumeradas o desordenadas crea automáticamente una subtresa por cada elemento detectado.