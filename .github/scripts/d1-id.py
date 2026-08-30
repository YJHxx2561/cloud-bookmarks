#!/usr/bin/env python3
"""从 wrangler 的 --json 输出中提取第一个 D1 数据库 ID（兼容 dict / list / 嵌套 result 格式）。"""
import json
import sys


def first_id(data):
    if isinstance(data, list):
        data = data[0] if data else {}
    if not isinstance(data, dict):
        return ""
    if isinstance(data.get("result"), dict):
        data = data["result"]
    return (
        data.get("uuid")
        or data.get("database_id")
        or data.get("databaseId")
        or ""
    )


if __name__ == "__main__":
    print(first_id(json.load(sys.stdin)) or "")
