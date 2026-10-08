#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Explosion 藏书库大部头物理拆解器 (Organize Library)
用途：自动识别 GB18030 / GBK / UTF-8 编码，对大篇幅合集小说进行物理拆卷，
输出干净、独立的单卷 UTF-8 纯文本文件，彻底解决大部头小说无法被大模型与向量索引精细处理的问题。
"""

import os
import sys
import re
import argparse
from typing import List, Tuple, Optional

def detect_and_decode(file_path: str) -> Tuple[str, str]:
    with open(file_path, 'rb') as f:
        raw_bytes = f.read()

    encodings_to_try = ['utf-8', 'gb18030', 'gbk', 'utf-16', 'utf-16-le', 'big5']
    for enc in encodings_to_try:
        try:
            text = raw_bytes.decode(enc)
            return text, enc
        except UnicodeDecodeError:
            continue

    # Fallback with replacement
    return raw_bytes.decode('gb18030', errors='replace'), 'gb18030 (lossy)'

def clean_book_title(filename: str) -> str:
    name = os.path.splitext(os.path.basename(filename))[0]
    # Remove author / edition metadata inside brackets or trailing info
    name = re.sub(r'（.*?）|\(.*?\)|【.*?】', '', name).strip()
    name = re.sub(r'作者[：:].*$', '', name).strip()
    return name or '作品'

def split_book_by_volumes(file_path: str, output_dir: Optional[str] = None) -> List[str]:
    if not os.path.exists(file_path):
        print(f"错误: 目标文件不存在 -> {file_path}", file=sys.stderr)
        return []

    text, encoding = detect_and_decode(file_path)
    lines = text.splitlines()
    total_lines = len(lines)

    base_name = clean_book_title(file_path)
    out_dir = output_dir or os.path.dirname(os.path.abspath(file_path))
    os.makedirs(out_dir, exist_ok=True)

    # Regex for Volume headers (卷一, 第二卷, etc.)
    vol_re = re.compile(r'^\s*(?:[【〔\[（(]?)(卷[一二三四五六七八九十百0-9]+|第[一二三四五六七八九十百0-9]+[卷部]|九州[·\s]*缥缈录[ⅠⅡⅢⅣⅤⅥ\s]*[一二三四五六1-6]*|[一二三四五六1-6]、)(?:[\s:：]+([^\r\n]{1,30}))?(?:[】〕\]）)]?)\s*$')

    raw_matches: List[Tuple[int, str, str]] = []
    for i, line in enumerate(lines):
        m = vol_re.match(line)
        if m:
            vol_label = (m.group(1) or '').strip()
            vol_title = (m.group(2) or '').strip()
            raw_matches.append((i, vol_label, vol_title))

    # Filter out Table of Contents / Synopsis lines (where successive matches are < 50 lines apart)
    real_volumes: List[Tuple[int, int, str, str]] = []
    for idx, (line_no, vol_label, vol_title) in enumerate(raw_matches):
        next_line = raw_matches[idx + 1][0] if idx + 1 < len(raw_matches) else total_lines
        span = next_line - line_no
        if span >= 50:
            real_volumes.append((line_no, next_line, vol_label, vol_title))

    created_files: List[str] = []

    if len(real_volumes) <= 1:
        # If no multiple volumes found, check if it has chapters
        print(f"提示: 未检测到多个明显分卷 (仅匹配到 {len(real_volumes)} 个卷标头)。保持原文件或按章节处理。")
        return created_files

    first_vol_start = real_volumes[0][0]
    # If there is preface / intro text before volume 1
    if first_vol_start > 5:
        preface_lines = lines[:first_vol_start]
        preface_text = '\n'.join(preface_lines).strip()
        if preface_text:
            preface_filename = f"{base_name}_00_序言与简介.txt"
            preface_path = os.path.join(out_dir, preface_filename)
            with open(preface_path, 'w', encoding='utf-8') as f:
                f.write(preface_text + '\n')
            created_files.append(preface_path)

    for idx, (start_line, end_line, vol_label, vol_title) in enumerate(real_volumes):
        vol_lines = lines[start_line:end_line]
        vol_text = '\n'.join(vol_lines).strip()

        vol_safe_title = re.sub(r'[\\/:*?"<>|]', '_', vol_title) if vol_title else ''
        file_label = f"{base_name}_{vol_label}" + (f"_{vol_safe_title}" if vol_safe_title else "") + ".txt"
        file_path_out = os.path.join(out_dir, file_label)

        with open(file_path_out, 'w', encoding='utf-8') as f:
            f.write(vol_text + '\n')

        created_files.append(file_path_out)

    return created_files

def main():
    parser = argparse.ArgumentParser(description="Explosion 藏书库物理分卷拆解工具")
    parser.add_argument("target", nargs="?", default=None, help="目标大 TXT 文件路径或藏书库目录")
    parser.add_argument("--output-dir", "-o", default=None, help="输出文件夹，默认存放于目标文件同级目录")
    args = parser.parse_args()

    default_lib = os.path.expanduser("~/.explosion/library")
    target = args.target

    if not target:
        target = default_lib

    if os.path.isdir(target):
        # Scan all .txt in directory
        txt_files = [os.path.join(target, f) for f in os.listdir(target) if f.endswith('.txt')]
        if not txt_files:
            print(f"目录中未找到任何 .txt 文件: {target}")
            return

        print(f"正在扫描藏书库目录: {target} (共 {len(txt_files)} 个文本文件)")
        for tf in txt_files:
            size_mb = os.path.getsize(tf) / (1024 * 1024)
            if size_mb >= 0.5:  # Greater than 500KB
                print(f"\n发现大部头书籍: {os.path.basename(tf)} ({size_mb:.2f} MB)")
                created = split_book_by_volumes(tf, args.output_dir)
                if created:
                    print(f"成功物理拆解为 {len(created)} 个单卷文件 (UTF-8 编码):")
                    for c in created:
                        sz = os.path.getsize(c) / 1024
                        print(f"  - {os.path.basename(c)} ({sz:.1f} KB)")
    else:
        created = split_book_by_volumes(target, args.output_dir)
        if created:
            print(f"成功物理拆解为 {len(created)} 个单卷文件 (UTF-8 编码):")
            for c in created:
                sz = os.path.getsize(c) / 1024
                print(f"  - {os.path.basename(c)} ({sz:.1f} KB)")

if __name__ == '__main__':
    main()
