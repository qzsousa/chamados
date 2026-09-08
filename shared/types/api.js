"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthResponseSchema = exports.ErrorCodes = exports.ErrorResponseSchema = exports.DashboardFiltradoResponseSchema = exports.DashboardMatrizResponseSchema = exports.DashboardKPIsSchema = exports.InventarioUpdateSchema = exports.InventarioSchema = exports.EquipamentoCreateSchema = exports.EquipamentoSchema = exports.EscolaCreateSchema = exports.EscolaSchema = exports.PaginatedResponseSchema = exports.BatchDeleteChamadosSchema = exports.BatchUpdateChamadosSchema = exports.FiltrosChamadoSchema = exports.ResponderChamadoSchema = exports.AtualizarStatusChamadoSchema = exports.CriarChamadoSchema = exports.ChamadoSchema = exports.RefreshRequestSchema = exports.GerarSenhaTemporariaResponseSchema = exports.GerarSenhaTemporariaSchema = exports.ChangePasswordSchema = exports.LoginResponseSchema = exports.LoginRequestSchema = exports.UserWithTempPasswordSchema = exports.UserUpdateSchema = exports.UserCreateSchema = exports.UserSchema = exports.InventarioStatusSchema = exports.StatusChamadoSchema = exports.StatusUsuarioSchema = exports.NivelSchema = void 0;
const zod_1 = require("zod");
// ============================================
// ENUMS
// ============================================
exports.NivelSchema = zod_1.z.enum(['ADMIN', 'TECNICO', 'GESTOR', 'VISUALIZADOR']);
exports.StatusUsuarioSchema = zod_1.z.enum(['ATIVO', 'INATIVO']);
exports.StatusChamadoSchema = zod_1.z.enum(['ABERTO', 'ANDAMENTO', 'COMUNICADO', 'RESOLVIDO']);
exports.InventarioStatusSchema = zod_1.z.enum(['CONCLUIDO', 'EM_ANDAMENTO', 'NAO_REALIZADO', 'NAO_INFORMADO']);
// ============================================
// USER
// ============================================
exports.UserSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    email: zod_1.z.string().email(),
    nome: zod_1.z.string(),
    nivel: exports.NivelSchema,
    filial: zod_1.z.string(),
    status: exports.StatusUsuarioSchema,
    primeiroLogin: zod_1.z.boolean(),
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime()
});
exports.UserCreateSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    nome: zod_1.z.string().min(1),
    nivel: exports.NivelSchema,
    filial: zod_1.z.string().min(1)
});
exports.UserUpdateSchema = zod_1.z.object({
    nome: zod_1.z.string().min(1).optional(),
    nivel: exports.NivelSchema.optional(),
    filial: zod_1.z.string().min(1).optional(),
    status: exports.StatusUsuarioSchema.optional()
});
exports.UserWithTempPasswordSchema = exports.UserSchema.extend({
    senhaTemporaria: zod_1.z.string()
});
// ============================================
// AUTH
// ============================================
exports.LoginRequestSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    senha: zod_1.z.string().min(1)
});
exports.LoginResponseSchema = zod_1.z.object({
    accessToken: zod_1.z.string(),
    refreshToken: zod_1.z.string(),
    user: exports.UserSchema,
    primeiroLogin: zod_1.z.boolean()
});
exports.ChangePasswordSchema = zod_1.z.object({
    senhaAtual: zod_1.z.string().min(1),
    novaSenha: zod_1.z.string().min(8).max(128)
});
exports.GerarSenhaTemporariaSchema = zod_1.z.object({
    email: zod_1.z.string().email()
});
exports.GerarSenhaTemporariaResponseSchema = zod_1.z.object({
    senhaTemporaria: zod_1.z.string()
});
exports.RefreshRequestSchema = zod_1.z.object({
    refreshToken: zod_1.z.string().optional()
});
// ============================================
// CHAMADO
// ============================================
exports.ChamadoSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    protocolo: zod_1.z.string(),
    timestamp: zod_1.z.string().datetime(),
    unidade: zod_1.z.string(),
    solicitante: zod_1.z.string(),
    funcao: zod_1.z.string().nullable(),
    tipo: zod_1.z.string(),
    descricao: zod_1.z.string(),
    urgencia: zod_1.z.string(),
    anexoUrl: zod_1.z.string().nullable(),
    status: exports.StatusChamadoSchema,
    responsavel: zod_1.z.string().nullable(),
    ultimaAtualizacao: zod_1.z.string().datetime(),
    historico: zod_1.z.string().nullable(),
    tecnicoResolucao: zod_1.z.string().nullable(),
    tecnicoSetor: zod_1.z.string().nullable(),
    inventarioStatus: exports.InventarioStatusSchema.nullable()
});
exports.CriarChamadoSchema = zod_1.z.object({
    unidade: zod_1.z.string().min(1),
    solicitante: zod_1.z.string().min(1),
    funcao: zod_1.z.string().optional(),
    tipo: zod_1.z.string().min(1),
    descricao: zod_1.z.string().min(1),
    urgencia: zod_1.z.string().min(1),
    anexoBase64: zod_1.z.string().optional(),
    anexoNome: zod_1.z.string().optional(),
    anexoTipo: zod_1.z.string().optional()
});
exports.AtualizarStatusChamadoSchema = zod_1.z.object({
    status: exports.StatusChamadoSchema,
    tecnicoResolucao: zod_1.z.string().optional()
});
exports.ResponderChamadoSchema = zod_1.z.object({
    texto: zod_1.z.string().min(1)
});
exports.FiltrosChamadoSchema = zod_1.z.object({
    unidade: zod_1.z.string().optional(),
    categoria: zod_1.z.string().optional(),
    status: exports.StatusChamadoSchema.optional(),
    urgencia: zod_1.z.string().optional(),
    tecnico: zod_1.z.string().optional(),
    inventario: exports.InventarioStatusSchema.optional(),
    dataDe: zod_1.z.string().date().optional(),
    dataAte: zod_1.z.string().date().optional(),
    page: zod_1.z.number().int().positive().default(1),
    limit: zod_1.z.number().int().positive().max(100).default(20)
});
exports.BatchUpdateChamadosSchema = zod_1.z.object({
    ids: zod_1.z.array(zod_1.z.string().cuid()).min(1),
    status: exports.StatusChamadoSchema.optional(),
    tecnicoResolucao: zod_1.z.string().optional(),
    resposta: zod_1.z.string().optional()
});
exports.BatchDeleteChamadosSchema = zod_1.z.object({
    ids: zod_1.z.array(zod_1.z.string().cuid()).min(1)
});
// ============================================
// PAGINATION
// ============================================
const PaginatedResponseSchema = (itemSchema) => zod_1.z.object({
    data: zod_1.z.array(itemSchema),
    meta: zod_1.z.object({
        total: zod_1.z.number(),
        page: zod_1.z.number(),
        limit: zod_1.z.number(),
        totalPages: zod_1.z.number()
    })
});
exports.PaginatedResponseSchema = PaginatedResponseSchema;
// ============================================
// ESCOLA
// ============================================
exports.EscolaSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    nome: zod_1.z.string(),
    nomeNormalizado: zod_1.z.string(),
    tecnico: zod_1.z.string(),
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime()
});
exports.EscolaCreateSchema = zod_1.z.object({
    nome: zod_1.z.string().min(1),
    tecnico: zod_1.z.string().min(1)
});
// ============================================
// EQUIPAMENTO
// ============================================
exports.EquipamentoSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    categoria: zod_1.z.string(),
    marca: zod_1.z.string(),
    modelo: zod_1.z.string(),
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime()
});
exports.EquipamentoCreateSchema = zod_1.z.object({
    categoria: zod_1.z.string().min(1),
    marca: zod_1.z.string().min(1),
    modelo: zod_1.z.string().min(1)
});
// ============================================
// INVENTARIO
// ============================================
exports.InventarioSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
    escolaId: zod_1.z.string().cuid(),
    escola: exports.EscolaSchema,
    status: exports.InventarioStatusSchema,
    updatedAt: zod_1.z.string().datetime()
});
exports.InventarioUpdateSchema = zod_1.z.object({
    status: exports.InventarioStatusSchema
});
// ============================================
// DASHBOARD
// ============================================
exports.DashboardKPIsSchema = zod_1.z.object({
    total: zod_1.z.number(),
    abertos: zod_1.z.number(),
    andamento: zod_1.z.number(),
    comunicado: zod_1.z.number(),
    resolvidos: zod_1.z.number(),
    altaPrioridade: zod_1.z.number()
});
exports.DashboardMatrizResponseSchema = zod_1.z.object({
    kpis: exports.DashboardKPIsSchema,
    chamados: zod_1.z.array(exports.ChamadoSchema),
    graficos: zod_1.z.object({
        porStatus: zod_1.z.record(zod_1.z.number()),
        porUrgencia: zod_1.z.record(zod_1.z.number()),
        resolvidosPorTecnico: zod_1.z.record(zod_1.z.number())
    })
});
exports.DashboardFiltradoResponseSchema = zod_1.z.object({
    kpis: exports.DashboardKPIsSchema,
    chamados: zod_1.z.array(exports.ChamadoSchema),
    avisos: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string(),
        tipo: zod_1.z.string(),
        anterior: zod_1.z.string(),
        atual: zod_1.z.string(),
        responsavel: zod_1.z.string(),
        quando: zod_1.z.string().datetime()
    })),
    inventario: zod_1.z.object({
        unidade: zod_1.z.string(),
        tecnicoSetor: zod_1.z.string(),
        status: exports.InventarioStatusSchema
    })
});
// ============================================
// ERROR
// ============================================
exports.ErrorResponseSchema = zod_1.z.object({
    error: zod_1.z.string(),
    message: zod_1.z.string(),
    details: zod_1.z.array(zod_1.z.object({
        field: zod_1.z.string(),
        message: zod_1.z.string()
    })).optional()
});
exports.ErrorCodes = {
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    NOT_FOUND: 'NOT_FOUND',
    RATE_LIMITED: 'RATE_LIMITED',
    INTERNAL_ERROR: 'INTERNAL_ERROR'
};
// ============================================
// HEALTH
// ============================================
exports.HealthResponseSchema = zod_1.z.object({
    status: zod_1.z.enum(['ok', 'degraded', 'down']),
    timestamp: zod_1.z.string().datetime(),
    uptime: zod_1.z.number(),
    database: zod_1.z.enum(['connected', 'disconnected']),
    version: zod_1.z.string()
});
//# sourceMappingURL=api.js.map