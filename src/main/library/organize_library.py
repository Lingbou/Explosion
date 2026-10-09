#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Explosion 资料库大部头物理拆解、FTS5 全文索引与 768 维语义向量索引构建器 (Organize Library)
用途：
1. 自动识别 GB18030 / GBK / UTF-8 编码，对大篇幅小说按卷物理拆解；
2. 自动收敛至专属书名子目录（~/.explosion/library/<书名>/）；
3. 构建按自然段切片的 SQLite FTS5 全文倒排索引表与 768 维语义向量表（~/.explosion/cache/books/<书名>/index.db）；
4. 在书名目录下建立 .cache 软链接指向缓存目录；
5. 提供单句/批量 768 维向量嵌入计算命令行与长连接接口，供 Node.js Hybrid RAG 调用；
6. 自动清理拆解后的原始庞大单文件。
"""

import os
import sys
import re
import json
import base64
import argparse
import sqlite3
from typing import List, Tuple, Optional, Dict, Any

try:
    import numpy as np
    import onnxruntime as ort
    from tokenizers import Tokenizer
    from huggingface_hub import hf_hub_download
    ONNX_AVAILABLE = True
except ImportError as e:
    ONNX_AVAILABLE = False
    IMPORT_ERROR_MSG = str(e)


class BgeEmbeddingEngine:
    """
    基于 BAAI/bge-base-zh-v1.5 的纯本地轻量 768 维 ONNX 向量嵌入引擎。
    零 PyTorch 依赖，单次缓存于 ~/.cache/，CPU 毫秒级推理。
    """
    def __init__(self, model_name: str = "Xenova/bge-base-zh-v1.5", cache_dir: Optional[str] = None):
        self.model_name = model_name
        self.cache_dir = cache_dir
        self.dim = 768
        self.tokenizer: Optional[Tokenizer] = None
        self.session: Optional[ort.InferenceSession] = None
        self._loaded: bool = False

    def load(self) -> bool:
        if self._loaded:
            return True
        if not ONNX_AVAILABLE:
            print(f"提示: 未安装 onnxruntime/tokenizers ({IMPORT_ERROR_MSG})，向量引擎不可用", file=sys.stderr)
            return False

        try:
            # 优先从本地缓存读取，避免多余网络交互与警告
            try:
                tok_path = hf_hub_download(self.model_name, "tokenizer.json", local_files_only=True, cache_dir=self.cache_dir)
                model_path = hf_hub_download(self.model_name, "onnx/model_quantized.onnx", local_files_only=True, cache_dir=self.cache_dir)
            except Exception:
                # 本地未命中时自动从 HuggingFace 单次下载
                tok_path = hf_hub_download(self.model_name, "tokenizer.json", cache_dir=self.cache_dir)
                try:
                    model_path = hf_hub_download(self.model_name, "onnx/model_quantized.onnx", cache_dir=self.cache_dir)
                except Exception:
                    model_path = hf_hub_download(self.model_name, "onnx/model.onnx", cache_dir=self.cache_dir)

            self.tokenizer = Tokenizer.from_file(tok_path)
            self.tokenizer.enable_truncation(max_length=512)
            self.tokenizer.enable_padding(direction="right", pad_id=0, pad_token="[PAD]")

            opts = ort.SessionOptions()
            cpu_threads = min(4, os.cpu_count() or 1)
            opts.intra_op_num_threads = cpu_threads
            self.session = ort.InferenceSession(model_path, opts, providers=["CPUExecutionProvider"])
            self._loaded = True
            return True
        except Exception as e:
            print(f"提示: 768 维向量模型加载失败 -> {e}", file=sys.stderr)
            return False

    def embed_texts(self, texts: List[str], batch_size: int = 64) -> Optional[np.ndarray]:
        if not self.load() or self.tokenizer is None or self.session is None:
            return None
        if not texts:
            return np.empty((0, self.dim), dtype=np.float32)

        all_embs: List[np.ndarray] = []
        for i in range(0, len(texts), batch_size):
            chunk = texts[i:i + batch_size]
            encodings = self.tokenizer.encode_batch(chunk)
            max_len = max(len(e.ids) for e in encodings)
            input_ids = np.array([e.ids[:max_len] for e in encodings], dtype=np.int64)
            attention_mask = np.array([e.attention_mask[:max_len] for e in encodings], dtype=np.int64)
            token_type_ids = np.array([e.type_ids[:max_len] for e in encodings], dtype=np.int64)

            outputs = self.session.run(None, {
                "input_ids": input_ids,
                "attention_mask": attention_mask,
                "token_type_ids": token_type_ids
            })
            # BGE 采用 [CLS] token (索引 0) 作为句向量并进行 L2 归一化
            cls_emb = outputs[0][:, 0, :]
            norm = np.linalg.norm(cls_emb, axis=1, keepdims=True)
            norm_emb = cls_emb / np.clip(norm, 1e-12, None)
            all_embs.append(norm_emb.astype(np.float32))

        return np.vstack(all_embs)

    def embed_query(self, query: str) -> Optional[np.ndarray]:
        res = self.embed_texts([query], batch_size=1)
        if res is not None and len(res) > 0:
            return res[0]
        return None


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
    name = re.sub(r'《|》', '', name)
    name = re.sub(r'（.*?）|\(.*?\)|【.*?】', '', name).strip()
    name = re.sub(r'作者[：:].*$', '', name).strip()
    return name.strip() or '作品'


def tokenize_cn(text: str) -> str:
    tokens = re.findall(r'[\u4e00-\u9fa5\u3400-\u4dbf]|[a-zA-Z0-9_]+', text)
    return ' '.join(tokens)


def build_book_index(db_path: str, volume_files: List[str], build_embeddings: bool = True) -> Tuple[int, int]:
    """
    构建 SQLite FTS5 全文倒排索引表与 768 维语义向量表：
    - library_paragraphs: FTS5 虚拟表
    - paragraph_embeddings: (id INTEGER PRIMARY KEY, volume TEXT, paragraph TEXT, embedding BLOB)
    """
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    con = sqlite3.connect(db_path)
    cur = con.cursor()
    cur.execute("CREATE VIRTUAL TABLE IF NOT EXISTS library_paragraphs USING fts5(volume, paragraph, tokens)")
    cur.execute("CREATE TABLE IF NOT EXISTS paragraph_embeddings (id INTEGER PRIMARY KEY, volume TEXT, paragraph TEXT, embedding BLOB)")
    cur.execute("DELETE FROM library_paragraphs")
    cur.execute("DELETE FROM paragraph_embeddings")

    paras_to_insert: List[Tuple[str, str, str]] = []
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
            paras_to_insert.append((vol_name, para, tokens))

    total_paras = len(paras_to_insert)
    cur.executemany("INSERT INTO library_paragraphs VALUES (?, ?, ?)", paras_to_insert)
    con.commit()

    total_embedded = 0
    if build_embeddings and total_paras > 0:
        eng = BgeEmbeddingEngine()
        if eng.load():
            try:
                batch_size = 64
                for i in range(0, total_paras, batch_size):
                    chunk = paras_to_insert[i:i + batch_size]
                    texts = [p[1] for p in chunk]
                    embs = eng.embed_texts(texts, batch_size=batch_size)
                    if embs is not None:
                        rows = []
                        for idx, (vol, text, _) in enumerate(chunk):
                            row_id = i + idx + 1
                            blob = embs[idx].tobytes()
                            rows.append((row_id, vol, text, blob))
                        cur.executemany("INSERT INTO paragraph_embeddings (id, volume, paragraph, embedding) VALUES (?, ?, ?, ?)", rows)
                        con.commit()
                        total_embedded += len(rows)
            except Exception as e:
                print(f"提示: 生成 768 维向量嵌入时出现异常 ({e})，保留纯 FTS5 全文索引", file=sys.stderr)
        else:
            print("提示: 向量模型未就绪或环境不支持，跳过向量建库，已保留 FTS5 全文索引", file=sys.stderr)

    con.close()
    return total_paras, total_embedded


def build_book_fts5_index(db_path: str, volume_files: List[str]) -> int:
    """兼容旧接口调用"""
    total_paras, _ = build_book_index(db_path, volume_files, build_embeddings=True)
    return total_paras


def reindex_embeddings_for_db(db_path: str) -> int:
    """
    为已存在的书籍 index.db 补建/重构 paragraph_embeddings 向量表。
    """
    if not os.path.exists(db_path):
        print(f"数据库不存在: {db_path}", file=sys.stderr)
        return 0

    con = sqlite3.connect(db_path)
    cur = con.cursor()
    cur.execute("CREATE TABLE IF NOT EXISTS paragraph_embeddings (id INTEGER PRIMARY KEY, volume TEXT, paragraph TEXT, embedding BLOB)")

    rows = cur.execute("SELECT rowid, volume, paragraph FROM library_paragraphs ORDER BY rowid").fetchall()
    if not rows:
        con.close()
        return 0

    eng = BgeEmbeddingEngine()
    if not eng.load():
        print("向量模型加载失败，无法补建向量索引", file=sys.stderr)
        con.close()
        return 0

    cur.execute("DELETE FROM paragraph_embeddings")
    con.commit()

    batch_size = 64
    total_embedded = 0
    total_rows = len(rows)
    for i in range(0, total_rows, batch_size):
        chunk = rows[i:i + batch_size]
        texts = [r[2] for r in chunk]
        embs = eng.embed_texts(texts, batch_size=batch_size)
        if embs is not None:
            insert_rows = []
            for idx, r in enumerate(chunk):
                row_id = r[0]
                vol = r[1]
                para = r[2]
                blob = embs[idx].tobytes()
                insert_rows.append((row_id, vol, para, blob))
            cur.executemany("INSERT INTO paragraph_embeddings (id, volume, paragraph, embedding) VALUES (?, ?, ?, ?)", insert_rows)
            con.commit()
            total_embedded += len(insert_rows)
            if total_embedded % 1000 == 0 or total_embedded == total_rows:
                print(f"向量索引构建进度: {total_embedded}/{total_rows} 段落", file=sys.stderr)

    con.close()
    return total_embedded


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


def split_book_by_volumes(file_path: str, output_dir: Optional[str] = None, remove_original: bool = True, build_embeddings: bool = True) -> List[str]:
    if not os.path.exists(file_path):
        print(f"错误: 目标文件不存在 -> {file_path}", file=sys.stderr)
        return []

    text, encoding = detect_and_decode(file_path)
    lines = text.splitlines()
    total_lines = len(lines)

    base_name = clean_book_title(file_path)
    base_out = output_dir or os.path.dirname(os.path.abspath(file_path))

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
        print(f"提示: 未能在大文件中检测到明确的多卷标记（需单卷>=50行），整本作为单卷保存", file=sys.stderr)
        single_out = os.path.join(book_dir, f"《{base_name}》_全本.txt")
        with open(single_out, 'w', encoding='utf-8') as f:
            f.write(text)
        created_files.append(single_out)
    else:
        first_vol_start = real_volumes[0][0]
        if first_vol_start > 0:
            preamble = '\n'.join(lines[:first_vol_start]).strip()
            if preamble:
                preamble_path = os.path.join(book_dir, f"《{base_name}》_00_序言与简介.txt")
                with open(preamble_path, 'w', encoding='utf-8') as f:
                    f.write(preamble + '\n')
                created_files.append(preamble_path)

        for start, end, vol_label, vol_title in real_volumes:
            vol_text = '\n'.join(lines[start:end]).strip()
            vol_safe_title = re.sub(r'[\\/*?:"<>|]', '', vol_title).strip()
            file_label = f"《{base_name}》_{vol_label}" + (f"_{vol_safe_title}" if vol_safe_title else "") + ".txt"
            file_path_out = os.path.join(book_dir, file_label)

            with open(file_path_out, 'w', encoding='utf-8') as f:
                f.write(vol_text + '\n')

            created_files.append(file_path_out)

    cache_dir = os.path.expanduser(f"~/.explosion/cache/books/{base_name}")
    db_path = os.path.join(cache_dir, "index.db")
    total_indexed, total_embedded = build_book_index(db_path, created_files, build_embeddings=build_embeddings)
    print(f"构建全文与向量索引完成: 共索引 {total_indexed} 个自然段 (其中向量嵌入 {total_embedded} 个) -> {db_path}")

    ensure_cache_symlink(book_dir, cache_dir)

    if remove_original and len(created_files) > 1:
        try:
            if os.path.exists(file_path):
                if os.path.abspath(file_path) not in [os.path.abspath(c) for c in created_files]:
                    os.remove(file_path)
                    print(f"已自动清理原始大文件: {os.path.basename(file_path)}")
        except Exception as e:
            print(f"清理原始大文件提示: {e}", file=sys.stderr)

    return created_files


def migrate_flat_library_files(library_dir: str, build_embeddings: bool = True):
    if not os.path.exists(library_dir):
        return

    items = os.listdir(library_dir)
    grouped: dict[str, list[str]] = {}

    for item in items:
        if item.endswith('.txt') and not item.startswith('.'):
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
                build_book_index(db_path, moved_paths, build_embeddings=build_embeddings)
                ensure_cache_symlink(book_dir, cache_dir)
                print(f"已将 {len(moved_paths)} 个散落分卷收敛整理至专属目录: {book_dir} (并建立 .cache 索引)")


def handle_embed_daemon():
    eng = BgeEmbeddingEngine()
    if not eng.load():
        sys.stderr.write("Failed to load embedding engine for daemon\n")
        sys.exit(1)

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
            req_id = req.get("id")
            query = req.get("query", "")
            emb = eng.embed_query(query)
            if emb is not None:
                b64 = base64.b64encode(emb.tobytes()).decode("ascii")
                resp = {"id": req_id, "embedding": b64, "dim": 768}
            else:
                resp = {"id": req_id, "error": "Embedding generation returned None"}
        except Exception as e:
            resp = {"id": req.get("id") if 'req' in locals() else None, "error": str(e)}

        sys.stdout.write(json.dumps(resp, ensure_ascii=False) + "\n")
        sys.stdout.flush()


def main():
    parser = argparse.ArgumentParser(description="Explosion 资料库物理分卷拆解、FTS5 全文索引与 768 维语义向量索引工具")
    parser.add_argument("target", nargs="?", default=None, help="目标大 TXT 文件路径或资料库目录")
    parser.add_argument("--output-dir", "-o", default=None, help="输出文件夹，默认存放于资料库目录")
    parser.add_argument("--keep-original", action="store_true", help="拆解完成后保留原始大文件（默认自动清理）")
    parser.add_argument("--migrate", action="store_true", help="整理资料库根目录下的散落分卷")
    parser.add_argument("--no-embeddings", action="store_true", help="跳过 768 维语义向量嵌入，仅建立纯 FTS5 全文索引")
    parser.add_argument("--embed-query", type=str, default=None, help="计算单句 query 的 768 维向量并以 JSON (base64) 输出")
    parser.add_argument("--embed-daemon", action="store_true", help="以常驻进程模式从 stdin 读取 query 并向 stdout 输出向量")
    parser.add_argument("--reindex-embeddings", nargs="?", const="all", default=None, help="为指定 index.db 或全部藏书补建 768 维向量索引")
    args = parser.parse_args()

    # 1. 向量查询模式
    if args.embed_query is not None:
        eng = BgeEmbeddingEngine()
        emb = eng.embed_query(args.embed_query)
        if emb is not None:
            b64 = base64.b64encode(emb.tobytes()).decode("ascii")
            print(json.dumps({"embedding": b64, "dim": 768, "model": "BAAI/bge-base-zh-v1.5"}))
            sys.exit(0)
        else:
            print(json.dumps({"error": "Failed to generate embedding", "embedding": None}))
            sys.exit(1)

    # 2. 常驻 Daemon 模式
    if args.embed_daemon:
        handle_embed_daemon()
        sys.exit(0)

    # 3. 补建/重建向量索引模式
    if args.reindex_embeddings is not None:
        target = args.reindex_embeddings
        if target == "all":
            books_cache = os.path.expanduser("~/.explosion/cache/books")
            if os.path.exists(books_cache):
                for book in os.listdir(books_cache):
                    db_p = os.path.join(books_cache, book, "index.db")
                    if os.path.exists(db_p):
                        print(f"正在为 《{book}》 补建 768 维向量索引...")
                        c = reindex_embeddings_for_db(db_p)
                        print(f"《{book}》 向量索引构建完成，共嵌入 {c} 段落")
        else:
            db_p = target if target.endswith("index.db") else os.path.join(target, "index.db")
            print(f"正在为 {db_p} 补建 768 维向量索引...")
            c = reindex_embeddings_for_db(db_p)
            print(f"向量索引构建完成，共嵌入 {c} 段落")
        sys.exit(0)

    # 4. 拆书与索引模式
    default_lib = os.path.expanduser("~/.explosion/library")
    target = args.target or default_lib
    remove_orig = not args.keep_original
    build_emb = not args.no_embeddings

    if args.migrate or (os.path.isdir(target) and target == default_lib):
        migrate_flat_library_files(default_lib, build_embeddings=build_emb)

    if os.path.isdir(target):
        txt_files = [os.path.join(target, f) for f in os.listdir(target) if f.endswith('.txt')]
        for tf in txt_files:
            size_mb = os.path.getsize(tf) / (1024 * 1024)
            if size_mb >= 0.5:
                print(f"\n发现大部头书籍: {os.path.basename(tf)} ({size_mb:.2f} MB)")
                created = split_book_by_volumes(tf, args.output_dir or target, remove_original=remove_orig, build_embeddings=build_emb)
                if created:
                    print(f"成功物理拆解为 {len(created)} 个单卷文件 (UTF-8 编码):")
                    for c in created:
                        sz = os.path.getsize(c) / 1024
                        print(f"  - {os.path.basename(c)} ({sz:.1f} KB)")
    else:
        created = split_book_by_volumes(target, args.output_dir, remove_original=remove_orig, build_embeddings=build_emb)
        if created:
            print(f"成功物理拆解为 {len(created)} 个单卷文件 (UTF-8 编码):")
            for c in created:
                sz = os.path.getsize(c) / 1024
                print(f"  - {os.path.basename(c)} ({sz:.1f} KB)")


if __name__ == '__main__':
    main()
