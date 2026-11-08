# -*- coding: utf-8 -*-
"""雷犀管理系统 · 快速登记桌面工具。

免登录设计：服务器地址与账号内置（可在「设置」里改），启动自动连接；
输入姓名 + 部门（可输入新部门自动创建）→ 一键创建 → 返回登录账号 + 初始密码，
新账号默认挂「普通员工」角色（角色库 code=staff）。
"""
from __future__ import annotations

import json
import os
import sys
import threading
from datetime import datetime
from urllib.parse import urlparse

from PySide6.QtCore import QObject, Qt, Signal
from PySide6.QtWidgets import (
    QApplication,
    QComboBox,
    QDialog,
    QFrame,
    QGridLayout,
    QHBoxLayout,
    QHeaderView,
    QLabel,
    QLineEdit,
    QMainWindow,
    QMessageBox,
    QPushButton,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)

from api import (
    ApiError,
    LeiXiClient,
    NeedRelogin,
    check_name_exists,
    default_password,
    ensure_weak_password_policy,
    random_username,
)
from theme import app_mark, build_qss

# ---- 内置默认配置（可在「设置」里改，持久化到 ~/.leixi_quick_register.json） ----
DEFAULT_BASE = "https://www.leixidianshang.com/api/v1"
DEFAULT_USERNAME = "admin"
DEFAULT_PASSWORD = "123456"
DEFAULT_ROLE_CODE = "staff"       # 角色库：普通员工
DEFAULT_ROLE_NAME = "普通员工"

CONFIG_PATH = os.path.join(os.path.expanduser("~"), ".leixi_quick_register.json")

HISTORY_COLS = ["时间", "姓名", "登录账号", "初始密码", "部门", "岗位"]


# ---------- 配置持久化 ----------

def load_config() -> dict:
    cfg = {
        "base_url": DEFAULT_BASE,
        "username": DEFAULT_USERNAME,
        "password": DEFAULT_PASSWORD,
    }
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            cfg.update({k: v for k, v in data.items() if k in cfg and v})
    except Exception:
        pass
    return cfg


def save_config(cfg: dict) -> None:
    try:
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(cfg, f, ensure_ascii=False, indent=2)
    except Exception:
        pass


# ---------- 后台任务（线程 + 信号回主线程） ----------

class AsyncTask(QObject):
    ok = Signal(object)
    fail = Signal(str)
    relogin = Signal(str)
    progress = Signal(str)

    def __init__(self, fn, parent=None):
        super().__init__(parent)
        self.fn = fn

    def start(self) -> None:
        threading.Thread(target=self._run, daemon=True).start()

    def _run(self) -> None:
        try:
            result = self.fn(lambda text: self.progress.emit(text))
        except NeedRelogin as e:
            self.relogin.emit(str(e))
        except ApiError as e:
            self.fail.emit(str(e))
        except Exception as e:  # 兜底，不让线程静默死亡
            self.fail.emit(f"未知错误：{e.__class__.__name__}: {e}")
        else:
            self.ok.emit(result)


# ---------- 小工具 ----------

def set_tip(label: QLabel, text: str, kind: str = "errTip") -> None:
    """状态提示条：kind ∈ errTip / okTip / warnTip；text 为空则隐藏。"""
    label.setProperty("class", kind)
    label.setText(text)
    label.setVisible(bool(text))
    label.style().unpolish(label)
    label.style().polish(label)


def card() -> QFrame:
    f = QFrame()
    f.setProperty("class", "card")
    return f


def vwrap(f: QFrame) -> QVBoxLayout:
    lay = QVBoxLayout(f)
    lay.setContentsMargins(20, 18, 20, 18)
    lay.setSpacing(10)
    return lay


# ---------- 设置对话框（连接失败 / 手动切换环境时出现） ----------

class SettingsDialog(QDialog):
    connect_requested = Signal(str, str, str)  # base_url, username, password

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("连接设置")
        self.setFixedWidth(420)
        self._busy = False

        lay = QVBoxLayout(self)
        lay.setContentsMargins(20, 18, 20, 18)
        lay.setSpacing(8)

        head = QHBoxLayout()
        mark = QLabel()
        mark.setPixmap(app_mark(36))
        head.addWidget(mark)
        head.addSpacing(8)
        t = QLabel("连接设置")
        t.setProperty("class", "h2")
        head.addWidget(t)
        head.addStretch(1)
        lay.addLayout(head)

        self.server = QLineEdit()
        self.server.setProperty("site", "1")
        self.username = QLineEdit()
        self.password = QLineEdit()
        self.password.setEchoMode(QLineEdit.EchoMode.Password)
        for text, w in (("服务器地址", self.server),
                        ("账号", self.username),
                        ("密码", self.password)):
            cap = QLabel(text)
            cap.setProperty("class", "field")
            lay.addWidget(cap)
            lay.addWidget(w)

        self.tip = QLabel()
        self.tip.setWordWrap(True)
        self.tip.setVisible(False)
        lay.addWidget(self.tip)

        self.ok_btn = QPushButton("保存并连接")
        self.ok_btn.setProperty("class", "primary")
        self.ok_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        lay.addWidget(self.ok_btn)

        self.ok_btn.clicked.connect(self._emit)
        self.password.returnPressed.connect(self._emit)

    def fill(self, base: str, username: str, password: str) -> None:
        self.server.setText(base)
        self.username.setText(username)
        self.password.setText(password)

    def show_error(self, message: str) -> None:
        self._busy = False
        self.ok_btn.setEnabled(True)
        self.ok_btn.setText("保存并连接")
        set_tip(self.tip, message, "errTip")

    def _emit(self) -> None:
        if self._busy:
            return
        base = self.server.text().strip()
        user = self.username.text().strip()
        pwd = self.password.text()
        if not base or not user or not pwd:
            set_tip(self.tip, "请完整填写服务器地址、账号和密码", "warnTip")
            return
        self._busy = True
        self.ok_btn.setEnabled(False)
        self.ok_btn.setText("连接中…")
        set_tip(self.tip, "")
        self.connect_requested.emit(base, user, pwd)


# ---------- 主操作页 ----------

class MainPage(QWidget):
    create_clicked = Signal(dict)  # {"name","dept_name","dept_new","pos_name","pos_new"}
    settings_clicked = Signal()

    def __init__(self):
        super().__init__()
        root = QVBoxLayout(self)
        root.setContentsMargins(24, 20, 24, 16)
        root.setSpacing(12)

        # 头部
        head = QHBoxLayout()
        title_col = QVBoxLayout()
        title_col.setSpacing(2)
        t = QLabel("快速登记")
        t.setProperty("class", "h1")
        s = QLabel("输入姓名和部门，一键创建登录账号")
        s.setProperty("class", "sub")
        title_col.addWidget(t)
        title_col.addWidget(s)
        head.addLayout(title_col)
        head.addStretch(1)
        self.badge = QLabel()
        self.badge.setProperty("class", "badge")
        head.addWidget(self.badge)
        self.settings_btn = QPushButton("设置")
        self.settings_btn.setProperty("class", "ghost")
        self.settings_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        head.addWidget(self.settings_btn)
        root.addLayout(head)

        # 表单卡
        form = card()
        flay = vwrap(form)
        grid = QGridLayout()
        grid.setHorizontalSpacing(12)
        grid.setVerticalSpacing(8)
        cap_name = QLabel("姓名 *")
        cap_name.setProperty("class", "field")
        cap_dept = QLabel("部门 *（可输入新部门名）")
        cap_dept.setProperty("class", "field")
        cap_pos = QLabel("岗位（可留空 / 输入新建）")
        cap_pos.setProperty("class", "field")
        self.name_edit = QLineEdit()
        self.name_edit.setPlaceholderText("例如：张三")
        self.dept_combo = QComboBox()
        self.dept_combo.setEditable(True)
        self.dept_combo.setInsertPolicy(QComboBox.InsertPolicy.NoInsert)
        self.pos_combo = QComboBox()
        self.pos_combo.setEditable(True)
        self.pos_combo.setInsertPolicy(QComboBox.InsertPolicy.NoInsert)
        grid.addWidget(cap_name, 0, 0)
        grid.addWidget(cap_dept, 0, 1)
        grid.addWidget(self.name_edit, 1, 0)
        grid.addWidget(self.dept_combo, 1, 1)
        grid.addWidget(cap_pos, 2, 0)
        grid.addWidget(self.pos_combo, 3, 0, 1, 2)
        flay.addLayout(grid)

        self.tip = QLabel()
        self.tip.setWordWrap(True)
        self.tip.setVisible(False)
        flay.addWidget(self.tip)

        self.create_btn = QPushButton("创建账号（默认「普通员工」角色）")
        self.create_btn.setProperty("class", "primary")
        self.create_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        flay.addWidget(self.create_btn)
        root.addWidget(form)

        # 结果卡（默认隐藏）
        self.result = card()
        rlay = vwrap(self.result)
        head_r = QHBoxLayout()
        rt = QLabel("创建成功")
        rt.setProperty("class", "h2")
        head_r.addWidget(rt)
        head_r.addStretch(1)
        self.copy_btn = QPushButton("复制账号信息")
        self.copy_btn.setProperty("class", "ghost")
        self.copy_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        head_r.addWidget(self.copy_btn)
        rlay.addLayout(head_r)

        rg = QGridLayout()
        rg.setHorizontalSpacing(12)
        for col, cap in enumerate(("姓名", "登录账号", "初始密码")):
            c = QLabel(cap)
            c.setProperty("class", "field")
            rg.addWidget(c, 0, col)
        self.v_name = QLabel()
        self.v_user = QLabel()
        self.v_pwd = QLabel()
        for col, w in enumerate((self.v_name, self.v_user, self.v_pwd)):
            w.setProperty("class", "value")
            w.setTextInteractionFlags(Qt.TextInteractionFlag.TextSelectableByMouse)
            rg.addWidget(w, 1, col)
        rlay.addLayout(rg)
        self.result.setVisible(False)
        root.addWidget(self.result)

        # 历史记录卡
        hist = card()
        hlay = vwrap(hist)
        hh = QHBoxLayout()
        ht = QLabel("本次已登记")
        ht.setProperty("class", "h2")
        hh.addWidget(ht)
        hh.addStretch(1)
        self.clear_btn = QPushButton("清空")
        self.clear_btn.setProperty("class", "ghost")
        self.clear_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        hh.addWidget(self.clear_btn)
        hlay.addLayout(hh)

        self.table = QTableWidget(0, len(HISTORY_COLS))
        self.table.setHorizontalHeaderLabels(HISTORY_COLS)
        self.table.verticalHeader().setVisible(False)
        self.table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        self.table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        header = self.table.horizontalHeader()
        header.setSectionResizeMode(QHeaderView.ResizeMode.Interactive)
        header.setStretchLastSection(True)
        hlay.addWidget(self.table)
        root.addWidget(hist, 1)

        # 信号
        self.create_btn.clicked.connect(self._on_create)
        self.name_edit.returnPressed.connect(self._on_create)
        self.copy_btn.clicked.connect(self._copy_result)
        self.clear_btn.clicked.connect(lambda: self.table.setRowCount(0))
        self.settings_btn.clicked.connect(self.settings_clicked)

    # ---- 数据填充 ----
    def populate(self, host: str, username: str, depts: list[dict], positions: list[dict]) -> None:
        self.badge.setText(f"{host} · {username}")
        self.dept_combo.clear()
        for d in depts:
            if not d.get("deletedAt"):
                self.dept_combo.addItem(d["name"], d["id"])
        self.pos_combo.clear()
        self.pos_combo.addItem("", None)
        for p in positions:
            self.pos_combo.addItem(p["name"], p["id"])

    def set_busy(self, busy: bool, text: str = "创建账号（默认「普通员工」角色）") -> None:
        self.create_btn.setEnabled(not busy)
        self.create_btn.setText(text)

    # ---- 交互 ----
    def _on_create(self) -> None:
        if not self.create_btn.isEnabled():
            return
        name = self.name_edit.text().strip()
        dept_name = self.dept_combo.currentText().strip()
        pos_name = self.pos_combo.currentText().strip()
        if not name:
            set_tip(self.tip, "请输入姓名", "warnTip")
            self.name_edit.setFocus()
            return
        if not dept_name:
            set_tip(self.tip, "请选择或输入部门", "warnTip")
            self.dept_combo.setFocus()
            return
        dept_new = self.dept_combo.findText(dept_name) < 0
        pos_new = bool(pos_name) and self.pos_combo.findText(pos_name) < 0
        if dept_new or pos_new:
            miss = []
            if dept_new:
                miss.append(f"部门「{dept_name}」")
            if pos_new:
                miss.append(f"岗位「{pos_name}」")
            box = QMessageBox(self)
            box.setIcon(QMessageBox.Icon.Question)
            box.setWindowTitle("确认创建")
            box.setText(f"{'、'.join(miss)} 尚不存在，是否自动创建？")
            box.setStandardButtons(QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No)
            if box.exec() != QMessageBox.StandardButton.Yes:
                return
        set_tip(self.tip, "")
        self.set_busy(True, "创建中…")
        self.create_clicked.emit({
            "name": name, "dept_name": dept_name, "dept_new": dept_new,
            "pos_name": pos_name or None, "pos_new": pos_new,
        })

    def _copy_result(self) -> None:
        text = (
            f"姓名：{self.v_name.text()}\n"
            f"登录账号：{self.v_user.text()}\n"
            f"初始密码：{self.v_pwd.text()}"
        )
        QApplication.clipboard().setText(text)
        self.copy_btn.setText("已复制 ✓")

    def show_result(self, name: str, username: str, password: str, dept: str, pos: str) -> None:
        self.v_name.setText(name)
        self.v_user.setText(username)
        self.v_pwd.setText(password)
        self.result.setVisible(True)
        self.copy_btn.setText("复制账号信息")
        row = self.table.rowCount()
        self.table.insertRow(row)
        now = datetime.now().strftime("%m-%d %H:%M")
        for col, val in enumerate((now, name, username, password, dept, pos or "—")):
            self.table.setItem(row, col, QTableWidgetItem(val))
        self.table.resizeColumnsToContents()
        self.table.setColumnWidth(5, 120)

    def clear_name(self) -> None:
        self.name_edit.clear()
        self.name_edit.setFocus()


# ---------- 主窗口 ----------

class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("雷犀 · 快速登记")
        self.resize(660, 840)
        self.setMinimumSize(620, 760)

        self.cfg = load_config()
        self.client: LeiXiClient | None = None
        self.role_id: int | None = None
        self.depts: list[dict] = []
        self.settings_dialog: SettingsDialog | None = None
        self.connected = False

        self.main_page = MainPage()
        self.setCentralWidget(self.main_page)

        self.main_page.create_clicked.connect(self._create)
        self.main_page.settings_clicked.connect(self._open_settings)

        # 启动即自动连接（免登录）；LEIXI_QR_NO_AUTOCONNECT=1 供离屏测试跳过
        if os.environ.get("LEIXI_QR_NO_AUTOCONNECT") != "1":
            self.main_page.set_busy(True, "正在连接服务器…")
            self._connect(self.cfg["base_url"], self.cfg["username"], self.cfg["password"])

    # ---- 连接（启动 / 设置对话框共用） ----
    def _connect(self, base: str, username: str, password: str,
                 dialog: SettingsDialog | None = None) -> None:
        def fn(report):
            report("登录中…")
            client = LeiXiClient(base)
            client.login(username, password)
            report("加载部门与岗位…")
            depts = client.departments()
            try:
                positions = client.positions()
            except ApiError:
                positions = []  # 无岗位管理权限不阻断登记
            report("解析默认角色…")
            role_id = None
            try:
                for r in client.roles():
                    if r.get("code") == DEFAULT_ROLE_CODE or r.get("name") == DEFAULT_ROLE_NAME:
                        role_id = r["id"]
                        break
            except ApiError:
                pass  # 无角色查看权限时跳过，仅影响新账号默认角色
            report("确认密码策略…")
            policy = ensure_weak_password_policy(client)
            return client, depts, positions, role_id, policy

        task = AsyncTask(fn, self)
        task.progress.connect(lambda t: self._on_connect_progress(t, dialog))
        task.ok.connect(lambda result, d=dialog: self._on_connect_ok(result, base, username, password, d))
        task.fail.connect(lambda msg, d=dialog: self._on_connect_fail(msg, d))
        task.relogin.connect(lambda msg, d=dialog: self._on_connect_fail(msg, d))
        task.start()

    def _on_connect_progress(self, text: str, dialog: SettingsDialog | None) -> None:
        if dialog:
            set_tip(dialog.tip, text, "warnTip")

    def _on_connect_ok(self, result, base: str, username: str, password: str,
                       dialog: SettingsDialog | None) -> None:
        self.client, self.depts, positions, self.role_id, policy = result
        self.cfg.update({"base_url": base, "username": username, "password": password})
        save_config(self.cfg)
        self.connected = True
        host = urlparse(base).netloc or base
        role_note = "" if self.role_id else "（未找到「普通员工」角色，新账号将不挂角色）"
        self.main_page.populate(host, username, self.depts, positions)
        self.main_page.set_busy(False)
        self.main_page.result.setVisible(False)
        policy_note = "" if policy.startswith("weak") else f"；密码策略异常：{policy}（123456 可能被拒）"
        set_tip(self.main_page.tip,
                f"已连接 {host}，默认角色已就绪，密码策略 {policy}{role_note}{policy_note}", "okTip")
        if dialog:
            dialog.accept()
            self.settings_dialog = None
        self.main_page.name_edit.setFocus()

    def _on_connect_fail(self, message: str, dialog: SettingsDialog | None) -> None:
        self.connected = False
        self.main_page.set_busy(True, "未连接 · 请在设置里检查服务器与账号")
        if dialog:
            dialog.show_error(message)
        else:
            self._open_settings(error=message)

    # ---- 设置 ----
    def _open_settings(self, error: str | None = None) -> None:
        if self.settings_dialog is None:
            self.settings_dialog = SettingsDialog(self)
            self.settings_dialog.connect_requested.connect(
                lambda b, u, p: self._connect(b, u, p, self.settings_dialog))
        self.settings_dialog.fill(self.cfg["base_url"], self.cfg["username"], self.cfg["password"])
        if error:
            set_tip(self.settings_dialog.tip, error, "errTip")
        else:
            set_tip(self.settings_dialog.tip, "")
        self.settings_dialog.show()
        self.settings_dialog.raise_()

    # ---- 创建 ----
    def _create(self, payload: dict) -> None:
        client = self.client
        assert client is not None

        def fn(report):
            # 1. 部门 / 岗位自动创建
            dept_id = self._resolve_or_create(client, report, payload["dept_name"],
                                              payload["dept_new"], self.depts,
                                              client.create_department, self.main_page.dept_combo)
            pos_id = None
            if payload["pos_name"]:
                pos_id = self._resolve_or_create(client, report, payload["pos_name"],
                                                 payload["pos_new"], None,
                                                 client.create_position, self.main_page.pos_combo)

            # 2. 重名检查
            report(f"检查「{payload['name']}」是否已存在…")
            dup = check_name_exists(client, payload["name"])
            if dup["user"] or dup["employee"]:
                lines = []
                for u in dup["user"][:3]:
                    lines.append(f"已有登录账号 {u.get('username')}（{u.get('name')}）")
                for e in dup["employee"][:3]:
                    lines.append(f"已有员工档案 工号 {e.get('employeeNo')}")
                raise ApiError("该姓名已存在：" + "；".join(lines), code=-1)

            # 3. 生成账号与密码
            report("生成登录账号…")
            username = random_username(client, payload["name"])
            password, pwd_reason = default_password()

            # 4. 创建（默认挂「普通员工」角色）
            report(f"创建账号 {username}…")
            role_ids = [self.role_id] if self.role_id else None
            created = client.create_user(username, password, payload["name"],
                                         dept_id, pos_id, role_ids)
            return {
                "name": payload["name"],
                "username": created.get("username", username),
                "password": password,
                "pwd_reason": pwd_reason,
                "dept": payload["dept_name"],
                "pos": payload["pos_name"] or "",
            }

        task = AsyncTask(fn, self)
        task.progress.connect(lambda t: set_tip(self.main_page.tip, t, "warnTip"))
        task.ok.connect(self._on_create_ok)
        task.fail.connect(self._on_create_fail)
        task.relogin.connect(self._on_session_expired)
        task.start()

    def _resolve_or_create(self, client, report, name: str, is_new: bool,
                           cache: list[dict] | None, create_fn, combo: QComboBox) -> int:
        if is_new:
            report(f"创建{'部门' if cache is not None else '岗位'}「{name}」…")
            created = create_fn(name)
            if cache is not None:
                cache.append({**created, "deletedAt": None})
            if combo.findText(name) < 0:
                combo.addItem(name, created.get("id"))
            return created["id"]
        idx = combo.findText(name)
        return combo.itemData(idx)

    def _on_create_ok(self, result: dict) -> None:
        self.main_page.set_busy(False)
        set_tip(self.main_page.tip, "")
        self.main_page.show_result(result["name"], result["username"],
                                   result["password"], result["dept"], result["pos"])
        set_tip(self.main_page.tip,
                f"初始密码按系统密码强度自动适配：{result['pwd_reason']}", "okTip")
        self.main_page.clear_name()

    def _on_create_fail(self, message: str) -> None:
        self.main_page.set_busy(False)
        kind = "warnTip" if message.startswith("该姓名已存在") else "errTip"
        set_tip(self.main_page.tip, message, kind)
        if kind == "warnTip":
            QMessageBox.information(self, "已存在", message)

    def _on_session_expired(self, message: str) -> None:
        """会话过期：用内置配置静默重连，成功后界面提示「已连接」，用户再点一次创建即可。"""
        self.main_page.set_busy(False)
        self.connected = False
        set_tip(self.main_page.tip, "会话已过期，正在自动重新登录…", "warnTip")
        self._connect(self.cfg["base_url"], self.cfg["username"], self.cfg["password"])


def register_fonts(app: QApplication) -> None:
    """offscreen 渲染（无桌面环境）时系统字体库为空，手动注册中文字体。"""
    from PySide6.QtGui import QFontDatabase
    for f in ("C:/Windows/Fonts/msyh.ttc", "C:/Windows/Fonts/msyhbd.ttc",
              "C:/Windows/Fonts/simhei.ttf"):
        if os.path.isfile(f):
            QFontDatabase.addApplicationFont(f)


def main() -> int:
    app = QApplication(sys.argv)
    app.setStyle("Fusion")
    app.setApplicationName("LeiXiQuickRegister")
    from PySide6.QtGui import QFont
    app.setFont(QFont("Microsoft YaHei UI", 9))
    app.setStyleSheet(build_qss())

    win = MainWindow()
    win.show()
    return app.exec()


if __name__ == "__main__":
    sys.exit(main())
