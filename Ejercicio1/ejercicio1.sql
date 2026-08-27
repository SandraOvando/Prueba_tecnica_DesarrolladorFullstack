-- Ejercicio 1: diseño de base de datos y consultas en PostgreSQL.
-- Assert Consulting gestiona cobranza para instituciones financieras.

BEGIN;

CREATE TABLE clientes (
    cliente_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    correo VARCHAR(254),
    telefono VARCHAR(20),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_clientes_correo UNIQUE (correo)
);

CREATE TABLE conceptos_pago (
    concepto_pago_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    clave_sat CHAR(8) NOT NULL,
    descripcion VARCHAR(150) NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_conceptos_pago_clave_sat UNIQUE (clave_sat),
    CONSTRAINT ck_conceptos_pago_clave_sat
        CHECK (clave_sat ~ '^[0-9]{8}$')
);

COMMENT ON COLUMN conceptos_pago.clave_sat IS
    'Clave de ocho dígitos requerida para identificar el concepto conforme al catálogo del SAT.';

CREATE TABLE cuentas (
    cuenta_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cliente_id BIGINT NOT NULL,
    saldo NUMERIC(15, 2) NOT NULL DEFAULT 0,
    fecha_limite DATE NOT NULL,
    estado VARCHAR(15) NOT NULL DEFAULT 'vigente',
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_cuentas_cliente
        FOREIGN KEY (cliente_id) REFERENCES clientes (cliente_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    -- Esta llave candidata permite que transacciones compruebe que la cuenta
    -- realmente pertenece al cliente recibido.
    CONSTRAINT uq_cuentas_cuenta_cliente UNIQUE (cuenta_id, cliente_id),
    CONSTRAINT ck_cuentas_saldo CHECK (saldo >= 0),
    CONSTRAINT ck_cuentas_estado
        CHECK (estado IN ('vigente', 'vencida', 'quebranto', 'liquidada'))
);

CREATE TABLE transacciones (
    transaccion_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cliente_id BIGINT NOT NULL,
    cuenta_id BIGINT NOT NULL,
    concepto_pago_id BIGINT NOT NULL,
    monto NUMERIC(15, 2) NOT NULL,
    fecha_transaccion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    referencia VARCHAR(100),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_transacciones_cuenta_cliente
        FOREIGN KEY (cuenta_id, cliente_id)
        REFERENCES cuentas (cuenta_id, cliente_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_transacciones_concepto
        FOREIGN KEY (concepto_pago_id)
        REFERENCES conceptos_pago (concepto_pago_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    -- Se permiten montos negativos porque representan notas de crédito,
    -- pero una transacción de importe cero no aporta un movimiento real.
    CONSTRAINT ck_transacciones_monto_no_cero CHECK (monto <> 0)
);

-- Índice 1: comienza por fecha_limite para localizar cuentas vencidas y
-- después por saldo para filtrar las que todavía tienen deuda. Es parcial
-- porque las cuentas en quebranto nunca deben formar parte de la consulta a).
CREATE INDEX idx_cta_venc_saldo
    ON cuentas (fecha_limite, saldo)
    INCLUDE (cliente_id)
    WHERE estado <> 'quebranto' AND saldo > 0;

-- Índice 2: permite recorrer únicamente las transacciones recientes para el
-- cálculo del top de clientes, evitando revisar todo el histórico.
CREATE INDEX idx_transacciones_fecha_cliente
    ON transacciones (fecha_transaccion DESC, cliente_id)
    INCLUDE (monto);

-- Índice 3: sigue el mismo orden de comparación de la consulta de duplicados:
-- cliente, monto y tiempo. Así reduce las filas candidatas del auto-join.
CREATE INDEX idx_transacciones_posibles_duplicados
    ON transacciones (cliente_id, monto, fecha_transaccion);

COMMIT;

-- CONSULTA A: cuentas vencidas con saldo pendiente.
-- La resta entre CURRENT_DATE y una fecha DATE devuelve días completos.
SELECT
    c.nombre,
    ct.saldo AS saldo_pendiente,
    (CURRENT_DATE - ct.fecha_limite) AS dias_atraso
FROM cuentas AS ct
INNER JOIN clientes AS c
    ON c.cliente_id = ct.cliente_id
WHERE ct.saldo > 0
  AND ct.fecha_limite < CURRENT_DATE
  AND ct.estado <> 'quebranto'
ORDER BY dias_atraso DESC, c.nombre ASC;

-- CONSULTA B: top 5 por volumen transaccionado en los últimos 30 días.
-- Se usa ABS para que las notas de crédito negativas aporten al volumen real
-- de movimientos en lugar de cancelar matemáticamente a los cargos.
SELECT
    c.cliente_id,
    c.nombre,
    SUM(ABS(t.monto)) AS volumen_transaccionado
FROM clientes AS c
INNER JOIN transacciones AS t
    ON t.cliente_id = c.cliente_id
WHERE t.fecha_transaccion >= CURRENT_TIMESTAMP - INTERVAL '30 days'
GROUP BY c.cliente_id, c.nombre
ORDER BY volumen_transaccionado DESC, c.cliente_id ASC
LIMIT 5;

-- CONSULTA C: posibles duplicados del mismo cliente y monto ocurridos con una
-- diferencia estrictamente menor a cinco minutos. La condición t1.id < t2.id
-- evita comparar una fila consigo misma y evita mostrar cada pareja dos veces.
SELECT
    t1.cliente_id,
    t1.transaccion_id AS transaccion_1_id,
    t2.transaccion_id AS posible_duplicado_id,
    t1.monto,
    t1.fecha_transaccion AS fecha_transaccion_1,
    t2.fecha_transaccion AS fecha_transaccion_2,
    CASE
        WHEN t2.fecha_transaccion >= t1.fecha_transaccion
            THEN t2.fecha_transaccion - t1.fecha_transaccion
        ELSE t1.fecha_transaccion - t2.fecha_transaccion
    END AS diferencia
FROM transacciones AS t1
INNER JOIN transacciones AS t2
   ON t2.cliente_id = t1.cliente_id
   AND t2.monto = t1.monto
   AND t2.transaccion_id > t1.transaccion_id
   AND t2.fecha_transaccion > t1.fecha_transaccion - INTERVAL '5 minutes'
   AND t2.fecha_transaccion < t1.fecha_transaccion + INTERVAL '5 minutes'
ORDER BY t1.cliente_id, t1.fecha_transaccion, t2.fecha_transaccion;
