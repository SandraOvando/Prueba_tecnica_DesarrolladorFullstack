# Notas de desarrollo

## Dudas que surgieron

1. En el Ejercicio 1, "volumen transaccionado" podía interpretarse como la suma neta de los movimientos o como la suma de sus valores absolutos. Debido a que el enunciado aclara que existen notas de crédito negativas, consideré que el volumen debe medir todo el dinero movilizado, sin que un cargo y una nota de crédito se cancelen entre sí.

2. En el Ejercicio 3 se solicita cancelar peticiones con `AbortController`, pero también se indica que no debe modificarse la firma `mockFetch(page, estado)`. Como la función no recibe un `signal`, utilicé una promesa de cancelación para detener el flujo del efecto e impedir que una respuesta anterior sobrescriba el estado actual.

## Supuestos considerados

- Se utiliza una versión actual de PostgreSQL compatible con columnas `IDENTITY`, índices parciales y columnas incluidas mediante `INCLUDE`.
- Una cuenta pertenece a un solo cliente. Por ello, la llave foránea compuesta de `transacciones` valida conjuntamente `cuenta_id` y `cliente_id`.
- Los montos negativos representan notas de crédito válidas, mientras que un movimiento de monto cero no representa una transacción financiera útil.
- `mockFetch` devuelve como máximo diez registros por página, junto con `total` y `pages`, según el contrato proporcionado.
- El componente React se integrará en un proyecto donde `mockFetch` ya existe en el alcance indicado por la prueba.
- La solución de autenticación está pensada para un cliente web que se comunica siempre mediante HTTPS.

## Alternativas descartadas

### Sumar directamente los montos de las transacciones

Descarté utilizar `SUM(monto)` para calcular el top de clientes, porque una nota de crédito negativa podría cancelar un cargo positivo y ocultar el volumen real de movimientos. Elegí `SUM(ABS(monto))` para considerar tanto cargos como notas de crédito.

### Reutilizar el token del usuario entre todos los microservicios

Descarté enviar el mismo token público a cada servicio interno porque aumenta su exposición y puede otorgar permisos o audiencias innecesarias. Elegí identidades de servicio y tokens internos de corta duración; cuando se necesita contexto del usuario, propuse intercambio de tokens con permisos limitados.
