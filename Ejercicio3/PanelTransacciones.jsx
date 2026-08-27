import { useEffect, useReducer } from 'react';

const LIMITE_PAGINA = 10;

// Todo el estado principal solicitado se concentra en un solo objeto. Esto
// permite que sus cambios sean predecibles y se controlen desde el reducer.
const estadoInicial = {
  lista: [],
  pagina: 1,
  filtro: 'todas',
  paginas: 1,
  total: 0,
  loading: false,
  error: null,
};

// El reducer recibe el estado actual y una acción. Cada caso devuelve un objeto
// nuevo para respetar la inmutabilidad que React necesita para detectar cambios.
function reducer(state, action) {
  switch (action.type) {
    case 'CARGA_INICIADA':
      return { ...state, loading: true, error: null };
    case 'CARGA_EXITOSA':
      return {
        ...state,
        lista: action.payload.data,
        total: action.payload.total,
        paginas: Math.max(action.payload.pages, 1),
        loading: false,
        error: null,
      };
    case 'CARGA_FALLIDA':
      return { ...state, lista: [], loading: false, error: action.payload };
    case 'CAMBIAR_FILTRO':
      // Al cambiar el filtro se regresa a la primera página para no solicitar
      // una página que podría no existir en el nuevo conjunto de resultados.
      return { ...state, filtro: action.payload, pagina: 1 };
    case 'CAMBIAR_PAGINA':
      return { ...state, pagina: action.payload };
    default:
      return state;
  }
}

// Cada valor se encierra entre comillas y las comillas internas se duplican.
// De esta forma nombres con comas o comillas no rompen las columnas del CSV.
function escaparCSV(valor) {
  const texto = String(valor ?? '');
  return `"${texto.replaceAll('"', '""')}"`;
}

export default function PanelTransacciones() {
  const [state, dispatch] = useReducer(reducer, estadoInicial);

  // El efecto se ejecuta al montar el componente y cada vez que cambia la
  // página o el filtro, que son los parámetros recibidos por mockFetch.
  useEffect(() => {
    const controller = new AbortController();

    async function cargarTransacciones() {
      dispatch({ type: 'CARGA_INICIADA' });

      try {
        // mockFetch no recibe signal y su firma no puede modificarse. La promesa
        // de aborto cancela este flujo y evita que una respuesta anterior cambie
        // el estado después de seleccionar otra página o filtro.
        const peticionAbortada = new Promise((_, reject) => {
          controller.signal.addEventListener(
            'abort',
            () => reject(new DOMException('Petición cancelada', 'AbortError')),
            { once: true },
          );
        });

        const respuesta = await Promise.race([
          mockFetch(state.pagina, state.filtro),
          peticionAbortada,
        ]);

        if (!controller.signal.aborted) {
          dispatch({ type: 'CARGA_EXITOSA', payload: respuesta });
        }
      } catch (error) {
        if (error?.name !== 'AbortError') {
          dispatch({
            type: 'CARGA_FALLIDA',
            payload: 'No fue posible obtener las transacciones. Intenta nuevamente.',
          });
        }
      }
    }

    cargarTransacciones();

    // React ejecuta esta limpieza antes de iniciar el siguiente efecto o al
    // desmontar el componente. Así se cancela el flujo pendiente anterior.
    return () => controller.abort();
  }, [state.pagina, state.filtro]);

  // La API entrega una página; el límite también protege la tabla y el CSV si
  // el mock devuelve accidentalmente más registros de los acordados.
  const registrosVisibles = state.lista.slice(0, LIMITE_PAGINA);

  // La exportación utiliza exactamente los registros visibles de la página,
  // no todo el resultado que pudiera existir en el servidor.
  function exportarCSV() {
    if (registrosVisibles.length === 0) return;

    const encabezados = ['ID', 'Cliente', 'Monto', 'Estado', 'Fecha'];
    const filas = registrosVisibles.map((transaccion) => [
      transaccion.id,
      transaccion.cliente,
      transaccion.monto,
      transaccion.estado,
      transaccion.fecha,
    ]);

    const contenido = [encabezados, ...filas]
      .map((fila) => fila.map(escaparCSV).join(','))
      .join('\n');

    // El BOM permite que Excel reconozca correctamente caracteres con acentos.
    const archivo = new Blob([`\uFEFF${contenido}`], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(archivo);
    const enlace = document.createElement('a');

    // Se crea un enlace temporal para iniciar la descarga sin librerías. Luego
    // se elimina el elemento y se libera la URL para evitar fugas de memoria.
    enlace.href = url;
    enlace.download = 'transacciones_assert.csv';
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    URL.revokeObjectURL(url);
  }

  const filtros = ['todas', 'pendiente', 'aprobado', 'rechazado'];

  return (
    <section aria-labelledby="titulo-panel">
      <header>
        <h1 id="titulo-panel">Panel de transacciones</h1>
        <button
          type="button"
          onClick={exportarCSV}
          disabled={state.loading || registrosVisibles.length === 0}
        >
          Exportar CSV
        </button>
      </header>

      <nav aria-label="Filtrar transacciones por estado">
        {/* Los botones se crean desde un arreglo para evitar repetir marcado. */}
        {filtros.map((filtro) => (
          <button
            key={filtro}
            type="button"
            onClick={() => dispatch({ type: 'CAMBIAR_FILTRO', payload: filtro })}
            aria-pressed={state.filtro === filtro}
            disabled={state.loading && state.filtro === filtro}
          >
            {filtro.charAt(0).toUpperCase() + filtro.slice(1)}
          </button>
        ))}
      </nav>

      {state.loading && <p role="status">Cargando transacciones...</p>}
      {state.error && <p role="alert">{state.error}</p>}

      {/* La tabla solo se muestra cuando la carga terminó sin errores. */}
      {!state.loading && !state.error && (
        <>
          <p>
            {state.total} transacciones encontradas. Página {state.pagina} de{' '}
            {state.paginas}.
          </p>

          <table>
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Cliente</th>
                <th scope="col">Monto</th>
                <th scope="col">Estado</th>
                <th scope="col">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {registrosVisibles.length === 0 ? (
                <tr>
                  <td colSpan="5">No hay transacciones para mostrar.</td>
                </tr>
              ) : (
                registrosVisibles.map((transaccion) => (
                  <tr key={transaccion.id}>
                    <td>{transaccion.id}</td>
                    <td>{transaccion.cliente}</td>
                    <td>
                      {Number(transaccion.monto).toLocaleString('es-MX', {
                        style: 'currency',
                        currency: 'MXN',
                      })}
                    </td>
                    <td>{transaccion.estado}</td>
                    <td>{transaccion.fecha}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <footer aria-label="Paginación">
            {/* Los límites impiden solicitar páginas anteriores a 1 o mayores
                al total informado por mockFetch. */}
            <button
              type="button"
              onClick={() =>
                dispatch({ type: 'CAMBIAR_PAGINA', payload: state.pagina - 1 })
              }
              disabled={state.pagina <= 1}
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() =>
                dispatch({ type: 'CAMBIAR_PAGINA', payload: state.pagina + 1 })
              }
              disabled={state.pagina >= state.paginas}
            >
              Siguiente
            </button>
          </footer>
        </>
      )}
    </section>
  );
}
