export type UserPermissionCode =
  | 'users.write'
  | 'sync.read'
  | 'clients.write'
  | 'orders.read'
  | 'orders.write'
  | 'inventory.read'
  | 'inventory.write'
  | 'finance.read'
  | 'finance.write'
  | 'contracts.read'
  | 'contracts.write'
  | 'crm.read'
  | 'crm.write'
  | 'fleet.read'
  | 'fleet.write'
  | 'reports.finance'
  | 'reports.orders'
  | 'reports.fleet';

export interface PermissionDefinition {
  code: UserPermissionCode;
  label: string;
  description: string;
  module: 'users' | 'sync' | 'clients' | 'orders' | 'inventory' | 'finance' | 'contracts' | 'crm' | 'fleet' | 'reports';
}

export const USER_PERMISSION_CATALOG: PermissionDefinition[] = [
  {
    code: 'users.write',
    label: 'Gerenciar colaboradores',
    description: 'Criar, atualizar e desativar usuários/colaboradores do tenant.',
    module: 'users'
  },
  {
    code: 'sync.read',
    label: 'Sincronização',
    description: 'Acessar ferramentas de sincronização externa.',
    module: 'sync'
  },
  {
    code: 'clients.write',
    label: 'Clientes e equipamentos',
    description: 'Criar/editar clientes, endereços e equipamentos vinculados.',
    module: 'clients'
  },
  {
    code: 'orders.read',
    label: 'OS - Visualizar',
    description: 'Visualizar ordens de serviço e relatórios.',
    module: 'orders'
  },
  {
    code: 'orders.write',
    label: 'OS - Operar',
    description: 'Criar, editar, iniciar, finalizar OS e registrar materiais/fotos.',
    module: 'orders'
  },
  {
    code: 'inventory.read',
    label: 'Estoque - Visualizar',
    description: 'Consultar itens, níveis e alertas de estoque.',
    module: 'inventory'
  },
  {
    code: 'inventory.write',
    label: 'Estoque - Operar',
    description: 'Cadastrar itens, movimentar estoque, compras e fornecedores.',
    module: 'inventory'
  },
  {
    code: 'finance.read',
    label: 'Financeiro - Visualizar',
    description: 'Acessar relatórios e listar títulos financeiros.',
    module: 'finance'
  },
  {
    code: 'finance.write',
    label: 'Financeiro - Operar',
    description: 'Criar e liquidar transações financeiras.',
    module: 'finance'
  },
  {
    code: 'contracts.read',
    label: 'Contratos - Visualizar',
    description: 'Listar e visualizar contratos.',
    module: 'contracts'
  },
  {
    code: 'contracts.write',
    label: 'Contratos - Operar',
    description: 'Criar, editar e cancelar contratos.',
    module: 'contracts'
  },
  {
    code: 'crm.read',
    label: 'CRM - Visualizar',
    description: 'Consultar leads e interações do CRM.',
    module: 'crm'
  },
  {
    code: 'crm.write',
    label: 'CRM - Operar',
    description: 'Criar e atualizar leads, etapas e follow-ups.',
    module: 'crm'
  },
  {
    code: 'fleet.read',
    label: 'Frota - Visualizar',
    description: 'Consultar veículos, abastecimentos e manutenções.',
    module: 'fleet'
  },
  {
    code: 'fleet.write',
    label: 'Frota - Operar',
    description: 'Registrar checklists, abastecimentos e eventos de frota.',
    module: 'fleet'
  },
  {
    code: 'reports.finance',
    label: 'Relatórios Financeiros',
    description: 'Acessar relatórios financeiros consolidados.',
    module: 'reports'
  },
  {
    code: 'reports.orders',
    label: 'Relatórios de OS',
    description: 'Acessar relatórios operacionais de ordens.',
    module: 'reports'
  },
  {
    code: 'reports.fleet',
    label: 'Relatórios de Frota',
    description: 'Visualizar relatórios específicos de frota.',
    module: 'reports'
  }
];

export const ALL_PERMISSION_CODES: UserPermissionCode[] = USER_PERMISSION_CATALOG.map((item) => item.code);

type RoleKey = 'owner' | 'admin' | 'manager' | 'tech' | 'viewer';

export const ROLE_PERMISSION_PRESETS: Record<RoleKey, UserPermissionCode[]> = {
  owner: [...ALL_PERMISSION_CODES],
  admin: [...ALL_PERMISSION_CODES],
  manager: [
    'clients.write',
    'orders.read',
    'orders.write',
    'inventory.read',
    'inventory.write',
    'finance.read',
    'contracts.read',
    'crm.read',
    'crm.write',
    'fleet.read',
    'fleet.write',
    'reports.finance',
    'reports.orders',
    'reports.fleet'
  ],
  tech: ['orders.read', 'orders.write', 'inventory.read', 'fleet.read', 'fleet.write'],
  viewer: ['orders.read', 'inventory.read', 'fleet.read', 'reports.orders']
};

export function resolveDefaultPermissions(role: RoleKey): UserPermissionCode[] {
  return ROLE_PERMISSION_PRESETS[role] ? [...ROLE_PERMISSION_PRESETS[role]] : [];
}

export function normalizePermissions(perms: string[]): UserPermissionCode[] {
  const unique = new Set<UserPermissionCode>();
  for (const perm of perms || []) {
    if (ALL_PERMISSION_CODES.includes(perm as UserPermissionCode)) {
      unique.add(perm as UserPermissionCode);
    }
  }
  return Array.from(unique);
}
