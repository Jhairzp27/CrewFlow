# **Documento de Requisitos de Negocio: Sistema Web de Gestión de Personal U2 y U3**

## **1\. Objetivo del Sistema**

Proveer una solución web orientada a satisfacer los procesos de negocio para la gestión de rotación, permisos y vacaciones del personal (Servicio y Cocina) en las sucursales U2 y U3. El sistema debe asegurar los niveles mínimos de operación diaria y monitorear proactivamente el desgaste laboral de la plantilla.

## **2\. Autenticación y Control de Accesos (Roles)**

Dado que la administración de los horarios está a cargo de dos personas distintas, es indispensable implementar un control de acceso basado en roles para asegurar la trazabilidad de las decisiones y aprobaciones:

> * **Rol Administrador / Gestor de Horarios:** Cuenta con privilegios para aprobar, rechazar o modificar solicitudes de días libres y vacaciones, asignar rotaciones entre sucursales, registrar excepciones por fuerza mayor y monitorear el panel de desgaste laboral.  
> * **Rol Empleado (Portal de autogestión):** Permite al trabajador (área de Servicio o Cocina) visualizar su turno asignado, revisar la sucursal en la que debe presentarse, y enviar solicitudes formales de permisos cumpliendo las reglas de antelación.

## **3\. Reglas del Dominio y Restricciones Operativas**

La lógica central de la aplicación debe validar las siguientes reglas de negocio antes de permitir la generación de horarios o aprobación de ausencias:

> * **Pool y Rotación de Personal:** La plantilla total cuenta con aproximadamente 8 personas que no tienen un local fijo, sino que **rotan dinámicamente entre U2 y U3** para cubrir las necesidades operativas.  
> * **Restricción de Fin de Semana (Viernes a Domingo):** El 100% del personal de ambas áreas debe estar operativo obligatoriamente. El sistema debe bloquear cualquier solicitud de día libre regular durante estos tres días.  
> * **Capacidad Mínima Requerida en Cocina:** El sistema debe alertar si los horarios no cubren los siguientes cupos:  
  * **Sucursal U2:** 2 personas (Lunes a Jueves) y 3 personas (Viernes a Domingo).  
  * **Sucursal U3:** 1 persona (Lunes a Jueves) y 2 personas (Viernes a Domingo).  
> * **Horarios de Ingreso Específicos:**  
  * **Servicio U2:** De Lunes a Jueves, 1 persona ingresa a las 11:00 am y 2 ingresan a las 12:00 pm. Martes a las 10:30 am para inventario.  
  * **Servicio U3:** 2 personas ingresan a las 12:00 pm. Sábados con ingresos escalonados a las 11:00 am y 4:00 pm.  
  * **Limpieza profunda:** Evento a las 9:00 am y 10:00 am que requiere asignación parcial del equipo dependiendo del área y local.

## **4\. Flujo de Aprobación de Permisos y Vacaciones**

> * **Derecho a Días Libres:** El sistema garantiza 2 días libres por semana (asignables exclusivamente de Lunes a Jueves).  
> * **Condición de Vacaciones:** Durante la semana en la que un trabajador toma sus vacaciones, **pierde el derecho a sus 2 días libres regulares**. El sistema no debe sumar estos días al saldo de vacaciones.  
> * **Políticas de Antelación:** Toda solicitud regular de día libre requiere un mínimo de **10 días de anticipación** en el sistema.  
> * **Gestión de Excepciones:** Los Administradores pueden eludir la regla de los 10 días únicamente categorizando la falta como "Emergencia médica" o "Fuerza mayor".  
> * **Permisos por Votación:** Se requiere un tipo de permiso fraccionado (por horas) que no descuente un día libre completo y permita turnos rotativos el día de elecciones.  
> * **Resolución de Conflictos:** Si múltiples empleados solicitan el mismo día libre y se afecta la cuota mínima de operación, el sistema priorizará la aprobación basándose estrictamente en el **orden de llegada de la solicitud**.

## **5\. Módulo de Desgaste Laboral**

El sistema contará con un panel analítico para mitigar el agotamiento del personal, rastreando los siguientes indicadores de negocio:

> * **Días Consecutivos:** Alertas automáticas cuando un trabajador supera un umbral de días trabajados sin descanso.  
> * **Desempeño Operativo:** Registro de anotaciones sobre la disminución en el desempeño o errores frecuentes (ingresados por los gestores) vinculados al expediente del trabajador.