/** 角色→权限 加载抽象：隔离 Prisma 查询，测试用注入 mock */
export interface RolePermissionLoader {
  loadPermissionCodes(roleIds: number[]): Promise<string[]>;
}

/** 权限解析服务：输入角色 id 集合，产出去重、排序后的权限码列表。
 *  seam 的核心纯逻辑是"并集 + 去重 + 排序"，DB 读取由注入 loader 隔离。 */
export function createPermissionService(loader: RolePermissionLoader, roleIds: number[]) {
  const codes = loader
    .loadPermissionCodes(roleIds)
    .then((all) => [...new Set(all)].sort()); // 纯逻辑：去重 + 排序

  return {
    permissionCodes: () => codes,
    async has(code: string): Promise<boolean> {
      return (await codes).includes(code);
    },
  };
}