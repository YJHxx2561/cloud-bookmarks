#!/usr/bin/env python3
"""从 wrangler pages project list --json 输出中判断指定项目是否存在。"""
import json
import sys


def has_project(name: str) -> bool:
    data = json.load(sys.stdin)
    if isinstance(data, dict):
        data = data.get("result", [])
    return any(p.get("name") == name for p in data if isinstance(p, dict))


if __name__ == "__main__":
    sys.exit(0 if has_project(sys.argv[1]) else 1)
