import type { Core } from "@strapi/strapi";

type PermissionMap = Record<string, string[]>;

type DesiredRole = {
  name: string;
  code: string;
  description: string;
  permissions: PermissionMap;
};

function buildPermissionPayload(permissions: PermissionMap) {
  return Object.entries(permissions).reduce(
    (acc, [contentType, actions]) => {
      const controllerName = contentType.split("::")[1];

      acc[contentType] = {
        controllers: {
          [controllerName]: actions.reduce(
            (controllerAcc, action) => {
              controllerAcc[action] = { enabled: true };
              return controllerAcc;
            },
            {} as Record<string, { enabled: boolean }>
          ),
        },
      };

      return acc;
    },
    {} as Record<string, any>
  );
}

async function ensureDefaultRoles(strapi: Core.Strapi) {
  const roleService = strapi.service("plugin::users-permissions.role");
  const existingRaw = await roleService.find();
  const existing = Array.isArray(existingRaw)
    ? existingRaw
    : existingRaw?.results ?? [];

  const desiredRoles: DesiredRole[] = [
    {
      name: "Editor",
      code: "editor",
      description: "Может модерировать и публиковать контент",
      permissions: {
        "api::project": ["find", "findOne", "create", "update", "delete"],
        "api::news-article": [
          "find",
          "findOne",
          "create",
          "update",
          "delete",
        ],
        "api::document": ["find", "findOne", "create", "update", "delete"],
        "api::procurement": [
          "find",
          "findOne",
          "create",
          "update",
          "delete",
        ],
      },
    },
    {
      name: "Manager Procurement",
      code: "manager_procurement",
      description: "Может создавать и редактировать закупки",
      permissions: {
        "api::procurement": ["find", "findOne", "create", "update"],
        "api::document": ["find", "findOne", "create", "update"],
      },
    },
    {
      name: "Viewer",
      code: "viewer",
      description: "Только просмотр контента",
      permissions: {
        "api::project": ["find", "findOne"],
        "api::news-article": ["find", "findOne"],
        "api::document": ["find", "findOne"],
        "api::procurement": ["find", "findOne"],
      },
    },
  ];

  const rolesByCode = new Map(
    existing.map((role: any) => [role.type ?? role.code ?? role.name, role])
  );

  for (const role of desiredRoles) {
    const permissionPayload = buildPermissionPayload(role.permissions);
    const existingRole = rolesByCode.get(role.code);

    if (existingRole) {
      await roleService.updateRole(existingRole.id, {
        name: role.name,
        description: role.description,
        permissions: permissionPayload,
      });
      continue;
    }

    await roleService.createRole({
      name: role.name,
      description: role.description,
      type: role.code,
      permissions: permissionPayload,
    });
  }
}

export default {
  async register() {},

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await ensureDefaultRoles(strapi);
  },
};
