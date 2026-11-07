# -*- coding: utf-8 -*-
"""离屏渲染两页界面截图，供视觉核对。"""
import os
import sys

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from PySide6.QtCore import Qt
from PySide6.QtGui import QPixmap
from PySide6.QtWidgets import QApplication

import main as app_main
from theme import build_qss


def shot(widget, out, size=None):
    if size:
        widget.resize(*size)
    widget.show()
    app.processEvents()
    app.processEvents()
    pix = QPixmap(widget.size())
    pix.fill(Qt.GlobalColor.white)
    widget.render(pix)
    pix.save(out)
    print("saved", out)


if __name__ == "__main__":
    app = QApplication(sys.argv)
    app.setStyle("Fusion")
    app_main.register_fonts(app)
    app.setStyleSheet(build_qss())

    win = app_main.MainWindow()
    shot(win, os.path.join(os.path.dirname(__file__), "preview_login.png"))

    # 模拟登录后的主界面
    win.client = None
    user = {"username": "admin", "realName": "管理员"}
    depts = [
        {"id": 1, "name": "总经办", "deletedAt": None},
        {"id": 2, "name": "人事部", "deletedAt": None},
        {"id": 3, "name": "生产部", "deletedAt": None},
    ]
    positions = [{"id": 1, "name": "普工"}, {"id": 2, "name": "主管"}]
    win.main_page.populate(user, depts, positions)
    win.stack.setCurrentWidget(win.main_page)
    win.main_page.show_result("张三", "zs0001", "123456", "生产部", "普工")
    from main import set_tip
    set_tip(win.main_page.tip, "初始密码按系统密码强度自动适配：系统密码强度为 weak，使用默认密码 123456", "okTip")
    win.main_page.name_edit.clear()
    for _ in range(4):
        app.processEvents()
    shot(win, os.path.join(os.path.dirname(__file__), "preview_main.png"))

    win.close()
    print("done")
