export const DASHBOARDS_QUERY_KEYS = {
  definitionsRoot: ['dashboard-definitions'] as const,
  definitionsByStatus: (statusFilter: string) => ['dashboard-definitions', statusFilter] as const,
};
