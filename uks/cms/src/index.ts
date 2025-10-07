import type { Core } from "@strapi/strapi";

async function ensureDefaultRoles(strapi: Core.Strapi) {
  const roleService = strapi.service("plugin::users-permissions.role");
  const existingRaw = await roleService.find();
  const existing = Array.isArray(existingRaw)
    ? existingRaw
    : existingRaw?.results ?? [];
  const codes = existing.map((role: any) => role.code);

  const desiredRoles = [
    {
      name: "Editor",
      code: "editor",
      description: "Может модерировать и публиковать контент",
      permissions: {
        "api::project": ["find", "findOne", "create", "update", "delete"],
        "api::news-item": ["find", "findOne", "create", "update", "delete"],
        "api::document": ["find", "findOne", "create", "update", "delete"],
        "api::procurement": ["find", "findOne", "create", "update", "delete"],
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
        "api::news-item": ["find", "findOne"],
        "api::document": ["find", "findOne"],
        "api::procurement": ["find", "findOne"],
      },
    },
  ];

  for (const role of desiredRoles) {
    if (!codes.includes(role.code)) {
      await roleService.create({
        name: role.name,
        code: role.code,
        description: role.description,
        permissions: Object.entries(role.permissions).reduce(
          (acc, [contentType, actions]) => {
            const controller = contentType.split("::")[1];
            acc[`api::${controller}`] = {
              controllers: {
                [controller]: actions.reduce((perms: Record<string, boolean>, action) => {
                  perms[action] = true;
                  return perms;
                }, {}),
              },
            };
            return acc;
          },
          {} as Record<string, any>
        ),
      });
    }
  }
}

export default {
  async register() {},

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await ensureDefaultRoles(strapi);
  },
};
