# -*- coding: utf-8 -*-
"""打包入口：pyinstaller --onefile --windowed --name LeiXiQuickRegister app.py

支持 --selftest：不启界面，只做线上连接自检并写报告到 %TEMP%。
"""
import sys

from main import main


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        from selftest import run_selftest
        sys.exit(run_selftest())
    sys.exit(main())
