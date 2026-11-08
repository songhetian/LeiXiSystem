# -*- coding: utf-8 -*-
"""端到端实测：登录 → 重名检查 → 账号生成 → 创建 → 验证 → 清理。"""
import os
import re
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from api import (
    ApiError,
    LeiXiClient,
    RANDOM_ALPHABET,
    check_name_exists,
    default_password,
    ensure_weak_password_policy,
    initials_of,
    random_username,
)

BASE = "http://localhost:4001/api/v1"
NAME = "测试登记"  # 用完即删，不污染演示数据


def main():
    print("== 1. 登录")
    c = LeiXiClient(BASE)
    user = c.login("admin", "123456")
    print("   登录成功:", user.get("username"), user.get("realName"), "csrf:", bool(c.csrf_token))

    print("== 2. 部门 / 岗位")
    depts = c.departments()
    print(f"   部门 {len(depts)} 个:", [d["name"] for d in depts][:6])
    positions = c.positions()
    print(f"   岗位 {len(positions)} 个:", [p["name"] for p in positions][:6])

    print("== 3. 密码策略与默认密码")
    print("   连接自检:", ensure_weak_password_policy(c))
    print("   固定初始密码:", default_password()[0])

    print("== 4. 拼音首字母")
    for n in ("张三", "欧阳娜娜", "测试登记", "Tony Sun"):
        print(f"   {n} → {initials_of(n)}")

    print("== 5. 重名检查（已有姓名 张三/管理员）")
    for probe in ("张三", "管理员", NAME):
        dup = check_name_exists(c, probe)
        print(f"   {probe}: user={len(dup['user'])} employee={len(dup['employee'])}")

    print("== 6. 生成账号（拼音首字母 + 6 位随机串）")
    username = random_username(c, NAME)
    again = random_username(c, NAME)
    print(f"   {NAME} → {username} / 再次生成 → {again}")
    assert re.fullmatch(rf"csdj[{RANDOM_ALPHABET}]{{6}}", username), f"格式不对：{username}"
    assert username != again, "两次生成了相同账号，不是随机的"
    assert not any(ch in "01ilo" for ch in username[-6:]), "随机串含易混字符"
    print("   格式 / 随机性 ✓")
    password, reason = default_password()
    print(f"   初始密码: {password}（{reason}）")

    print("== 6b. 撞号重摇（模拟服务端已有该账号）")
    class FakeClient:
        def __init__(self, occupied: int):
            self.occupied = occupied
            self.calls = 0

        def search_users(self, keyword, page=1, page_size=100):
            self.calls += 1
            hit = [{"username": keyword}] if self.calls <= self.occupied else []
            return {"list": hit, "total": len(hit)}

    fake = FakeClient(1)
    picked = random_username(fake, "张三")
    assert fake.calls == 2 and picked.startswith("zs"), "撞号未自动重摇"
    print(f"   首摇占用 → 重摇得到 {picked}（查询 {fake.calls} 次）")
    try:
        random_username(FakeClient(999), "张三")
        raise AssertionError("连续冲突应报错")
    except ApiError:
        print("   连续冲突上限 ✓")

    print("== 7. 创建账号（默认挂「普通员工」角色）")
    role_id = None
    for r in c.roles():
        if r.get("code") == "staff" or r.get("name") == "普通员工":
            role_id = r["id"]
            break
    print("   默认角色 staff id =", role_id)
    dept = next(d for d in depts if d.get("deletedAt") is None)
    created = c.create_user(username, password, NAME, dept["id"],
                            positions[0]["id"] if positions else None,
                            [role_id] if role_id else None)
    print("   创建成功:", created)
    role_names = [r.get("name") for r in created.get("roles", [])]
    assert role_id is None or "普通员工" in role_names, f"角色未挂上：{role_names}"

    print("== 8. 重名复查（应命中）")
    dup = check_name_exists(c, NAME)
    print(f"   user={len(dup['user'])} employee={len(dup['employee'])}")
    assert dup["user"] or dup["employee"], "重名检查未命中！"

    print("== 9. 新账号可登录验证")
    c2 = LeiXiClient(BASE)
    u2 = c2.login(created["username"], password)
    print("   新账号登录成功:", u2.get("username"))
    c2.logout()

    print("== 10. 清理（接口软删 + SQL 硬删测试数据）")
    uid = created["id"]
    del_res = c._request("DELETE", f"/system/users/{uid}")
    print("   软删:", del_res)
    import pymysql
    conn = pymysql.connect(host="localhost", user="root", password="root",
                           database="leixin_v2", charset="utf8mb4")
    cur = conn.cursor()
    cur.execute("DELETE FROM user_roles WHERE user_id=%s", (uid,))
    cur.execute("DELETE FROM employees WHERE user_id=%s", (uid,))
    n_emp = cur.rowcount
    cur.execute("DELETE FROM users WHERE id=%s", (uid,))
    n_user = cur.rowcount
    conn.commit()
    conn.close()
    print(f"   硬删: employees={n_emp} users={n_user}（createUser 是用户+档案同事务，必须一起清）")

    # 重名冲突重试路径：再造一个同名（换名字）
    print("== 11. 无 CSRF 头直接写（应 403）")
    import requests as rq
    r = rq.post(f"{BASE}/system/users", json={}, cookies=c.s.cookies)
    print("   status:", r.status_code, r.json().get("code"), r.json().get("message"))
    assert r.status_code == 403, "CSRF 守卫未拦截"

    print("\n全部通过 ✓")


if __name__ == "__main__":
    main()
