"""Locate a jsdom installation for DOM-based tests.

jsdom 的安装位置因机器而异（直装、WSL 跨盘、其他 agent 工具的缓存），
所以这里按「环境变量 → 当前用户目录 → 常见跨界位置」的顺序探测，
不硬编码任何用户名或绝对路径。

覆盖方式：设置环境变量 ``JSDOM_PATH`` 指向 node_modules/jsdom 目录。
"""

from __future__ import annotations

import os
from pathlib import Path

# .workbuddy 托管 Node 时 node_modules 的相对位置
_REL = ".workbuddy/binaries/node/workspace/node_modules/jsdom"


def candidates() -> list[Path]:
    """按优先级返回候选路径（不保证存在）。"""
    out: list[Path] = []

    env = os.environ.get("JSDOM_PATH")
    if env:
        out.append(Path(env))

    # 当前用户的直装位置：Windows / macOS / Linux 通用
    out.append(Path.home() / _REL)

    # WSL：node_modules 可能装在 Windows 侧，用户名用通配符匹配
    wsl_users = Path("/mnt/c/Users")
    if wsl_users.is_dir():
        out.extend(sorted(wsl_users.glob(f"*/{_REL}")))

    # Windows：可能不在 C 盘
    for drive in ("C", "D", "E", "F"):
        users = Path(f"{drive}:/Users")
        if users.is_dir():
            out.extend(sorted(users.glob(f"*/{_REL}")))

    # 其他 agent 工具的缓存位置
    out.extend(sorted(Path.home().glob(".hanako/artifacts/server/**/node_modules/jsdom")))

    return out


def resolve_jsdom() -> Path | None:
    """返回第一个真实存在的 jsdom 目录；找不到返回 None。"""
    for cand in candidates():
        try:
            if cand.is_dir():
                return cand
        except OSError:
            continue
    return None


if __name__ == "__main__":
    found = resolve_jsdom()
    if found:
        print(found)
    else:
        raise SystemExit("jsdom not found (set JSDOM_PATH to node_modules/jsdom)")
