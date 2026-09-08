import { z } from 'zod';
export declare const NivelSchema: z.ZodEnum<["ADMIN", "TECNICO", "GESTOR", "VISUALIZADOR"]>;
export declare const StatusUsuarioSchema: z.ZodEnum<["ATIVO", "INATIVO"]>;
export declare const StatusChamadoSchema: z.ZodEnum<["ABERTO", "ANDAMENTO", "COMUNICADO", "RESOLVIDO"]>;
export declare const InventarioStatusSchema: z.ZodEnum<["CONCLUIDO", "EM_ANDAMENTO", "NAO_REALIZADO", "NAO_INFORMADO"]>;
export type Nivel = z.infer<typeof NivelSchema>;
export type StatusUsuario = z.infer<typeof StatusUsuarioSchema>;
export type StatusChamado = z.infer<typeof StatusChamadoSchema>;
export type InventarioStatus = z.infer<typeof InventarioStatusSchema>;
export declare const UserSchema: z.ZodObject<{
    id: z.ZodString;
    email: z.ZodString;
    nome: z.ZodString;
    nivel: z.ZodEnum<["ADMIN", "TECNICO", "GESTOR", "VISUALIZADOR"]>;
    filial: z.ZodString;
    status: z.ZodEnum<["ATIVO", "INATIVO"]>;
    primeiroLogin: z.ZodBoolean;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "ATIVO" | "INATIVO";
    id: string;
    email: string;
    nome: string;
    nivel: "ADMIN" | "TECNICO" | "GESTOR" | "VISUALIZADOR";
    filial: string;
    primeiroLogin: boolean;
    createdAt: string;
    updatedAt: string;
}, {
    status: "ATIVO" | "INATIVO";
    id: string;
    email: string;
    nome: string;
    nivel: "ADMIN" | "TECNICO" | "GESTOR" | "VISUALIZADOR";
    filial: string;
    primeiroLogin: boolean;
    createdAt: string;
    updatedAt: string;
}>;
export type User = z.infer<typeof UserSchema>;
export declare const UserCreateSchema: z.ZodObject<{
    email: z.ZodString;
    nome: z.ZodString;
    nivel: z.ZodEnum<["ADMIN", "TECNICO", "GESTOR", "VISUALIZADOR"]>;
    filial: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    nome: string;
    nivel: "ADMIN" | "TECNICO" | "GESTOR" | "VISUALIZADOR";
    filial: string;
}, {
    email: string;
    nome: string;
    nivel: "ADMIN" | "TECNICO" | "GESTOR" | "VISUALIZADOR";
    filial: string;
}>;
export type UserCreate = z.infer<typeof UserCreateSchema>;
export declare const UserUpdateSchema: z.ZodObject<{
    nome: z.ZodOptional<z.ZodString>;
    nivel: z.ZodOptional<z.ZodEnum<["ADMIN", "TECNICO", "GESTOR", "VISUALIZADOR"]>>;
    filial: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["ATIVO", "INATIVO"]>>;
}, "strip", z.ZodTypeAny, {
    status?: "ATIVO" | "INATIVO" | undefined;
    nome?: string | undefined;
    nivel?: "ADMIN" | "TECNICO" | "GESTOR" | "VISUALIZADOR" | undefined;
    filial?: string | undefined;
}, {
    status?: "ATIVO" | "INATIVO" | undefined;
    nome?: string | undefined;
    nivel?: "ADMIN" | "TECNICO" | "GESTOR" | "VISUALIZADOR" | undefined;
    filial?: string | undefined;
}>;
export type UserUpdate = z.infer<typeof UserUpdateSchema>;
export declare const UserWithTempPasswordSchema: z.ZodObject<{
    id: z.ZodString;
    email: z.ZodString;
    nome: z.ZodString;
    nivel: z.ZodEnum<["ADMIN", "TECNICO", "GESTOR", "VISUALIZADOR"]>;
    filial: z.ZodString;
    status: z.ZodEnum<["ATIVO", "INATIVO"]>;
    primeiroLogin: z.ZodBoolean;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
} & {
    senhaTemporaria: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "ATIVO" | "INATIVO";
    id: string;
    email: string;
    nome: string;
    nivel: "ADMIN" | "TECNICO" | "GESTOR" | "VISUALIZADOR";
    filial: string;
    primeiroLogin: boolean;
    createdAt: string;
    updatedAt: string;
    senhaTemporaria: string;
}, {
    status: "ATIVO" | "INATIVO";
    id: string;
    email: string;
    nome: string;
    nivel: "ADMIN" | "TECNICO" | "GESTOR" | "VISUALIZADOR";
    filial: string;
    primeiroLogin: boolean;
    createdAt: string;
    updatedAt: string;
    senhaTemporaria: string;
}>;
export type UserWithTempPassword = z.infer<typeof UserWithTempPasswordSchema>;
export declare const LoginRequestSchema: z.ZodObject<{
    email: z.ZodString;
    senha: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    senha: string;
}, {
    email: string;
    senha: string;
}>;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export declare const LoginResponseSchema: z.ZodObject<{
    accessToken: z.ZodString;
    refreshToken: z.ZodString;
    user: z.ZodObject<{
        id: z.ZodString;
        email: z.ZodString;
        nome: z.ZodString;
        nivel: z.ZodEnum<["ADMIN", "TECNICO", "GESTOR", "VISUALIZADOR"]>;
        filial: z.ZodString;
        status: z.ZodEnum<["ATIVO", "INATIVO"]>;
        primeiroLogin: z.ZodBoolean;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "ATIVO" | "INATIVO";
        id: string;
        email: string;
        nome: string;
        nivel: "ADMIN" | "TECNICO" | "GESTOR" | "VISUALIZADOR";
        filial: string;
        primeiroLogin: boolean;
        createdAt: string;
        updatedAt: string;
    }, {
        status: "ATIVO" | "INATIVO";
        id: string;
        email: string;
        nome: string;
        nivel: "ADMIN" | "TECNICO" | "GESTOR" | "VISUALIZADOR";
        filial: string;
        primeiroLogin: boolean;
        createdAt: string;
        updatedAt: string;
    }>;
    primeiroLogin: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    refreshToken: string;
    primeiroLogin: boolean;
    accessToken: string;
    user: {
        status: "ATIVO" | "INATIVO";
        id: string;
        email: string;
        nome: string;
        nivel: "ADMIN" | "TECNICO" | "GESTOR" | "VISUALIZADOR";
        filial: string;
        primeiroLogin: boolean;
        createdAt: string;
        updatedAt: string;
    };
}, {
    refreshToken: string;
    primeiroLogin: boolean;
    accessToken: string;
    user: {
        status: "ATIVO" | "INATIVO";
        id: string;
        email: string;
        nome: string;
        nivel: "ADMIN" | "TECNICO" | "GESTOR" | "VISUALIZADOR";
        filial: string;
        primeiroLogin: boolean;
        createdAt: string;
        updatedAt: string;
    };
}>;
export type LoginResponse = z.infer<typeof LoginResponseSchema>;
export declare const ChangePasswordSchema: z.ZodObject<{
    senhaAtual: z.ZodString;
    novaSenha: z.ZodString;
}, "strip", z.ZodTypeAny, {
    senhaAtual: string;
    novaSenha: string;
}, {
    senhaAtual: string;
    novaSenha: string;
}>;
export type ChangePassword = z.infer<typeof ChangePasswordSchema>;
export declare const GerarSenhaTemporariaSchema: z.ZodObject<{
    email: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
}, {
    email: string;
}>;
export type GerarSenhaTemporaria = z.infer<typeof GerarSenhaTemporariaSchema>;
export declare const GerarSenhaTemporariaResponseSchema: z.ZodObject<{
    senhaTemporaria: z.ZodString;
}, "strip", z.ZodTypeAny, {
    senhaTemporaria: string;
}, {
    senhaTemporaria: string;
}>;
export type GerarSenhaTemporariaResponse = z.infer<typeof GerarSenhaTemporariaResponseSchema>;
export declare const RefreshRequestSchema: z.ZodObject<{
    refreshToken: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    refreshToken?: string | undefined;
}, {
    refreshToken?: string | undefined;
}>;
export type RefreshRequest = z.infer<typeof RefreshRequestSchema>;
export declare const ChamadoSchema: z.ZodObject<{
    id: z.ZodString;
    protocolo: z.ZodString;
    timestamp: z.ZodString;
    unidade: z.ZodString;
    solicitante: z.ZodString;
    funcao: z.ZodNullable<z.ZodString>;
    tipo: z.ZodString;
    descricao: z.ZodString;
    urgencia: z.ZodString;
    anexoUrl: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<["ABERTO", "ANDAMENTO", "COMUNICADO", "RESOLVIDO"]>;
    responsavel: z.ZodNullable<z.ZodString>;
    ultimaAtualizacao: z.ZodString;
    historico: z.ZodNullable<z.ZodString>;
    tecnicoResolucao: z.ZodNullable<z.ZodString>;
    tecnicoSetor: z.ZodNullable<z.ZodString>;
    inventarioStatus: z.ZodNullable<z.ZodEnum<["CONCLUIDO", "EM_ANDAMENTO", "NAO_REALIZADO", "NAO_INFORMADO"]>>;
}, "strip", z.ZodTypeAny, {
    status: "ABERTO" | "ANDAMENTO" | "COMUNICADO" | "RESOLVIDO";
    id: string;
    protocolo: string;
    timestamp: string;
    unidade: string;
    solicitante: string;
    funcao: string | null;
    tipo: string;
    descricao: string;
    urgencia: string;
    anexoUrl: string | null;
    responsavel: string | null;
    ultimaAtualizacao: string;
    historico: string | null;
    tecnicoResolucao: string | null;
    tecnicoSetor: string | null;
    inventarioStatus: "CONCLUIDO" | "EM_ANDAMENTO" | "NAO_REALIZADO" | "NAO_INFORMADO" | null;
}, {
    status: "ABERTO" | "ANDAMENTO" | "COMUNICADO" | "RESOLVIDO";
    id: string;
    protocolo: string;
    timestamp: string;
    unidade: string;
    solicitante: string;
    funcao: string | null;
    tipo: string;
    descricao: string;
    urgencia: string;
    anexoUrl: string | null;
    responsavel: string | null;
    ultimaAtualizacao: string;
    historico: string | null;
    tecnicoResolucao: string | null;
    tecnicoSetor: string | null;
    inventarioStatus: "CONCLUIDO" | "EM_ANDAMENTO" | "NAO_REALIZADO" | "NAO_INFORMADO" | null;
}>;
export type Chamado = z.infer<typeof ChamadoSchema>;
export declare const CriarChamadoSchema: z.ZodObject<{
    unidade: z.ZodString;
    solicitante: z.ZodString;
    funcao: z.ZodOptional<z.ZodString>;
    tipo: z.ZodString;
    descricao: z.ZodString;
    urgencia: z.ZodString;
    anexoBase64: z.ZodOptional<z.ZodString>;
    anexoNome: z.ZodOptional<z.ZodString>;
    anexoTipo: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    unidade: string;
    solicitante: string;
    tipo: string;
    descricao: string;
    urgencia: string;
    funcao?: string | undefined;
    anexoBase64?: string | undefined;
    anexoNome?: string | undefined;
    anexoTipo?: string | undefined;
}, {
    unidade: string;
    solicitante: string;
    tipo: string;
    descricao: string;
    urgencia: string;
    funcao?: string | undefined;
    anexoBase64?: string | undefined;
    anexoNome?: string | undefined;
    anexoTipo?: string | undefined;
}>;
export type CriarChamado = z.infer<typeof CriarChamadoSchema>;
export declare const AtualizarStatusChamadoSchema: z.ZodObject<{
    status: z.ZodEnum<["ABERTO", "ANDAMENTO", "COMUNICADO", "RESOLVIDO"]>;
    tecnicoResolucao: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "ABERTO" | "ANDAMENTO" | "COMUNICADO" | "RESOLVIDO";
    tecnicoResolucao?: string | undefined;
}, {
    status: "ABERTO" | "ANDAMENTO" | "COMUNICADO" | "RESOLVIDO";
    tecnicoResolucao?: string | undefined;
}>;
export type AtualizarStatusChamado = z.infer<typeof AtualizarStatusChamadoSchema>;
export declare const ResponderChamadoSchema: z.ZodObject<{
    texto: z.ZodString;
}, "strip", z.ZodTypeAny, {
    texto: string;
}, {
    texto: string;
}>;
export type ResponderChamado = z.infer<typeof ResponderChamadoSchema>;
export declare const FiltrosChamadoSchema: z.ZodObject<{
    unidade: z.ZodOptional<z.ZodString>;
    categoria: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["ABERTO", "ANDAMENTO", "COMUNICADO", "RESOLVIDO"]>>;
    urgencia: z.ZodOptional<z.ZodString>;
    tecnico: z.ZodOptional<z.ZodString>;
    inventario: z.ZodOptional<z.ZodEnum<["CONCLUIDO", "EM_ANDAMENTO", "NAO_REALIZADO", "NAO_INFORMADO"]>>;
    dataDe: z.ZodOptional<z.ZodString>;
    dataAte: z.ZodOptional<z.ZodString>;
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    status?: "ABERTO" | "ANDAMENTO" | "COMUNICADO" | "RESOLVIDO" | undefined;
    inventario?: "CONCLUIDO" | "EM_ANDAMENTO" | "NAO_REALIZADO" | "NAO_INFORMADO" | undefined;
    unidade?: string | undefined;
    urgencia?: string | undefined;
    categoria?: string | undefined;
    tecnico?: string | undefined;
    dataDe?: string | undefined;
    dataAte?: string | undefined;
}, {
    status?: "ABERTO" | "ANDAMENTO" | "COMUNICADO" | "RESOLVIDO" | undefined;
    inventario?: "CONCLUIDO" | "EM_ANDAMENTO" | "NAO_REALIZADO" | "NAO_INFORMADO" | undefined;
    unidade?: string | undefined;
    urgencia?: string | undefined;
    categoria?: string | undefined;
    tecnico?: string | undefined;
    dataDe?: string | undefined;
    dataAte?: string | undefined;
    page?: number | undefined;
    limit?: number | undefined;
}>;
export type FiltrosChamado = z.infer<typeof FiltrosChamadoSchema>;
export declare const BatchUpdateChamadosSchema: z.ZodObject<{
    ids: z.ZodArray<z.ZodString, "many">;
    status: z.ZodOptional<z.ZodEnum<["ABERTO", "ANDAMENTO", "COMUNICADO", "RESOLVIDO"]>>;
    tecnicoResolucao: z.ZodOptional<z.ZodString>;
    resposta: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    ids: string[];
    status?: "ABERTO" | "ANDAMENTO" | "COMUNICADO" | "RESOLVIDO" | undefined;
    tecnicoResolucao?: string | undefined;
    resposta?: string | undefined;
}, {
    ids: string[];
    status?: "ABERTO" | "ANDAMENTO" | "COMUNICADO" | "RESOLVIDO" | undefined;
    tecnicoResolucao?: string | undefined;
    resposta?: string | undefined;
}>;
export type BatchUpdateChamados = z.infer<typeof BatchUpdateChamadosSchema>;
export declare const BatchDeleteChamadosSchema: z.ZodObject<{
    ids: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    ids: string[];
}, {
    ids: string[];
}>;
export type BatchDeleteChamados = z.infer<typeof BatchDeleteChamadosSchema>;
export declare const PaginatedResponseSchema: <T extends z.ZodTypeAny>(itemSchema: T) => z.ZodObject<{
    data: z.ZodArray<T, "many">;
    meta: z.ZodObject<{
        total: z.ZodNumber;
        page: z.ZodNumber;
        limit: z.ZodNumber;
        totalPages: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    }, {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    }>;
}, "strip", z.ZodTypeAny, {
    meta: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
    data: T["_output"][];
}, {
    meta: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
    data: T["_input"][];
}>;
export type PaginatedResponse<T> = {
    data: T[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
};
export declare const EscolaSchema: z.ZodObject<{
    id: z.ZodString;
    nome: z.ZodString;
    nomeNormalizado: z.ZodString;
    tecnico: z.ZodString;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    nome: string;
    createdAt: string;
    updatedAt: string;
    tecnico: string;
    nomeNormalizado: string;
}, {
    id: string;
    nome: string;
    createdAt: string;
    updatedAt: string;
    tecnico: string;
    nomeNormalizado: string;
}>;
export type Escola = z.infer<typeof EscolaSchema>;
export declare const EscolaCreateSchema: z.ZodObject<{
    nome: z.ZodString;
    tecnico: z.ZodString;
}, "strip", z.ZodTypeAny, {
    nome: string;
    tecnico: string;
}, {
    nome: string;
    tecnico: string;
}>;
export type EscolaCreate = z.infer<typeof EscolaCreateSchema>;
export declare const EquipamentoSchema: z.ZodObject<{
    id: z.ZodString;
    categoria: z.ZodString;
    marca: z.ZodString;
    modelo: z.ZodString;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: string;
    updatedAt: string;
    categoria: string;
    marca: string;
    modelo: string;
}, {
    id: string;
    createdAt: string;
    updatedAt: string;
    categoria: string;
    marca: string;
    modelo: string;
}>;
export type Equipamento = z.infer<typeof EquipamentoSchema>;
export declare const EquipamentoCreateSchema: z.ZodObject<{
    categoria: z.ZodString;
    marca: z.ZodString;
    modelo: z.ZodString;
}, "strip", z.ZodTypeAny, {
    categoria: string;
    marca: string;
    modelo: string;
}, {
    categoria: string;
    marca: string;
    modelo: string;
}>;
export type EquipamentoCreate = z.infer<typeof EquipamentoCreateSchema>;
export declare const InventarioSchema: z.ZodObject<{
    id: z.ZodString;
    escolaId: z.ZodString;
    escola: z.ZodObject<{
        id: z.ZodString;
        nome: z.ZodString;
        nomeNormalizado: z.ZodString;
        tecnico: z.ZodString;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        nome: string;
        createdAt: string;
        updatedAt: string;
        tecnico: string;
        nomeNormalizado: string;
    }, {
        id: string;
        nome: string;
        createdAt: string;
        updatedAt: string;
        tecnico: string;
        nomeNormalizado: string;
    }>;
    status: z.ZodEnum<["CONCLUIDO", "EM_ANDAMENTO", "NAO_REALIZADO", "NAO_INFORMADO"]>;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "CONCLUIDO" | "EM_ANDAMENTO" | "NAO_REALIZADO" | "NAO_INFORMADO";
    escola: {
        id: string;
        nome: string;
        createdAt: string;
        updatedAt: string;
        tecnico: string;
        nomeNormalizado: string;
    };
    id: string;
    updatedAt: string;
    escolaId: string;
}, {
    status: "CONCLUIDO" | "EM_ANDAMENTO" | "NAO_REALIZADO" | "NAO_INFORMADO";
    escola: {
        id: string;
        nome: string;
        createdAt: string;
        updatedAt: string;
        tecnico: string;
        nomeNormalizado: string;
    };
    id: string;
    updatedAt: string;
    escolaId: string;
}>;
export type Inventario = z.infer<typeof InventarioSchema>;
export declare const InventarioUpdateSchema: z.ZodObject<{
    status: z.ZodEnum<["CONCLUIDO", "EM_ANDAMENTO", "NAO_REALIZADO", "NAO_INFORMADO"]>;
}, "strip", z.ZodTypeAny, {
    status: "CONCLUIDO" | "EM_ANDAMENTO" | "NAO_REALIZADO" | "NAO_INFORMADO";
}, {
    status: "CONCLUIDO" | "EM_ANDAMENTO" | "NAO_REALIZADO" | "NAO_INFORMADO";
}>;
export type InventarioUpdate = z.infer<typeof InventarioUpdateSchema>;
export declare const DashboardKPIsSchema: z.ZodObject<{
    total: z.ZodNumber;
    abertos: z.ZodNumber;
    andamento: z.ZodNumber;
    comunicado: z.ZodNumber;
    resolvidos: z.ZodNumber;
    altaPrioridade: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    total: number;
    abertos: number;
    andamento: number;
    comunicado: number;
    resolvidos: number;
    altaPrioridade: number;
}, {
    total: number;
    abertos: number;
    andamento: number;
    comunicado: number;
    resolvidos: number;
    altaPrioridade: number;
}>;
export type DashboardKPIs = z.infer<typeof DashboardKPIsSchema>;
export declare const DashboardMatrizResponseSchema: z.ZodObject<{
    kpis: z.ZodObject<{
        total: z.ZodNumber;
        abertos: z.ZodNumber;
        andamento: z.ZodNumber;
        comunicado: z.ZodNumber;
        resolvidos: z.ZodNumber;
        altaPrioridade: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        total: number;
        abertos: number;
        andamento: number;
        comunicado: number;
        resolvidos: number;
        altaPrioridade: number;
    }, {
        total: number;
        abertos: number;
        andamento: number;
        comunicado: number;
        resolvidos: number;
        altaPrioridade: number;
    }>;
    chamados: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        protocolo: z.ZodString;
        timestamp: z.ZodString;
        unidade: z.ZodString;
        solicitante: z.ZodString;
        funcao: z.ZodNullable<z.ZodString>;
        tipo: z.ZodString;
        descricao: z.ZodString;
        urgencia: z.ZodString;
        anexoUrl: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<["ABERTO", "ANDAMENTO", "COMUNICADO", "RESOLVIDO"]>;
        responsavel: z.ZodNullable<z.ZodString>;
        ultimaAtualizacao: z.ZodString;
        historico: z.ZodNullable<z.ZodString>;
        tecnicoResolucao: z.ZodNullable<z.ZodString>;
        tecnicoSetor: z.ZodNullable<z.ZodString>;
        inventarioStatus: z.ZodNullable<z.ZodEnum<["CONCLUIDO", "EM_ANDAMENTO", "NAO_REALIZADO", "NAO_INFORMADO"]>>;
    }, "strip", z.ZodTypeAny, {
        status: "ABERTO" | "ANDAMENTO" | "COMUNICADO" | "RESOLVIDO";
        id: string;
        protocolo: string;
        timestamp: string;
        unidade: string;
        solicitante: string;
        funcao: string | null;
        tipo: string;
        descricao: string;
        urgencia: string;
        anexoUrl: string | null;
        responsavel: string | null;
        ultimaAtualizacao: string;
        historico: string | null;
        tecnicoResolucao: string | null;
        tecnicoSetor: string | null;
        inventarioStatus: "CONCLUIDO" | "EM_ANDAMENTO" | "NAO_REALIZADO" | "NAO_INFORMADO" | null;
    }, {
        status: "ABERTO" | "ANDAMENTO" | "COMUNICADO" | "RESOLVIDO";
        id: string;
        protocolo: string;
        timestamp: string;
        unidade: string;
        solicitante: string;
        funcao: string | null;
        tipo: string;
        descricao: string;
        urgencia: string;
        anexoUrl: string | null;
        responsavel: string | null;
        ultimaAtualizacao: string;
        historico: string | null;
        tecnicoResolucao: string | null;
        tecnicoSetor: string | null;
        inventarioStatus: "CONCLUIDO" | "EM_ANDAMENTO" | "NAO_REALIZADO" | "NAO_INFORMADO" | null;
    }>, "many">;
    graficos: z.ZodObject<{
        porStatus: z.ZodRecord<z.ZodString, z.ZodNumber>;
        porUrgencia: z.ZodRecord<z.ZodString, z.ZodNumber>;
        resolvidosPorTecnico: z.ZodRecord<z.ZodString, z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        porStatus: Record<string, number>;
        porUrgencia: Record<string, number>;
        resolvidosPorTecnico: Record<string, number>;
    }, {
        porStatus: Record<string, number>;
        porUrgencia: Record<string, number>;
        resolvidosPorTecnico: Record<string, number>;
    }>;
}, "strip", z.ZodTypeAny, {
    kpis: {
        total: number;
        abertos: number;
        andamento: number;
        comunicado: number;
        resolvidos: number;
        altaPrioridade: number;
    };
    chamados: {
        status: "ABERTO" | "ANDAMENTO" | "COMUNICADO" | "RESOLVIDO";
        id: string;
        protocolo: string;
        timestamp: string;
        unidade: string;
        solicitante: string;
        funcao: string | null;
        tipo: string;
        descricao: string;
        urgencia: string;
        anexoUrl: string | null;
        responsavel: string | null;
        ultimaAtualizacao: string;
        historico: string | null;
        tecnicoResolucao: string | null;
        tecnicoSetor: string | null;
        inventarioStatus: "CONCLUIDO" | "EM_ANDAMENTO" | "NAO_REALIZADO" | "NAO_INFORMADO" | null;
    }[];
    graficos: {
        porStatus: Record<string, number>;
        porUrgencia: Record<string, number>;
        resolvidosPorTecnico: Record<string, number>;
    };
}, {
    kpis: {
        total: number;
        abertos: number;
        andamento: number;
        comunicado: number;
        resolvidos: number;
        altaPrioridade: number;
    };
    chamados: {
        status: "ABERTO" | "ANDAMENTO" | "COMUNICADO" | "RESOLVIDO";
        id: string;
        protocolo: string;
        timestamp: string;
        unidade: string;
        solicitante: string;
        funcao: string | null;
        tipo: string;
        descricao: string;
        urgencia: string;
        anexoUrl: string | null;
        responsavel: string | null;
        ultimaAtualizacao: string;
        historico: string | null;
        tecnicoResolucao: string | null;
        tecnicoSetor: string | null;
        inventarioStatus: "CONCLUIDO" | "EM_ANDAMENTO" | "NAO_REALIZADO" | "NAO_INFORMADO" | null;
    }[];
    graficos: {
        porStatus: Record<string, number>;
        porUrgencia: Record<string, number>;
        resolvidosPorTecnico: Record<string, number>;
    };
}>;
export type DashboardMatrizResponse = z.infer<typeof DashboardMatrizResponseSchema>;
export declare const DashboardFiltradoResponseSchema: z.ZodObject<{
    kpis: z.ZodObject<{
        total: z.ZodNumber;
        abertos: z.ZodNumber;
        andamento: z.ZodNumber;
        comunicado: z.ZodNumber;
        resolvidos: z.ZodNumber;
        altaPrioridade: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        total: number;
        abertos: number;
        andamento: number;
        comunicado: number;
        resolvidos: number;
        altaPrioridade: number;
    }, {
        total: number;
        abertos: number;
        andamento: number;
        comunicado: number;
        resolvidos: number;
        altaPrioridade: number;
    }>;
    chamados: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        protocolo: z.ZodString;
        timestamp: z.ZodString;
        unidade: z.ZodString;
        solicitante: z.ZodString;
        funcao: z.ZodNullable<z.ZodString>;
        tipo: z.ZodString;
        descricao: z.ZodString;
        urgencia: z.ZodString;
        anexoUrl: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<["ABERTO", "ANDAMENTO", "COMUNICADO", "RESOLVIDO"]>;
        responsavel: z.ZodNullable<z.ZodString>;
        ultimaAtualizacao: z.ZodString;
        historico: z.ZodNullable<z.ZodString>;
        tecnicoResolucao: z.ZodNullable<z.ZodString>;
        tecnicoSetor: z.ZodNullable<z.ZodString>;
        inventarioStatus: z.ZodNullable<z.ZodEnum<["CONCLUIDO", "EM_ANDAMENTO", "NAO_REALIZADO", "NAO_INFORMADO"]>>;
    }, "strip", z.ZodTypeAny, {
        status: "ABERTO" | "ANDAMENTO" | "COMUNICADO" | "RESOLVIDO";
        id: string;
        protocolo: string;
        timestamp: string;
        unidade: string;
        solicitante: string;
        funcao: string | null;
        tipo: string;
        descricao: string;
        urgencia: string;
        anexoUrl: string | null;
        responsavel: string | null;
        ultimaAtualizacao: string;
        historico: string | null;
        tecnicoResolucao: string | null;
        tecnicoSetor: string | null;
        inventarioStatus: "CONCLUIDO" | "EM_ANDAMENTO" | "NAO_REALIZADO" | "NAO_INFORMADO" | null;
    }, {
        status: "ABERTO" | "ANDAMENTO" | "COMUNICADO" | "RESOLVIDO";
        id: string;
        protocolo: string;
        timestamp: string;
        unidade: string;
        solicitante: string;
        funcao: string | null;
        tipo: string;
        descricao: string;
        urgencia: string;
        anexoUrl: string | null;
        responsavel: string | null;
        ultimaAtualizacao: string;
        historico: string | null;
        tecnicoResolucao: string | null;
        tecnicoSetor: string | null;
        inventarioStatus: "CONCLUIDO" | "EM_ANDAMENTO" | "NAO_REALIZADO" | "NAO_INFORMADO" | null;
    }>, "many">;
    avisos: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        tipo: z.ZodString;
        anterior: z.ZodString;
        atual: z.ZodString;
        responsavel: z.ZodString;
        quando: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        tipo: string;
        responsavel: string;
        anterior: string;
        atual: string;
        quando: string;
    }, {
        id: string;
        tipo: string;
        responsavel: string;
        anterior: string;
        atual: string;
        quando: string;
    }>, "many">;
    inventario: z.ZodObject<{
        unidade: z.ZodString;
        tecnicoSetor: z.ZodString;
        status: z.ZodEnum<["CONCLUIDO", "EM_ANDAMENTO", "NAO_REALIZADO", "NAO_INFORMADO"]>;
    }, "strip", z.ZodTypeAny, {
        status: "CONCLUIDO" | "EM_ANDAMENTO" | "NAO_REALIZADO" | "NAO_INFORMADO";
        unidade: string;
        tecnicoSetor: string;
    }, {
        status: "CONCLUIDO" | "EM_ANDAMENTO" | "NAO_REALIZADO" | "NAO_INFORMADO";
        unidade: string;
        tecnicoSetor: string;
    }>;
}, "strip", z.ZodTypeAny, {
    inventario: {
        status: "CONCLUIDO" | "EM_ANDAMENTO" | "NAO_REALIZADO" | "NAO_INFORMADO";
        unidade: string;
        tecnicoSetor: string;
    };
    kpis: {
        total: number;
        abertos: number;
        andamento: number;
        comunicado: number;
        resolvidos: number;
        altaPrioridade: number;
    };
    chamados: {
        status: "ABERTO" | "ANDAMENTO" | "COMUNICADO" | "RESOLVIDO";
        id: string;
        protocolo: string;
        timestamp: string;
        unidade: string;
        solicitante: string;
        funcao: string | null;
        tipo: string;
        descricao: string;
        urgencia: string;
        anexoUrl: string | null;
        responsavel: string | null;
        ultimaAtualizacao: string;
        historico: string | null;
        tecnicoResolucao: string | null;
        tecnicoSetor: string | null;
        inventarioStatus: "CONCLUIDO" | "EM_ANDAMENTO" | "NAO_REALIZADO" | "NAO_INFORMADO" | null;
    }[];
    avisos: {
        id: string;
        tipo: string;
        responsavel: string;
        anterior: string;
        atual: string;
        quando: string;
    }[];
}, {
    inventario: {
        status: "CONCLUIDO" | "EM_ANDAMENTO" | "NAO_REALIZADO" | "NAO_INFORMADO";
        unidade: string;
        tecnicoSetor: string;
    };
    kpis: {
        total: number;
        abertos: number;
        andamento: number;
        comunicado: number;
        resolvidos: number;
        altaPrioridade: number;
    };
    chamados: {
        status: "ABERTO" | "ANDAMENTO" | "COMUNICADO" | "RESOLVIDO";
        id: string;
        protocolo: string;
        timestamp: string;
        unidade: string;
        solicitante: string;
        funcao: string | null;
        tipo: string;
        descricao: string;
        urgencia: string;
        anexoUrl: string | null;
        responsavel: string | null;
        ultimaAtualizacao: string;
        historico: string | null;
        tecnicoResolucao: string | null;
        tecnicoSetor: string | null;
        inventarioStatus: "CONCLUIDO" | "EM_ANDAMENTO" | "NAO_REALIZADO" | "NAO_INFORMADO" | null;
    }[];
    avisos: {
        id: string;
        tipo: string;
        responsavel: string;
        anterior: string;
        atual: string;
        quando: string;
    }[];
}>;
export type DashboardFiltradoResponse = z.infer<typeof DashboardFiltradoResponseSchema>;
export declare const ErrorResponseSchema: z.ZodObject<{
    error: z.ZodString;
    message: z.ZodString;
    details: z.ZodOptional<z.ZodArray<z.ZodObject<{
        field: z.ZodString;
        message: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        message: string;
        field: string;
    }, {
        message: string;
        field: string;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    error: string;
    message: string;
    details?: {
        message: string;
        field: string;
    }[] | undefined;
}, {
    error: string;
    message: string;
    details?: {
        message: string;
        field: string;
    }[] | undefined;
}>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
export declare const ErrorCodes: {
    readonly UNAUTHORIZED: "UNAUTHORIZED";
    readonly FORBIDDEN: "FORBIDDEN";
    readonly VALIDATION_ERROR: "VALIDATION_ERROR";
    readonly NOT_FOUND: "NOT_FOUND";
    readonly RATE_LIMITED: "RATE_LIMITED";
    readonly INTERNAL_ERROR: "INTERNAL_ERROR";
};
export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];
export declare const HealthResponseSchema: z.ZodObject<{
    status: z.ZodEnum<["ok", "degraded", "down"]>;
    timestamp: z.ZodString;
    uptime: z.ZodNumber;
    database: z.ZodEnum<["connected", "disconnected"]>;
    version: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "ok" | "degraded" | "down";
    timestamp: string;
    uptime: number;
    database: "connected" | "disconnected";
    version: string;
}, {
    status: "ok" | "degraded" | "down";
    timestamp: string;
    uptime: number;
    database: "connected" | "disconnected";
    version: string;
}>;
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
//# sourceMappingURL=api.d.ts.map