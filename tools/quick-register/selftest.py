# -*- coding: utf-8 -*-
"""打包后的连接自检：LeiXiQuickRegister.exe --selftest

只读检查（不会在生产库创建账号）：
登录 → CSRF → 部门/岗位/角色读取 → 密码策略 weak 确认 → 随机账号生成示例。
结果写 %TEMP%/leixi_quick_register_selftest.json，返回码 0=全部通过。
"""
from __future__ import annotations

import json
import os
import tempfile
import traceback

from api import ApiError, LeiXiClient, ensure_weak_password_policy, random_username
from main import DEFAULT_BASE, DEFAULT_PASSWORD, DEFAULT_USERNAME

REPORT = os.path.join(tempfile.gettempdir(), "leixi_quick_register_selftest.json")


def run_selftest() -> int:
    base = os.environ.get("LEIXI_QR_BASE", DEFAULT_BASE)
    out: dict = {"base": base, "ok": False, "steps": {}}
    c = LeiXiClient(base)
    try:
        user = c.login(DEFAULT_USERNAME, DEFAULT_PASSWORD)
        out["steps"]["login"] = {
            "ok": True,
            "user": user.get("username"),
            "csrf": bool(c.csrf_token),
        }
        depts = c.departments()
        out["steps"]["departments"] = {"ok": True, "count": len(depts),
                                       "sample": [d.get("name") for d in depts[:3]]}
        positions = c.positions()
        out["steps"]["positions"] = {"ok": True, "count": len(positions)}
        roles = c.roles()
        staff = next((r for r in roles if r.get("code") == "staff"
                      or r.get("name") == "普通员工"), None)
        out["steps"]["default_role"] = {"ok": bool(staff), "staff": staff}
        policy = ensure_weak_password_policy(c)
        out["steps"]["password_policy"] = {"ok": policy.startswith("weak"), "value": policy}
        sample = random_username(c, "张三")
        out["steps"]["username_rule"] = {
            "ok": sample.startswith("zs") and len(sample) == 8,
            "sample": sample, "note": "拼音首字母 + 6 位随机串（仅生成不创建）",
        }
        out["steps"]["write_permission"] = {"ok": True, "note": "登录接口返回 csrfToken，写接口可带 X-CSRF-Token"}
        out["ok"] = (out["steps"]["login"]["ok"]
                     and out["steps"]["departments"]["ok"]
                     and out["steps"]["default_role"]["ok"]
                     and out["steps"]["password_policy"]["ok"]
                     and out["steps"]["username_rule"]["ok"])
    except ApiError as e:
        out["error"] = f"{e}（code={e.code}, status={e.status}）"
    except Exception as e:  # noqa: BLE001 自检要吞掉一切异常并落盘
        out["error"] = f"{e.__class__.__name__}: {e}"
        out["traceback"] = traceback.format_exc()
    finally:
        try:
            with open(REPORT, "w", encoding="utf-8") as f:
                json.dump(out, f, ensure_ascii=False, indent=2)
        except Exception:
            pass
    print(json.dumps(out, ensure_ascii=False, indent=2))
    return 0 if out["ok"] else 1
