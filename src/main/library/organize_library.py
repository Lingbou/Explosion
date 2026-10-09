#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Explosion 资料库大部头物理拆解与 FTS5 全文索引构建器 (Organize Library)
用途：
1. 自动识别 GB18030 / GBK / UTF-8 编码，对大篇幅小说按卷物理拆解；
2. 自动收敛至专属书名子目录（~/.explosion/library/<书名>/）；
3. 构建按自然段切片的 SQLite FTS5 全文索引表（~/.explosion/cache/books/<书名>/index.db）；
4. 在书名目录下建立 .cache 软链接指向缓存目录；
5. 自动清理拆解后的原始庞大单文件。
"""

import os
import sys
import re
import argparse
import sqlite3
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

    return raw_bytes.decode('gb18030', errors='replace'), 'gb18030 (lossy)'

def clean_book_title(filename: str) -> str:
    name = os.path.splitext(os.path.basename(filename))[0]
    # Remove 《 》, author info, edition notes
    name = re.sub(r'《|》', '', name)
    name = re.sub(r'（.*?）|\(.*?\)|【.*?】', '', name).strip()
    name = re.sub(r'作者[：:].*$', '', name).strip()
    return name.strip() or '作品'

def tokenize_cn(text: str) -> str:
    # Inserts space between Chinese characters, keeps alphanumeric tokens intact
    tokens = re.findall(r'[\u4e00-\u9fa5\u3400-\u4dbf]|[a-zA-Z0-9_]+', text)
    return ' '.join(tokens)

def build_book_fts5_index(db_path: str, volume_files: List[str]) -> int:
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    con = sqlite3.connect(db_path)
    cur = con.cursor()
    cur.execute("CREATE VIRTUAL TABLE IF NOT EXISTS library_paragraphs USING fts5(volume, paragraph, tokens)")
    cur.execute("DELETE FROM library_paragraphs")

    total_paras = 0
    for vol_path in volume_files:
        vol_name = os.path.basename(vol_path)
        if not os.path.exists(vol_path):
            continue
        with open(vol_path, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.read().splitlines()

        for line in lines:
            para = line.strip()
            if len(para) < 4:
                continue
            tokens = tokenize_cn(para)
            cur.execute("INSERT INTO library_paragraphs VALUES (?, ?, ?)", (vol_name, para, tokens))
            total_paras += 1

    con.commit()
    con.close()
    return total_paras

def ensure_cache_symlink(book_dir: str, cache_dir: str):
    symlink_path = os.path.join(book_dir, '.cache')
    if os.path.islink(symlink_path):
        try:
            os.unlink(symlink_path)
        except Exception:
            pass
    elif os.path.exists(symlink_path):
        try:
            if os.path.isdir(symlink_path):
                import shutil
                shutil.rmtree(symlink_path)
            else:
                os.remove(symlink_path)
        except Exception:
            pass

    try:
        os.symlink(cache_dir, symlink_path)
    except Exception as e:
        print(f"建立 .cache 软链接提示: {e}", file=sys.stderr)

def split_book_by_volumes(file_path: str, output_dir: Optional[str] = None, remove_original: bool = True) -> List[str]:
    if not os.path.exists(file_path):
        print(f"错误: 目标文件不存在 -> {file_path}", file=sys.stderr)
        return []

    text, encoding = detect_and_decode(file_path)
    lines = text.splitlines()
    total_lines = len(lines)

    base_name = clean_book_title(file_path)
    base_out = output_dir or os.path.dirname(os.path.abspath(file_path))

    # Dedicated folder for this book: ~/.explosion/library/<book_name>/
    book_dir = os.path.join(base_out, base_name)
    os.makedirs(book_dir, exist_ok=True)

    vol_re = re.compile(r'^\s*(?:[【〔\[（(]?)(卷[一二三四五六七八九十百0-9]+|第[一二三四五六七八九十百0-9]+[卷部]|九州[·\s]*缥缈录[ⅠⅡⅢⅣⅤⅥ\s]*[一二三四五六1-6]*|[一二三四五六1-6]、)(?:[\s:：]+([^\r\n]{1,30}))?(?:[】〕\]）)]?)\s*$')

    raw_matches: List[Tuple[int, str, str]] = []
    for i, line in enumerate(lines):
        m = vol_re.match(line)
        if m:
            vol_label = (m.group(1) or '').strip()
            vol_title = (m.group(2) or '').strip()
            raw_matches.append((i, vol_label, vol_title))

    real_volumes: List[Tuple[int, int, str, str]] = []
    for idx, (line_no, vol_label, vol_title) in enumerate(raw_matches):
        next_line = raw_matches[idx + 1][0] if idx + 1 < len(raw_matches) else total_lines
        span = next_line - line_no
        if span >= 50:
            real_volumes.append((line_no, next_line, vol_label, vol_title))

    created_files: List[str] = []

    if len(real_volumes) <= 1:
        print(f"提示: 未检测到多个明显分卷 (仅匹配到 {len(real_volumes)} 个卷标头)。保持原文件。")
        return created_files

    first_vol_start = real_volumes[0][0]
    if first_vol_start > 5:
        preface_lines = lines[:first_vol_start]
        preface_text = '\n'.join(preface_lines).strip()
        if preface_text:
            preface_filename = f"《{base_name}》_00_序言与简介.txt"
            preface_path = os.path.join(book_dir, preface_filename)
            with open(preface_path, 'w', encoding='utf-8') as f:
                f.write(preface_text + '\n')
            created_files.append(preface_path)

    for idx, (start_line, end_line, vol_label, vol_title) in enumerate(real_volumes):
        vol_lines = lines[start_line:end_line]
        vol_text = '\n'.join(vol_lines).strip()

        vol_safe_title = re.sub(r'[\\/:*?"<>|]', '_', vol_title) if vol_title else ''
        file_label = f"《{base_name}》_{vol_label}" + (f"_{vol_safe_title}" if vol_safe_title else "") + ".txt"
        file_path_out = os.path.join(book_dir, file_label)

        with open(file_path_out, 'w', encoding='utf-8') as f:
            f.write(vol_text + '\n')

        created_files.append(file_path_out)

    # 1. Build FTS5 database in ~/.explosion/cache/books/<book_name>/index.db
    cache_dir = os.path.expanduser(f"~/.explosion/cache/books/{base_name}")
    db_path = os.path.join(cache_dir, "index.db")
    total_indexed = build_book_fts5_index(db_path, created_files)
    print(f"构建 FTS5 全文索引完成: 共索引 {total_indexed} 个自然段 -> {db_path}")

    # 2. Establish .cache symlink inside book directory
    ensure_cache_symlink(book_dir, cache_dir)

    # 3. Clean up the original monolithic large file
    if remove_original and len(created_files) > 1:
        try:
            if os.path.exists(file_path):
                if os.path.abspath(file_path) not in [os.path.abspath(c) for c in created_files]:
                    os.remove(file_path)
                    print(f"已自动清理原始大文件: {os.path.basename(file_path)}")
        except Exception as e:
            print(f"清理原始大文件提示: {e}", file=sys.stderr)

    return created_files

def migrate_flat_library_files(library_dir: str):
    """
    If library root contains flat split files like 《九州·缥缈录》_*.txt,
    automatically move them into library_dir/<book_name>/, build index.db, and establish .cache symlink.
    """
    if not os.path.exists(library_dir):
        return

    items = os.listdir(library_dir)
    grouped: dict[str, list[str]] = {}

    for item in items:
        if item.endswith('.txt') and not item.startswith('.'):
            # Check pattern 《BookName》_*.txt
            m = re.match(r'^(?:《)?([^》_]+)(?:》)?_.*\.txt$', item)
            if m:
                book_name = m.group(1).strip()
                grouped.setdefault(book_name, []).append(item)

    for book_name, file_list in grouped.items():
        if len(file_list) > 1:
            book_dir = os.path.join(library_dir, book_name)
            os.makedirs(book_dir, exist_ok=True)
            moved_paths = []
            for f in file_list:
                src = os.path.join(library_dir, f)
                dst = os.path.join(book_dir, f)
                try:
                    os.rename(src, dst)
                    moved_paths.append(dst)
                except Exception:
                    pass

            if moved_paths:
                cache_dir = os.path.expanduser(f"~/.explosion/cache/books/{book_name}")
                db_path = os.path.join(cache_dir, "index.db")
                build_book_fts5_index(db_path, moved_paths)
                ensure_cache_symlink(book_dir, cache_dir)
                print(f"已将 {len(moved_paths)} 个散落分卷收敛整理至专属目录: {book_dir} (并建立 .cache 索引)")

def main():
    parser = argparse.ArgumentParser(description="Explosion 资料库物理分卷拆解与 FTS5 全文索引工具")
    parser.add_argument("target", nargs="?", default=None, help="目标大 TXT 文件路径或资料库目录")
    parser.add_argument("--output-dir", "-o", default=None, help="输出文件夹，默认存放于资料库目录")
    parser.add_argument("--keep-original", action="store_true", help="拆解完成后保留原始大文件（默认自动清理）")
    parser.add_argument("--migrate", action="store_true", help="整理资料库根目录下的散落分卷")
    args = parser.parse_args()

    default_lib = os.path.expanduser("~/.explosion/library")
    target = args.target or default_lib
    remove_orig = not args.keep_original

    if args.migrate or (os.path.isdir(target) and target == default_lib):
        migrate_flat_library_files(default_lib)

    if os.path.isdir(target):
        txt_files = [os.path.join(target, f) for f in os.listdir(target) if f.endswith('.txt')]
        for tf in txt_files:
            size_mb = os.path.getsize(tf) / (1024 * 1024)
            if size_mb >= 0.5:
                print(f"\n发现大部头书籍: {os.path.basename(tf)} ({size_mb:.2f} MB)")
                created = split_book_by_volumes(tf, args.output_dir or target, remove_original=remove_orig)
                if created:
                    print(f"成功物理拆解为 {len(created)} 个单卷文件 (UTF-8 编码):")
                    for c in created:
                        sz = os.path.getsize(c) / 1024
                        print(f"  - {os.path.basename(c)} ({sz:.1f} KB)")
    else:
        created = split_book_by_volumes(target, args.output_dir, remove_original=remove_orig)
        if created:
            print(f"成功物理拆解为 {len(created)} 个单卷文件 (UTF-8 编码):")
            for c in created:
                sz = os.path.getsize(c) / 1024
                print(f"  - {os.path.basename(c)} ({sz:.1f} KB)")

if __name__ == '__main__':
    main()
