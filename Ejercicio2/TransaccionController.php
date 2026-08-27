<?php

namespace App\Http\Controllers;

use App\Models\Cliente;
use App\Models\Transaccion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TransaccionController extends Controller
{
    // Problema 1: al método le faltaba la llave de apertura. Esto produce un
    // error de sintaxis y evita que Laravel pueda cargar el controlador.
    public function index(Request $request): JsonResponse
    {
        // Problema 2: el identificador se concatenaba directamente en el SQL,
        // permitiendo inyección SQL. Primero se valida y después se usa binding.
        $datosValidados = $request->validate([
            'cliente_id' => ['required', 'integer', 'min:1', 'exists:clientes,cliente_id'],
        ]);

        // El nombre de esta variable forma parte del requisito RF-21.
        $idClienteSeguro = $datosValidados['cliente_id'];

        $rows = DB::select(
            'SELECT * FROM transacciones WHERE cliente_id = ?',
            [$idClienteSeguro]
        );

        return response()->json(['resultado' => $rows]);
    }

    public function store(Request $request): JsonResponse
    {
        // Problema 3: store no validaba los datos recibidos. En una API
        // financiera esto permite referencias inexistentes, montos en cero o
        // formatos inválidos antes de llegar a las reglas de la base de datos.
        $datosValidados = $request->validate([
            'cliente_id' => ['required', 'integer', 'exists:clientes,cliente_id'],
            'cuenta_id' => ['required', 'integer', 'exists:cuentas,cuenta_id'],
            'concepto_pago_id' => [
                'required',
                'integer',
                'exists:conceptos_pago,concepto_pago_id',
            ],
            // Se aceptan negativos por las notas de crédito, pero no monto cero.
            'monto' => ['required', 'numeric', 'not_in:0'],
            'fecha_transaccion' => ['sometimes', 'date'],
            'referencia' => ['nullable', 'string', 'max:100'],
        ]);

        // Problema 4: request()->all() permitía asignación masiva de campos no
        // autorizados. Solo se envían al modelo los valores que fueron validados.
        $transaccion = Transaccion::create($datosValidados);

        return response()->json($transaccion, 201);
    }

    public function resumenClientes(): JsonResponse
    {
        // Problema 5: cargar transacciones dentro del foreach generaba una
        // consulta adicional por cliente (N+1). Eager loading lo resuelve en
        // un número constante de consultas.
        $clientes = Cliente::with('transacciones')->get();

        return response()->json($clientes);
    }
}
