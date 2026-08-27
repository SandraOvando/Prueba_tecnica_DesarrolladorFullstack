# Reflexión técnica

## [R1] Bug encontrado en producción

En INOLAB trabajé con un ERP que generaba los folios de las visitas técnicas a partir de información obtenida de SAP. El problema se detectó cuando algunos folios comenzaron a duplicarse, ocasionando que una misma visita fuera asignada dos veces. Al revisar el flujo, identificamos que la duplicidad se originaba desde la base de datos de SAP y que uno de los registros duplicados tenía un dato faltante.

Para resolverlo, se crearon consultas SQL que comparaban los registros y permitían descartar el duplicado mediante la validación del campo faltante. Adicionalmente, se implementó un contador que bloqueaba temporalmente el folio que estaba siendo asignado y generaba una alerta cuando se detectaba un posible segundo intento. Con estas validaciones se evitó la doble asignación y se mejoró el control sobre la generación de folios.

## [R2] Integración de un nuevo método de pago

Integraría el nuevo método de pago como un módulo independiente, mediante una clase o servicio que contenga sus validaciones y flujo particular. Posteriormente, lo conectaría con la interfaz principal para que sea llamado únicamente cuando el usuario seleccione ese método. Esto permitiría agregar la nueva funcionalidad sin modificar directamente los procesos que ya se encuentran operando.

## [R3] Seguridad de una API financiera

Al diseñar una API que procesa transacciones financieras, protegería la información mediante conexiones HTTPS y exigiría autenticación para cada solicitud. También validaría los permisos del usuario, los tipos de datos, los montos permitidos y los campos obligatorios antes de ejecutar cualquier operación. Las consultas a la base de datos utilizarían parámetros para evitar inyecciones SQL y no se guardarían contraseñas, tokens ni datos financieros sensibles en los registros de errores.

Mantendría una bitácora con la fecha, el usuario, la operación y su resultado, cuidando que no exponga información confidencial.

## [R4] Experiencia con sistemas ERP

En las empresas donde he trabajado se utilizaron sistemas ERP. La experiencia más compleja fue en INOLAB, donde participé en la integración de varios sistemas que anteriormente funcionaban de forma independiente. El objetivo era contar con un solo inicio de sesión y asegurar que la creación y modificación de documentos se realizara correctamente.

Uno de los principales retos era que la información se encontraba distribuida en diferentes servidores y conexiones. Fue necesario modificar las conexiones para que los registros llegaran a una base de datos única y verificar que durante el proceso no se perdieran ni duplicaran datos. Después de los cambios, se realizaron pruebas funcionales sobre los distintos procesos y documentos para confirmar que la integración operara correctamente.

## [R5] Diagnóstico de una transacción duplicada

Primero solicitaría los datos de la transacción, como el identificador, monto, usuario, fecha y hora, para localizar todos los registros relacionados. Después revisaría la base de datos para confirmar si existen dos transacciones completas o si solamente se duplicó su visualización. También consultaría las bitácoras del sistema para identificar en qué momento de la ejecución se originó el segundo procesamiento.

Posteriormente, reproduciría el flujo en un ambiente de pruebas y revisaría si la duplicidad fue causada por una inconsistencia del sistema, un reintento automático o una acción repetida del usuario final. Antes de eliminar o modificar información, confirmaría cuál transacción es válida y conservaría evidencia del análisis. Finalmente, corregiría la causa raíz e implementaría una validación mediante un identificador único para evitar que la misma operación vuelva a procesarse.

## [R6] Decisión técnica que actualmente considero un error

En un sistema realicé modificaciones al proceso que contabilizaba los reportes y ayudaba a decidir a quién se le debían asignar más casos. De acuerdo con mi conocimiento del funcionamiento interno, el flujo parecía correcto y las validaciones técnicas iniciales no mostraron problemas. Sin embargo, no consideré todas las formas en que los usuarios finales utilizaban el sistema.

Como consecuencia, algunas asignaciones no se generaron correctamente y aparecieron varios errores cuando el cambio llegó a producción. Esto me hizo comprender que conocer el flujo técnico no es suficiente y que también se deben analizar los escenarios reales de uso. Después de corregir satisfactoriamente los errores, adopté la práctica de realizar pruebas con casos proporcionados por los usuarios antes de liberar una modificación.

## [R7] Herramienta o práctica que dejé de utilizar

Durante los últimos años dejé de utilizar GitHub de manera habitual. Esto no se debió a un problema con la herramienta, sino a que en mi trabajo más reciente se utilizaba Magic Xpa, que cuenta con su propio mecanismo de control de versiones mediante el servidor. Por esa razón, el equipo administraba los cambios desde las herramientas incluidas en ese entorno.
