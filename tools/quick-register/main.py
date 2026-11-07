# -*- coding: utf-8 -*-
"""雷犀管理系统 · 快速登记桌面工具。

流程：登录管理员账号 → 输入姓名 + 部门（可输入新部门自动创建）→ 一键创建
→ 返回登录账号 + 初始密码（按系统密码强度智能适配）。
"""
from __future__ import annotations

import json
import os
import sys
import threading
from datetime import datetime

from PySide6.QtCore import QObject, Qt, Signal
from PySide6.QtWidgets import (
    QApplication,
    QComboBox,
    QFrame,
    QGridLayout,
    QHBoxLayout,
    QHeaderView,
    QLabel,
    QLineEdit,
    QMainWindow,
    QMessageBox,
    QPushButton,
    QStackedWidget,
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
    next_username,
)
from theme import app_mark, build_qss

CONFIG_PATH = os.path.join(os.path.expanduser("~"), ".leixi_quick_register.json")

HISTORY_COLS = ["时间", "姓名", "登录账号", "初始密码", "部门", "岗位"]


# ---------- 配置持久化 ----------

def load_config() -> dict:
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


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


# ---------- 登录页 ----------

class LoginPage(QWidget):
    submitted = Signal(str, str, str)  # base_url, username, password

    def __init__(self):
        super().__init__()
        root = QVBoxLayout(self)
        root.setAlignment(Qt.AlignmentFlag.AlignCenter)

        box = card()
        box.setFixedWidth(400)
        lay = vwrap(box)
        lay.setSpacing(8)

        top = QHBoxLayout()
        mark = QLabel()
        mark.setPixmap(app_mark(44))
        mark.setFixedSize(44, 44)
        title_col = QVBoxLayout()
        title_col.setSpacing(2)
        t1 = QLabel("雷犀管理系统")
        t1.setProperty("class", "h1")
        t2 = QLabel("员工快速登记工具")
        t2.setProperty("class", "sub")
        title_col.addWidget(t1)
        title_col.addWidget(t2)
        top.addWidget(mark)
        top.addSpacing(10)
        top.addLayout(title_col)
        top.addStretch(1)
        lay.addLayout(top)
        lay.addSpacing(10)

        self.server = QLineEdit()
        self.server.setPlaceholderText("http://localhost:4001/api/v1")
        self.server.setProperty("site", "1")
        self.username = QLineEdit()
        self.username.setPlaceholderText("admin")
        self.password = QLineEdit()
        self.password.setEchoMode(QLineEdit.EchoMode.Password)

        # 标签与输入框成对添加，保证视觉分组
        for text, w in (("服务器地址", self.server),
                        ("管理员账号", self.username),
                        ("密码", self.password)):
            cap = QLabel(text)
            cap.setProperty("class", "field")
            lay.addWidget(cap)
            lay.addWidget(w)
        lay.addSpacing(6)

        self.tip = QLabel()
        self.tip.setWordWrap(True)
        self.tip.setVisible(False)
        lay.addWidget(self.tip)

        self.login_btn = QPushButton("登 录")
        self.login_btn.setProperty("class", "primary")
        self.login_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        lay.addWidget(self.login_btn)
        lay.addSpacing(4)

        hint = QLabel("需要具备「系统用户管理 + 部门管理」权限的账号")
        hint.setProperty("class", "muted")
        hint.setAlignment(Qt.AlignmentFlag.AlignCenter)
        lay.addWidget(hint)

        root.addWidget(box)

        self.login_btn.clicked.connect(self._emit)
        self.password.returnPressed.connect(self._emit)

    def _emit(self) -> None:
        base = self.server.text().strip() or "http://localhost:4001/api/v1"
        user = self.username.text().strip()
        pwd = self.password.text()
        if not user or not pwd:
            set_tip(self.tip, "请输入账号和密码", "warnTip")
            return
        self.login_btn.setEnabled(False)
        self.login_btn.setText("登录中…")
        self.submitted.emit(base, user, pwd)

    def reset(self) -> None:
        self.login_btn.setEnabled(True)
        self.login_btn.setText("登 录")


# ---------- 主操作页 ----------

class MainPage(QWidget):
    create_clicked = Signal(dict)  # {"name","dept_name","dept_new","pos_name","pos_new"}

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
        self.logout_btn = QPushButton("退出登录")
        self.logout_btn.setProperty("class", "ghost")
        self.logout_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        head.addWidget(self.logout_btn)
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

        self.create_btn = QPushButton("创建账号")
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
        self.table.setAlternatingRowColors(False)
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

    # ---- 数据填充 ----
    def populate(self, user: dict, depts: list[dict], positions: list[dict]) -> None:
        self.badge.setText(f"{user.get('realName') or user.get('username')}（{user.get('username')}）")
        self.dept_combo.clear()
        for d in depts:
            if not d.get("deletedAt"):
                self.dept_combo.addItem(d["name"], d["id"])
        self.pos_combo.clear()
        self.pos_combo.addItem("", None)
        for p in positions:
            self.pos_combo.addItem(p["name"], p["id"])

    def set_busy(self, busy: bool, text: str = "创建账号") -> None:
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

        self.client: LeiXiClient | None = None
        self.depts: list[dict] = []

        self.stack = QStackedWidget()
        self.setCentralWidget(self.stack)
        self.login_page = LoginPage()
        self.main_page = MainPage()
        self.stack.addWidget(self.login_page)
        self.stack.addWidget(self.main_page)

        cfg = load_config()
        self.login_page.server.setText(cfg.get("base_url", ""))
        self.login_page.username.setText(cfg.get("username", ""))

        # 登录页
        self.login_page.submitted.connect(self._login)
        # 主页
        self.main_page.create_clicked.connect(self._create)
        self.main_page.logout_btn.clicked.connect(self._logout)

    # ---- 登录 ----
    def _login(self, base: str, username: str, password: str) -> None:
        set_tip(self.login_page.tip, "正在连接服务器…", "warnTip")

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
            return client, depts, positions

        task = AsyncTask(fn, self)
        task.progress.connect(lambda t: set_tip(self.login_page.tip, t, "warnTip"))
        task.ok.connect(self._on_login_ok)
        task.fail.connect(self._on_login_fail)
        task.relogin.connect(lambda m: self._on_login_fail(m))
        task.start()

    def _on_login_ok(self, result) -> None:
        self.client, self.depts, positions = result
        save_config({
            "base_url": self.client.base,
            "username": self.client.user.get("username", ""),
        })
        set_tip(self.login_page.tip, "")
        self.login_page.reset()
        self.login_page.password.clear()
        self.main_page.populate(self.client.user or {}, self.depts, positions)
        self.main_page.result.setVisible(False)
        set_tip(self.main_page.tip, "")
        self.stack.setCurrentWidget(self.main_page)
        self.main_page.name_edit.setFocus()

    def _on_login_fail(self, message: str) -> None:
        self.login_page.reset()
        set_tip(self.login_page.tip, message, "errTip")

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
            username = next_username(client, payload["name"])
            password, pwd_reason = default_password(client)

            # 4. 创建
            report(f"创建账号 {username}…")
            created = client.create_user(username, password, payload["name"],
                                         dept_id, pos_id)
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
        task.relogin.connect(self._on_relogin)
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

    def _on_relogin(self, message: str) -> None:
        self.main_page.set_busy(False)
        self._logout_silent()
        set_tip(self.login_page.tip, message, "errTip")
        self.stack.setCurrentWidget(self.login_page)

    # ---- 退出 ----
    def _logout(self) -> None:
        self._logout_silent()
        self.stack.setCurrentWidget(self.login_page)
        self.login_page.password.setFocus()

    def _logout_silent(self) -> None:
        if self.client:
            self.client.logout()
        self.client = None
        self.login_page.reset()


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
