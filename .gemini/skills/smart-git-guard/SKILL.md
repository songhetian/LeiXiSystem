name: smart-git-guard
description: 自动化 Git 提交与质量检查。在修改代码后自动执行检查，验证无误后才允许提交 Git，若有问题则中止并提示修改。

# Smart Git Guard

此技能用于在完成代码修改后，执行自动化的质量检查并提交 Git。

## 工作流程

1. **检查修改状态**：
   - 确认哪些文件被修改。
   - 检查是否有语法错误。

2. **执行验证 (Validation)**：
   - **必需步骤**：运行项目关键的编译或检查命令（如 `npx tsc --noEmit` 或 `npm run lint`）。
   - 如果是后端修改，必须检查 `server/index.js` 等核心文件的语法。
   - 如果检查失败，**禁止提交**，并向用户报告具体错误原因。

3. **自动提交 (Auto-Commit)**：
   - 只有在验证 100% 通过后，才生成简洁明了的 Commit Message。
   - 执行 `git add .` 和 `git commit -m "..."`。

## 常用命令参考

- **后端语法检查**：`node --check server/index.js`
- **前端构建模拟**：`npx vite build --dry-run`
- **Git 提交**：`git status && git add . && git commit -m "[fix/feat] 描述信息"`

## 失败处理

如果验证失败，必须：
1. 详细列出错误信息。
2. 提出修复建议。
3. 提示用户“代码存在问题，已中止 Git 提交，请修改后再试”。
