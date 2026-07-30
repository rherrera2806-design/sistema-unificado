const { z } = require('zod');

const turnosSchema = z.object({
    nombre: z.string().min(1, 'Nombre requerido').max(100).transform(s => s.trim()),
    rut: z.string().max(20).optional().default(''),
    patente: z.string().max(10).optional().default('').transform(s => s.toUpperCase().replace(/[^A-Z0-9]/g, '')),
    motivo: z.enum(['Retirar', 'Despacho', 'Otro']).optional().default('Retirar'),
    rut_empresa: z.string().max(20).optional().default('')
});

const entregasSchema = z.object({
    turno_id: z.number().int().positive().nullable().optional(),
    cliente_nombre: z.string().min(1, 'Cliente requerido').max(100).transform(s => s.trim()),
    descripcion: z.string().max(500).optional().default(''),
    pedidos: z.string().max(500).optional().default(''),
    factura: z.string().max(50).optional().default(''),
    tipo: z.enum(['Retira', 'Despacho']).optional().default('Retira')
});

const pedidosSchema = z.object({
    numero_pedido: z.string().min(1, 'Numero de pedido requerido').max(50).transform(s => s.trim()),
    cliente: z.string().min(1, 'Cliente requerido').max(100).transform(s => s.trim()),
    vendedor: z.string().max(100).optional().default(''),
    archivo_url: z.string().url().optional().or(z.literal('')).default(''),
    pdf_base64: z.string().optional()
});

const produccionOrdenSchema = z.object({
    pedido_sap_id: z.string().max(30).optional(),
    cliente: z.string().max(100).optional(),
    codigo_producto: z.string().min(1, 'Codigo requerido').max(30).transform(s => s.trim()),
    descripcion: z.string().max(500).optional(),
    ancho: z.number().int().positive('Ancho debe ser positivo'),
    alto: z.number().int().positive('Alto debe ser positivo'),
    metros_cuadrados: z.number().positive().optional(),
    estado_programacion: z.enum(['PENDIENTE', 'EN PRODUCCION', 'COMPLETADA', 'CANCELADA']).optional().default('PENDIENTE')
});

const movimientosSchema = z.object({
    tipo_movimiento: z.enum(['entrada', 'salida']),
    tipo_cristal: z.string().min(1, 'Tipo de cristal requerido').max(50),
    espesor: z.number().int().positive(),
    ancho: z.number().int().positive(),
    alto: z.number().int().positive(),
    cantidad_planchas: z.number().int().positive(),
    metros_cuadrados: z.number().positive(),
    proveedor: z.string().max(100).optional(),
    tipo_salida: z.string().max(20).optional(),
    observaciones: z.string().max(500).optional()
});

const instalacionesSchema = z.object({
    cliente: z.string().min(1, 'Cliente requerido').max(100).transform(s => s.trim()),
    direccion: z.string().min(1, 'Direccion requerida').max(200).transform(s => s.trim()),
    fecha: z.string().optional(),
    tecnico: z.string().max(100).optional().default(''),
    estado: z.enum(['pendiente', 'en proceso', 'completada', 'cancelada']).optional().default('pendiente'),
    observaciones: z.string().max(1000).optional().default('')
});

const usuariosSchema = z.object({
    nombre: z.string().min(1, 'Nombre requerido').max(100).transform(s => s.trim()),
    email: z.string().email('Email invalido').max(255).transform(s => s.toLowerCase().trim()),
    password: z.string().min(6, 'Password minimo 6 caracteres').max(255),
    rol: z.enum(['admin', 'supervisor', 'usuario']).optional().default('usuario'),
    permisos: z.array(z.string()).optional().default([])
});

const validate = (schema) => (req, res, next) => {
    try {
        req.body = schema.parse(req.body);
        next();
    } catch (e) {
        if (e instanceof z.ZodError) {
            return res.status(400).json({
                error: 'Datos invalidos',
                details: e.errors.map(err => ({
                    field: err.path.join('.'),
                    message: err.message
                }))
            });
        }
        next(e);
    }
};

module.exports = {
    validate,
    turnosSchema,
    entregasSchema,
    pedidosSchema,
    produccionOrdenSchema,
    movimientosSchema,
    instalacionesSchema,
    usuariosSchema
};
