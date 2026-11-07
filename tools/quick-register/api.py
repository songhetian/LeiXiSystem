# -*- coding: utf-8 -*-
"""雷犀管理系统 API 客户端（快速登记桌面工具专用）。

统一响应信封 {code, message, data}：
- code == 0 → 成功，返回 data
- 其余 → 抛 ApiError(message)；登录过期抛 NeedRelogin
写请求自动带 X-CSRF-Token；5012/5013 时刷新一次并重放。
"""
from __future__ import annotations

import re
from typing import Any

import requests

CSRF_INVALID_CODES = {5012, 5013}


class ApiError(Exception):
    def __init__(self, message: str, code: int | None = None, status: int | None = None):
        super().__init__(message)
        self.code = code
        self.status = status


class NeedRelogin(ApiError):
    """会话失效，需要重新登录。"""


class LeiXiClient:
    def __init__(self, base_url: str, timeout: float = 10.0):
        self.base = base_url.rstrip("/")
        self.timeout = timeout
        self.s = requests.Session()
        self.csrf_token = ""
        self.user: dict[str, Any] | None = None

    # ---- 基础请求 ----
    def _request(self, method: str, path: str, *, auth: bool = True,
                 _retry: bool = True, **kw) -> Any:
        url = f"{self.base}{path}"
        headers = kw.pop("headers", {}) or {}
        if auth:
            headers["X-CSRF-Token"] = self.csrf_token
        try:
            resp = self.s.request(method, url, timeout=self.timeout, headers=headers, **kw)
        except requests.RequestException as e:
            raise ApiError(f"网络错误：无法连接 {self.base}（{e.__class__.__name__}）") from e

        try:
            body = resp.json()
        except ValueError:
            body = None

        if resp.status_code >= 400:
            code = body.get("code") if isinstance(body, dict) else None
            message = (body.get("message") if isinstance(body, dict) else None) or f"HTTP {resp.status_code}"
            if resp.status_code == 401:
                raise NeedRelogin("登录已过期，请重新登录")
            if code in CSRF_INVALID_CODES and auth and _retry:
                # CSRF 失效：换 token 重放一次（守卫在业务前拒绝，重放安全）
                self.refresh_csrf()
                return self._request(method, path, auth=auth, _retry=False, **kw)
            raise ApiError(message, code=code, status=resp.status_code)

        if not isinstance(body, dict) or "code" not in body:
            raise ApiError(f"响应格式异常（HTTP {resp.status_code}）")
        if body["code"] != 0:
            raise ApiError(body.get("message") or "请求失败", code=body["code"], status=resp.status_code)
        return body.get("data")

    def refresh_csrf(self) -> None:
        data = self._request("GET", "/auth/csrf-token", auth=False)
        self.csrf_token = (data or {}).get("token", "")

    # ---- 认证 ----
    def login(self, username: str, password: str) -> dict:
        data = self._request("POST", "/auth/login", auth=False,
                             json={"username": username, "password": password})
        self.user = data.get("user")
        self.csrf_token = data.get("csrfToken", "")
        return self.user or {}

    def logout(self) -> None:
        try:
            self._request("POST", "/auth/logout")
        except ApiError:
            pass
        self.user = None
        self.csrf_token = ""

    # ---- 部门 ----
    def departments(self) -> list[dict]:
        return self._request("GET", "/system/departments") or []

    def create_department(self, name: str) -> dict:
        return self._request("POST", "/system/departments", json={"name": name})

    # ---- 岗位 ----
    def positions(self) -> list[dict]:
        return self._request("GET", "/system/positions") or []

    def create_position(self, name: str) -> dict:
        return self._request("POST", "/system/positions", json={"name": name})

    # ---- 用户 / 员工 ----
    def roles(self) -> list[dict]:
        return self._request("GET", "/system/roles") or []

    def search_users(self, keyword: str, page: int = 1, page_size: int = 100) -> dict:
        return self._request("GET", "/system/users", params={
            "keyword": keyword, "page": page, "pageSize": page_size,
        }) or {"list": [], "total": 0, "page": page, "pageSize": page_size}

    def search_employees(self, keyword: str, page: int = 1, page_size: int = 100) -> dict:
        return self._request("GET", "/employees", params={
            "keyword": keyword, "page": page, "pageSize": page_size,
        }) or {"list": [], "total": 0, "page": page, "pageSize": page_size}

    def create_user(self, username: str, password: str, name: str,
                    department_id: int, position_id: int | None = None,
                    role_ids: list[int] | None = None) -> dict:
        payload: dict[str, Any] = {
            "username": username, "password": password, "name": name,
            "departmentId": department_id, "status": "active",
        }
        if position_id is not None:
            payload["positionId"] = position_id
        if role_ids:
            payload["roleIds"] = role_ids
        return self._request("POST", "/system/users", json=payload)

    # ---- 设置 ----
    def password_strength_level(self) -> str | None:
        try:
            data = self._request("GET", "/settings/password_strength_level")
            value = (data or {}).get("value") if isinstance(data, dict) else None
            return value if value in ("weak", "medium", "strong") else None
        except ApiError:
            return None


# ---- 账号生成规则（拼音首字母 + 4 位序号，如 zs0001） ----

def initials_of(name: str) -> str:
    """张三 → zs；欧阳娜娜 → oynn；英文按单词取首字母 Tony Sun → ts；全空 → user。"""
    import re

    from pypinyin import Style, lazy_pinyin
    out = []
    for token in re.findall(r"[A-Za-z0-9]+|\S", name):
        if re.fullmatch(r"[A-Za-z0-9]+", token):
            out.append(token[0].lower())
        else:
            py = lazy_pinyin(token, style=Style.FIRST_LETTER, errors="ignore")
            if py and py[0]:
                out.append(py[0][0].lower())
    return "".join(out) or "user"


def find_exact_name(items: list[dict], name: str, keys: tuple[str, ...]) -> list[dict]:
    """在列表中找姓名精确匹配的条目（keyword 搜索是 contains，需二次过滤）。"""
    return [it for it in items if any((it.get(k) or "") == name for k in keys)]


def iter_keyword_pages(client: LeiXiClient, fetch, keyword: str, max_pages: int = 10):
    """按 keyword 翻页拉取，最多 max_pages 页（每页 100，服务端上限即 100）。"""
    page = 1
    while page <= max_pages:
        data = fetch(keyword, page=page, page_size=100)
        items = data.get("list") or []
        yield items
        total = data.get("total") or 0
        if page * 100 >= total or not items:
            break
        page += 1


def check_name_exists(client: LeiXiClient, name: str) -> dict:
    """重名检查：登录账号 vs 员工档案（keyword 是 contains，需按姓名精确过滤）。"""
    users: list[dict] = []
    employees: list[dict] = []
    for items in iter_keyword_pages(client, client.search_users, name):
        users.extend(find_exact_name(items, name, ("name",)))
    for items in iter_keyword_pages(client, client.search_employees, name):
        employees.extend(find_exact_name(items, name, ("name",)))
    return {"user": users, "employee": employees}


def next_username(client: LeiXiClient, name: str) -> str:
    """拼音首字母 + 现有最大序号 + 1（4 位补零）：zs0001、zs0002…"""
    ini = initials_of(name)
    pat = re.compile(rf"^{re.escape(ini)}(\d+)$", re.IGNORECASE)
    best = 0
    for items in iter_keyword_pages(client, client.search_users, ini):
        for u in items:
            m = pat.match(u.get("username") or "")
            if m:
                best = max(best, int(m.group(1)))
    return f"{ini}{best + 1:04d}"


def default_password(client: LeiXiClient) -> tuple[str, str]:
    """按系统密码强度设置选初始密码，返回 (密码, 采用原因)。"""
    level = client.password_strength_level() or "medium"
    if level == "weak":
        return "123456", "系统密码强度为 weak，使用默认密码 123456"
    if level == "strong":
        return "Lx@123456", "系统密码强度为 strong，使用合规初始密码"
    return "lx123456", "系统密码强度为 medium，使用合规初始密码"
