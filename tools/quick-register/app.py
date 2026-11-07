# -*- coding: utf-8 -*-
"""打包入口：pyinstaller --onefile --windowed --name LeiXiQuickRegister app.py"""
import sys

from main import main

if __name__ == "__main__":
    sys.exit(main())
