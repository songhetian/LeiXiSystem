# -*- coding: utf-8 -*-
"""设计系统：token / 自绘图标 / QSS（与业务解耦，界面文件只 import 这里的产物）。"""
from __future__ import annotations

import os
import tempfile

from PySide6.QtCore import QPointF, Qt
from PySide6.QtGui import QColor, QLinearGradient, QPainter, QPen, QPixmap
from PySide6.QtWidgets import QStyledItemDelegate

# ---- token（冷灰调） ----
BG = "#F4F6FB"; CARD = "#FFFFFF"; CARD_SOFT = "#FAFBFE"
LINE = "#E6EBF4"; LINE_HOVER = "#C9D6EC"; LINE_SOFT = "#EEF2F9"
INK = "#18202C"; INK_2 = "#48566B"; SUB = "#75839A"; MUTED = "#9BA8BA"
PRIMARY = "#2F6FED"; PRIMARY_DK = "#1F5FD8"; PRIMARY_LT = "#5B8FF5"
PRIMARY_TINT = "#EDF3FE"; PRIMARY_TINT_2 = "#F5F9FF"
OK = "#16A34A"; OK_TINT = "#EAF7EF"
WARN = "#B45309"; WARN_TINT = "#FFFBF2"
ERR = "#DC2626"; ERR_TINT = "#FDF0EF"
RADIUS_SM = 7; RADIUS = 10; RADIUS_LG = 14; CTRL_H = 36
FONT_STACK = '"Microsoft YaHei UI","Microsoft YaHei","PingFang SC","Segoe UI",sans-serif'

_ICON_DIR = os.path.join(tempfile.gettempdir(), "LeiXiQuickRegister")


def _stroke_png(path: str, pts, color: str, stroke: float, size: int, scale: int = 2) -> None:
    """归一化折线(0..1) → 抗锯齿 PNG。2× 渲染更锐利。"""
    d = int(size * scale)
    pm = QPixmap(d, d)
    pm.fill(Qt.GlobalColor.transparent)
    p = QPainter(pm)
    p.setRenderHint(QPainter.RenderHint.Antialiasing, True)
    pen = QPen(QColor(color))
    pen.setWidthF(stroke * scale)
    pen.setCapStyle(Qt.PenCapStyle.RoundCap)
    pen.setJoinStyle(Qt.PenJoinStyle.RoundJoin)
    p.setPen(pen)
    poly = [QPointF(x * d, y * d) for (x, y) in pts]
    for i in range(len(poly) - 1):
        p.drawLine(poly[i], poly[i + 1])
    p.end()
    pm.save(path, "PNG")


def ensure_icons() -> dict[str, str]:
    """自绘下拉箭头 / 勾选标记。QApplication 创建后才可调用。"""
    os.makedirs(_ICON_DIR, exist_ok=True)
    paths = {
        "chev": os.path.join(_ICON_DIR, "chev.png"),
        "chev_hover": os.path.join(_ICON_DIR, "chev_hover.png"),
        "chev_muted": os.path.join(_ICON_DIR, "chev_muted.png"),
        "check": os.path.join(_ICON_DIR, "check.png"),
    }
    if not os.path.exists(paths["chev"]):
        _stroke_png(paths["chev"], [(0.30, 0.415), (0.50, 0.615), (0.70, 0.415)], SUB, 1.8, 16)
        _stroke_png(paths["chev_hover"], [(0.30, 0.415), (0.50, 0.615), (0.70, 0.415)], PRIMARY, 1.8, 16)
        _stroke_png(paths["chev_muted"], [(0.30, 0.415), (0.50, 0.615), (0.70, 0.415)], MUTED, 1.8, 16)
        _stroke_png(paths["check"], [(0.235, 0.520), (0.425, 0.712), (0.775, 0.300)], "#FFFFFF", 2.2, 18)
    return paths


def app_mark(size: int = 44) -> QPixmap:
    """应用标识：圆角方底 + 三条横杠（名册/工时表意象），纯几何。"""
    scale = 2
    d = size * scale
    pm = QPixmap(d, d)
    pm.fill(Qt.GlobalColor.transparent)
    p = QPainter(pm)
    p.setRenderHint(QPainter.RenderHint.Antialiasing, True)
    grad = QLinearGradient(0, 0, 0, d)
    grad.setColorAt(0.0, QColor(PRIMARY_LT))
    grad.setColorAt(1.0, QColor(PRIMARY_DK))
    p.setPen(Qt.PenStyle.NoPen)
    p.setBrush(grad)
    p.drawRoundedRect(0, 0, d, d, int(d * 0.24), int(d * 0.24))
    pen = QPen(QColor("#FFFFFF"))
    pen.setWidthF(2.6 * scale / 2)
    pen.setCapStyle(Qt.PenCapStyle.RoundCap)
    p.setPen(pen)
    for i, y in enumerate((0.32, 0.50, 0.68)):
        w = 0.42 if i < 2 else 0.26
        p.drawLine(QPointF(0.29 * d, y * d), QPointF((0.29 + w) * d, y * d))
    p.end()
    return pm


class PillItemDelegate(QStyledItemDelegate):
    """下拉列表项自绘代理：圆角药丸高亮 + 主色文字（QSS 改不动 item 行高，必须 delegate）。"""

    ROW_H = 32
    INSET_X = 6
    INSET_Y = 2
    TEXT_PAD_L = 11

    def sizeHint(self, option, index):  # noqa: N802 (Qt 命名)
        s = super().sizeHint(option, index)
        s.setHeight(self.ROW_H)
        return s

    def paint(self, painter: QPainter, option, index) -> None:
        rect = option.rect.adjusted(self.INSET_X, self.INSET_Y, -self.INSET_X, -self.INSET_Y)
        selected = bool(option.state & 0x8000)  # QStyle.StateFlag.State_Selected
        hovered = bool(option.state & 0x20000)  # QStyle.StateFlag.State_MouseOver
        painter.save()
        painter.setRenderHint(QPainter.RenderHint.Antialiasing, True)
        if selected or hovered:
            painter.setPen(Qt.PenStyle.NoPen)
            painter.setBrush(QColor(PRIMARY_TINT if selected else PRIMARY_TINT_2))
            painter.drawRoundedRect(rect, RADIUS_SM, RADIUS_SM)
        text = index.data(Qt.ItemDataRole.DisplayRole) or ""
        painter.setPen(QColor(PRIMARY_DK if selected else INK))
        f = option.font
        f.setBold(selected)
        painter.setFont(f)
        text_rect = rect.adjusted(self.TEXT_PAD_L, 0, -8, 0)
        painter.drawText(text_rect, Qt.AlignmentFlag.AlignVCenter | Qt.AlignmentFlag.AlignLeft, text)
        painter.restore()


def build_qss() -> str:
    icons = ensure_icons()
    chev = icons["chev"].replace("\\", "/")
    chev_hover = icons["chev_hover"].replace("\\", "/")
    chev_muted = icons["chev_muted"].replace("\\", "/")
    check = icons["check"].replace("\\", "/")

    return f"""
* {{
    font-family: {FONT_STACK};
    outline: none;
}}
QMainWindow, QDialog {{ background: {BG}; }}
QWidget {{ color: {INK}; font-size: 12.5px; }}

/* ---- 卡片 ---- */
QFrame[class="card"] {{
    background: {CARD};
    border: 1px solid {LINE};
    border-radius: {RADIUS_LG}px;
}}
QFrame[class="cardSoft"] {{
    background: {CARD_SOFT};
    border: 1px solid {LINE_SOFT};
    border-radius: {RADIUS}px;
}}

/* ---- 输入控件 ---- */
QLineEdit, QComboBox {{
    background: #FFFFFF;
    border: 1px solid {LINE};
    border-radius: {RADIUS}px;
    padding: 0 12px;
    min-height: {CTRL_H}px;
    font-size: 12.5px;
    color: {INK};
}}
QLineEdit:hover, QComboBox:hover {{ border-color: {LINE_HOVER}; }}
QLineEdit:focus, QComboBox:focus {{ border-color: {PRIMARY}; }}
QLineEdit:disabled, QComboBox:disabled {{ background: {LINE_SOFT}; color: {MUTED}; }}
QLineEdit[site="1"] {{ font-family: "Consolas","Courier New",monospace; }}

/* 下拉：容器圆角 + 箭头贴右（subcontrol 必须 top right，center 会被解析成水平居中） */
QComboBox::drop-down {{ subcontrol-position: top right; width: 30px; border: none; background: transparent; }}
QComboBox::down-arrow {{ image: url("{chev}"); width: 16px; height: 16px; }}
QComboBox::drop-down:hover {{ background: transparent; }}
QComboBox::drop-down:hover::down-arrow {{ image: url("{chev_hover}"); }}
QComboBox::drop-down:disabled::down-arrow {{ image: url("{chev_muted}"); }}
QComboBoxPrivateContainer {{
    border: 1px solid {LINE};
    border-radius: {RADIUS}px;
    background: #FFFFFF;
}}
QComboBox QAbstractItemView {{
    border: none;
    background: transparent;
    padding: 5px 0px;
    outline: 0;
    selection-background-color: {PRIMARY_TINT};
    selection-color: {PRIMARY_DK};
}}

/* ---- 按钮 ---- */
QPushButton {{
    background: #FFFFFF;
    border: 1px solid {LINE};
    border-radius: {RADIUS}px;
    min-height: {CTRL_H}px;
    padding: 0 18px;
    font-size: 12.5px;
    color: {INK_2};
}}
QPushButton:hover {{ border-color: {LINE_HOVER}; background: {PRIMARY_TINT_2}; color: {INK}; }}
QPushButton:pressed {{ background: {PRIMARY_TINT}; }}
QPushButton:disabled {{ color: {MUTED}; background: {LINE_SOFT}; border-color: {LINE_SOFT}; }}

QPushButton[class="primary"] {{
    background: qlineargradient(x1:0,y1:0,x2:0,y2:1, stop:0 {PRIMARY_LT}, stop:1 {PRIMARY});
    border: 1px solid {PRIMARY_DK};
    color: #FFFFFF;
    font-weight: 600;
}}
QPushButton[class="primary"]:hover {{
    background: qlineargradient(x1:0,y1:0,x2:0,y2:1, stop:0 {PRIMARY}, stop:1 {PRIMARY_DK});
    color: #FFFFFF;
}}
QPushButton[class="primary"]:pressed {{ background: {PRIMARY_DK}; color: #FFFFFF; }}
QPushButton[class="primary"]:disabled {{ background: {MUTED}; border-color: {MUTED}; color: #FFFFFF; }}

QPushButton[class="ghost"] {{
    border: none;
    background: transparent;
    color: {SUB};
    min-height: 26px;
    padding: 0 8px;
}}
QPushButton[class="ghost"]:hover {{ color: {PRIMARY}; background: transparent; }}

/* ---- 文本 ---- */
QLabel[class="h1"] {{ font-size: 19px; font-weight: 700; color: {INK}; }}
QLabel[class="h2"] {{ font-size: 13.5px; font-weight: 600; color: {INK}; }}
QLabel[class="field"] {{ font-size: 12px; color: {INK_2}; font-weight: 600; }}
QLabel[class="sub"] {{ font-size: 11.5px; color: {SUB}; }}
QLabel[class="muted"] {{ font-size: 11px; color: {MUTED}; }}
QLabel[class="badge"] {{
    background: {PRIMARY_TINT};
    color: {PRIMARY_DK};
    border-radius: 12px;
    padding: 3px 12px;
    font-size: 11.5px;
    font-weight: 600;
}}
QLabel[class="okTip"] {{ background: {OK_TINT}; color: {OK}; border-radius: {RADIUS_SM}px; padding: 8px 12px; font-weight: 600; }}
QLabel[class="errTip"] {{ background: {ERR_TINT}; color: {ERR}; border-radius: {RADIUS_SM}px; padding: 8px 12px; }}
QLabel[class="warnTip"] {{ background: {WARN_TINT}; color: {WARN}; border-radius: {RADIUS_SM}px; padding: 8px 12px; }}

/* ---- 结果值（mono） ---- */
QLabel[class="value"] {{
    background: {CARD_SOFT};
    border: 1px solid {LINE_SOFT};
    border-radius: {RADIUS_SM}px;
    padding: 6px 10px;
    font-family: "Consolas","Courier New",monospace;
    font-size: 13px;
    color: {INK};
    font-weight: 600;
}}

/* ---- 表格 ---- */
QTableWidget {{
    background: #FFFFFF;
    border: 1px solid {LINE_SOFT};
    border-radius: {RADIUS_SM}px;
    gridline-color: {LINE_SOFT};
    selection-background-color: {PRIMARY_TINT};
    selection-color: {INK};
    font-size: 12px;
}}
QTableWidget::item {{ padding: 4px 8px; min-height: 28px; }}
QHeaderView::section {{
    background: {CARD_SOFT};
    color: {SUB};
    border: none;
    border-bottom: 1px solid {LINE};
    padding: 7px 8px;
    font-size: 11.5px;
    font-weight: 600;
}}
QTableCornerButton::section {{ background: {CARD_SOFT}; border: none; }}

/* ---- 滚动条 ---- */
QScrollBar:vertical {{ background: transparent; width: 8px; margin: 2px; }}
QScrollBar::handle:vertical {{ background: {LINE_HOVER}; border-radius: 4px; min-height: 32px; }}
QScrollBar::handle:vertical:hover {{ background: {MUTED}; }}
QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {{ height: 0; }}

QStatusBar {{ background: transparent; color: {MUTED}; font-size: 11px; }}
"""
