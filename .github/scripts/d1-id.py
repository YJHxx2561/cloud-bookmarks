#!/usr/bin/env python3
"""从 Cloudflare API / wrangler 的 JSON 输出中提取 D1 数据库 ID。

兼容多种输出形态：
- 顶层数组，如 wrangler d1 list 输出 [ {uuid,name,...} ]
- 嵌套在 result 中的数组，如 API 列表响应 { "result": [ {...} ], ... }
- 单对象，或 result 为对象的响应（API 创建成功时）

可通过命令行参数指定数据库名称进行精确匹配：
    echo '...' | python3 d1-id.py bookmarks-db
"""
import json
import sys


def _items(data):
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        if isinstance(data.get("result"), list):
            return data["result"]
        if isinstance(data.get("result"), dict):
            return [data["result"]]
        return [data]
    return []


def find_id(data, name=""):
    for item in _items(data):
        if not isinstance(item, dict):
            continue
        if name and item.get("name") != name:
            continue
        return (
            item.get("uuid")
            or item.get("database_id")
            or item.get("databaseId")
            or item.get("id")
            or ""
        )
    return ""


if __name__ == "__main__":
    name = sys.argv[1] if len(sys.argv) > 1 else ""
    print(find_id(json.load(sys.stdin), name) or "")
