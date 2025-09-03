#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Job Vault — global position numbering + improved move:
- New positions get the next 3-digit number, counting MAX across all statuses.
- Absolute path support in move command.
"""

import os
import sys
import re
import shutil
import logging
try:  # pragma: no cover - optional dependency
    import yaml  # type: ignore
except Exception:  # pragma: no cover
    yaml = None
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Tuple

# === Settings ===
BASE_DIR = Path(os.environ.get("JOB_VAULT_DIR", ".")).expanduser().resolve()
LOG_FILE = BASE_DIR / "job_vault.log"
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    filename=LOG_FILE,
    filemode="a",
)
logger = logging.getLogger("job_vault")

# Canonical status directories (3-digit prefixes)
STATUSES: dict[str, str] = {
    "010_Drafts": "Drafts",
    "015_Misfits": "Misfits",
    "020_Fits": "Fits",
    "030_Applied": "Applied",
    "040_Replies": "Replies",
    "050_Interviews": "Interviews",
    "090_Rejected": "Rejected",
    "100_Offers": "Offers",
}

# Old → New status directory renames (for migration)
OLD_STATUS_MAP: dict[str, str] = {  # pragma: no cover
    "10_Drafts": "010_Drafts",
    "20_Fits": "020_Fits",
    "30_Applied": "030_Applied",
    "40_Replies": "040_Replies",
    "50_Interviews": "050_Interviews",
    "90_History/91_Rejected": "090_Rejected",
    "90_History/92_Offers": "100_Offers",
}

# CLI aliases (lowercase) → canonical status dirs
_STATUS_ALIASES_RAW = {
    "draft": "010_Drafts", "drafts": "010_Drafts",
    "misfit": "015_Misfits", "misfits": "015_Misfits",
    "fit": "020_Fits", "fits": "020_Fits",
    "applied": "030_Applied",
    "reply": "040_Replies", "replies": "040_Replies",
    "interview": "050_Interviews", "interviews": "050_Interviews",
    "rejected": "090_Rejected", "rejects": "090_Rejected",
    "offer": "100_Offers", "offers": "100_Offers",
    # legacy friendly
    "10drafts": "010_Drafts", "30applied": "030_Applied",
    "40replies": "040_Replies", "50interviews": "050_Interviews",
}

def _norm(s: str) -> str:
    return "".join(ch for ch in s.lower() if ch.isalnum())

STATUS_ALIAS_MAP = {_norm(k): v for k, v in _STATUS_ALIASES_RAW.items()}
OLD_STATUS_NORM = {_norm(k): v for k, v in OLD_STATUS_MAP.items()}  # pragma: no cover

# Position file templates (3-digit filenames)
TEMPLATES = {  # pragma: no cover
    "010_Position.md": (
        "# Position\n\n"
        "**Title:** \n"
        "**Company:** \n"
        "**Role:** \n"
        "**Location:** \n"
        "**Salary/Range:** \n"
        "**Status:** Draft\n"
        "**Source:** \n"
        "**Source file/folder:** \n"
        "**Imported at:** \n"
        "**Contact:** \n"
        "**Applied date:** \n"
        "\n## Notes\n- Why interesting\n- Risks/Concerns\n- Questions\n"
    ),
    "020_CoverLetter.md": "# Cover Letter\n\nDear ...\n",
    "030_Notes.md": "# Notes on position\n\n- …\n",
    "040_Terms.md": "# Terms for this position\n\n- …\n",
}

# References (no numbering)
REFERENCE_TEMPLATES = {  # pragma: no cover
    "Companies": {
        "README.md": "# Companies\n\nList of companies.\n",
        "Sample_Company.md": "# Company: ExampleCorp\n\n**Industry:** \n**Website:** \n**Notes:** \n",
    },
    "Contacts": {
        "README.md": "# Contacts\n\nList of contacts.\n",
        "Sample_Contact.md": "# Contact: John Doe\n\n**Company:** ExampleCorp\n**Position:** Recruiter\n**Email:** \n**Phone:** \n**Notes:** \n",
    },
    "Templates": {
        "README.md": "# Templates\n\nAvailable templates.\n",
        "CoverLetter_Template.md": "# Cover Letter Template\n\nDear [Hiring Manager],\n\n…\n",
        "Position_Template.md": "# Position\n\n**Status:** \n**Source:** \n**Company:** \n**Applied date:** \n**Contact:** \n",
    },
}

# ---------- path utils & sanitization ----------
_INVALID_WIN = '<>:"/\\|?*'

def sanitize_name(name: str) -> str:  # pragma: no cover
    t = str(name).translate({ord(c): "_" for c in _INVALID_WIN})
    t = t.rstrip(" .")
    t = " ".join(t.split())
    return t or "untitled"

def is_subpath(child: Path, parent: Path) -> bool:  # pragma: no cover
    try:
        child = child.resolve()
        parent = parent.resolve()
        child.relative_to(parent)
        return True
    except Exception:
        return False

# ---------- migrations & structure ----------
def _migrate_references():  # pragma: no cover
    refs = BASE_DIR / "References"
    if not refs.exists():
        return
    renames = [
        (refs / "10_Terms.md", refs / "Terms.md"),
        (refs / "20_Companies", refs / "Companies"),
        (refs / "30_Contacts", refs / "Contacts"),
        (refs / "40_Templates", refs / "Templates"),
    ]
    for old, new in renames:
        try:
            if old.exists() and not new.exists():
                shutil.move(str(old), str(new))
        except Exception as e:
            print(f"⚠️  References migration skip for {old}: {e}")

def _migrate_terms_file_to_folder():  # pragma: no cover
    """Move References/Terms.md → References/Terms/README.md"""
    refs = BASE_DIR / "References"
    terms_md = refs / "Terms.md"
    terms_dir = refs / "Terms"
    if terms_md.exists():
        terms_dir.mkdir(parents=True, exist_ok=True)
        target = terms_dir / "README.md"
        if target.exists():
            stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            target = terms_dir / f"README_{stamp}.md"
        try:
            shutil.move(str(terms_md), str(target))
        except Exception as e:
            print(f"⚠️  Terms migration skip: {e}")

def _migrate_status_dirs():  # pragma: no cover
    pos_root = BASE_DIR / "Positions"
    pos_root.mkdir(parents=True, exist_ok=True)

    for old_name, new_name in list(OLD_STATUS_MAP.items()):
        if "90_History/" in old_name:
            continue
        old_path = pos_root / old_name
        new_path = pos_root / new_name
        if old_path.exists() and not new_path.exists():
            try:
                shutil.move(str(old_path), str(new_path))
            except Exception as e:
                print(f"⚠️  Status migration skip {old_name} → {new_name}: {e}")

    # split old history
    hist = pos_root / "90_History"
    rej_old = hist / "91_Rejected"
    off_old = hist / "92_Offers"
    rej_new = pos_root / "090_Rejected"
    off_new = pos_root / "100_Offers"

    if rej_old.exists():
        rej_new.mkdir(parents=True, exist_ok=True)
        for item in rej_old.iterdir():
            target = rej_new / item.name
            if target.exists():
                stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                target = rej_new / f"{item.name}_{stamp}"
            shutil.move(str(item), str(target))
        try: rej_old.rmdir()
        except OSError: pass

    if off_old.exists():
        off_new.mkdir(parents=True, exist_ok=True)
        for item in off_old.iterdir():
            target = off_new / item.name
            if target.exists():
                stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                target = off_new / f"{item.name}_{stamp}"
            shutil.move(str(item), str(target))
        try: off_old.rmdir()
        except OSError: pass

    if hist.exists():
        try: hist.rmdir()
        except OSError: pass

def _migrate_positions_internal_three_digit():  # pragma: no cover
    pos_root = BASE_DIR / "Positions"
    if not pos_root.exists():
        return
    file_map = {
        "10_Position.md": "010_Position.md",
        "20_CoverLetter.md": "020_CoverLetter.md",
        "30_Notes.md": "030_Notes.md",
        "40_Terms.md": "040_Terms.md",
    }
    dir_map = {
        "50_Interviews": "050_Interviews",
        "60_Clippings": "060_Clippings",
    }
    for status_dir in pos_root.iterdir():
        if not status_dir.is_dir():
            continue
        for pos_dir in status_dir.iterdir():
            if not pos_dir.is_dir():
                continue
            for old, new in file_map.items():
                op, np = pos_dir / old, pos_dir / new
                if op.exists() and not np.exists():
                    try: shutil.move(str(op), str(np))
                    except Exception as e: print(f"⚠️  File migration skip {op.name}: {e}")
            for old, new in dir_map.items():
                od, nd = pos_dir / old, pos_dir / new
                if od.exists() and not nd.exists():
                    try: shutil.move(str(od), str(nd))
                    except Exception as e: print(f"⚠️  Dir migration skip {od.name}: {e}")

def ensure_structure():
    (BASE_DIR / "Positions").mkdir(parents=True, exist_ok=True)
    _migrate_status_dirs()
    for folder in STATUSES.keys():
        (BASE_DIR / "Positions" / folder).mkdir(parents=True, exist_ok=True)

    refs = BASE_DIR / "References"
    refs.mkdir(parents=True, exist_ok=True)
    _migrate_references()
    _migrate_terms_file_to_folder()

    # Ensure Terms is a folder with README and a sample
    terms_dir = refs / "Terms"
    terms_dir.mkdir(parents=True, exist_ok=True)
    readme = terms_dir / "README.md"
    if not readme.exists():
        readme.write_text("# Terms (Glossary)\n\nAdd one file per term here.\n", encoding="utf-8")
    sample = terms_dir / "Sample_Term.md"
    if not sample.exists():
        sample.write_text("# Sample Term\n\nShort definition and references.\n", encoding="utf-8")

    # Other reference folders
    for folder, files in REFERENCE_TEMPLATES.items():
        fdir = refs / folder
        fdir.mkdir(parents=True, exist_ok=True)
        for fname, content in files.items():
            p = fdir / fname
            if not p.exists():
                p.write_text(content, encoding="utf-8")

    _migrate_positions_internal_three_digit()

def create_base_structure():
    ensure_structure()
    logger.info("create_base_structure")
    print(f"✅ Base structure ensured at {BASE_DIR}")

# ---------- helpers for numbering & statuses ----------
_PREFIX_RE = re.compile(r"^(\d{3})_")

def _get_3digit_prefix(name: str) -> Optional[int]:
    m = _PREFIX_RE.match(name)  # pragma: no cover
    if not m:  # pragma: no cover
        return None  # pragma: no cover
    try:  # pragma: no cover
        return int(m.group(1))  # pragma: no cover
    except ValueError:  # pragma: no cover
        return None  # pragma: no cover

def _iter_all_position_dirs() -> List[Path]:
    """Return list of all position directories across all statuses."""
    pos_root = BASE_DIR / "Positions"
    out: List[Path] = []
    if not pos_root.exists():
        return out  # pragma: no cover
    for status_dir in pos_root.iterdir():
        if not status_dir.is_dir():
            continue  # pragma: no cover
        if status_dir.name not in STATUSES:
            continue  # pragma: no cover
        for d in status_dir.iterdir():
            if d.is_dir():  # pragma: no cover
                out.append(d)  # pragma: no cover
    return out

def _next_number_3digit_global() -> int:
    """
    GLOBAL numbering across ALL statuses.
    Finds max 3-digit prefix among every position folder in Positions/*.
    """
    max3 = 0
    for d in _iter_all_position_dirs():
        v = _get_3digit_prefix(d.name)  # pragma: no cover
        if v and v > max3:  # pragma: no cover
            max3 = v  # pragma: no cover
    nxt = max3 + 10 if max3 else 10
    return min(nxt, 990)

def _slugify(name: str) -> str:
    safe = "".join(ch if ch.isalnum() or ch in "-_ ." else "_" for ch in name).strip()
    return "_".join(safe.split())

def resolve_status(user_status: str) -> str:
    if not user_status:
        raise ValueError("Empty status")
    if user_status.isdigit() and len(user_status) == 3:
        for k in STATUSES.keys():
            if k.startswith(user_status):
                return k
        raise ValueError(f"Unknown status prefix '{user_status}'")
    ns = _norm(user_status)
    for k in STATUSES.keys():
        if ns == _norm(k):
            return k
    if ns in STATUS_ALIAS_MAP:
        return STATUS_ALIAS_MAP[ns]
    if ns in OLD_STATUS_NORM:  # pragma: no cover
        return OLD_STATUS_NORM[ns]
    allowed = ", ".join(sorted({alias for alias in STATUS_ALIAS_MAP.keys()}))
    raise ValueError(f"Unknown status '{user_status}'. Use one of: {allowed}.")

# ---------- core ops ----------
def add_position(status: str, title: str):
    """
    Create NEW position in given status with GLOBAL numbering.
    """
    ensure_structure()
    status_key = resolve_status(status)
    status_dir = BASE_DIR / "Positions" / status_key

    new_num = _next_number_3digit_global()
    folder_name = f"{new_num:03d}_{_slugify(title)}"
    pos_dir = status_dir / folder_name
    pos_dir.mkdir(parents=True, exist_ok=True)

    for fname, content in TEMPLATES.items():
        (pos_dir / fname).write_text(content, encoding="utf-8")
    (pos_dir / "050_Interviews").mkdir(exist_ok=True)
    (pos_dir / "060_Clippings").mkdir(exist_ok=True)

    logger.info("add_position status=%s title=%s", status_key, title)
    print(f"✅ Added position: Positions/{status_key}/{folder_name}")

def _latest_entry(path: Path) -> Optional[Path]:  # pragma: no cover
    items = [p for p in path.iterdir() if p.is_file() or p.is_dir()]
    if not items:
        return None
    return max(items, key=lambda p: p.stat().st_mtime)

def _zip_dir(src: Path, dst_dir: Path, base_name: Optional[str] = None) -> Path:  # pragma: no cover
    base = sanitize_name(base_name or src.name)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    archive_base = dst_dir / f"{base}_{stamp}"
    archive_full = shutil.make_archive(str(archive_base), "zip", root_dir=str(src))
    return Path(archive_full)

def _copy_any(src: Path, dst_dir: Path) -> Path:  # pragma: no cover
    """
    Copy file or directory src into dst_dir, return the new path.
    Guards:
      - If dst_dir is inside src (self-copy), fallback to ZIP.
      - Sanitize directory name for Windows.
    """
    dst_dir.mkdir(parents=True, exist_ok=True)

    # Prevent copying a folder into its own subtree
    if src.is_dir() and is_subpath(dst_dir, src):
        return _zip_dir(src, dst_dir)

    if src.is_dir():
        dest_name = sanitize_name(src.name)
        target = dst_dir / dest_name
        if target.exists():
            stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            target = dst_dir / f"{dest_name}_{stamp}"
        try:
            shutil.copytree(src, target)
            return target
        except OSError:
            return _zip_dir(src, dst_dir, base_name=dest_name)
    else:
        target = dst_dir / sanitize_name(src.name)
        if target.exists():
            stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            target = dst_dir / f"{target.stem}_{stamp}{target.suffix}"
        shutil.copy2(src, target)
        return target

def _derive_title_from_source(src: Path) -> str:  # pragma: no cover
    name = src.stem if src.is_file() else src.name
    return _slugify(name)

def import_from_clippings(clippings_root: Path, source: str, explicit_title: Optional[str] = None):
    """
    Import file/folder from clippings directory into a NEW position in 010_Drafts.
    The position receives a 3-digit index ONCE (GLOBAL sequence). Later moves KEEP the same folder name.
    After successful import, the ORIGINAL source inside clippings_dir is DELETED.
    """
    ensure_structure()

    # Guard: clippings_dir must not be the vault root
    clippings_root = Path(clippings_root).expanduser().resolve()
    if clippings_root == BASE_DIR:
        print("❌ clippings_dir points to your vault root. Pass the Clippings folder, not the vault.")  # pragma: no cover
        return  # pragma: no cover

    drafts_dir = BASE_DIR / "Positions" / "010_Drafts"
    drafts_dir.mkdir(parents=True, exist_ok=True)

    root = clippings_root
    if not root.exists() or not root.is_dir():
        print(f"❌ Clippings folder not found: {root}")  # pragma: no cover
        return  # pragma: no cover

    # Resolve source
    if source.lower() == "latest":
        src = _latest_entry(root)  # pragma: no cover
        if not src:  # pragma: no cover
            print("❌ No files/folders in clippings folder")  # pragma: no cover
            return  # pragma: no cover
    else:
        cand = Path(source)
        src = (root / source).resolve() if not cand.is_absolute() else cand.resolve()
        if not src.exists():
            print(f"❌ Source not found: {src}")  # pragma: no cover
            return  # pragma: no cover

    title = explicit_title or _derive_title_from_source(src)

    new_num = _next_number_3digit_global()
    folder_name = f"{new_num:03d}_{title}"
    pos_dir = drafts_dir / folder_name
    pos_dir.mkdir(parents=True, exist_ok=True)

    for fname, content in TEMPLATES.items():
        (pos_dir / fname).write_text(content, encoding="utf-8")
    (pos_dir / "050_Interviews").mkdir(exist_ok=True)
    clips_dir = pos_dir / "060_Clippings"
    clips_dir.mkdir(exist_ok=True)

    copied_path = _copy_any(src, clips_dir)

    meta_path = pos_dir / "010_Position.md"
    meta = meta_path.read_text(encoding="utf-8")
    imported_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    def _set_field(text: str, field: str, value: str) -> str:
        marker = f"**{field}:**"
        lines = text.splitlines()
        for i, ln in enumerate(lines):
            if ln.strip().startswith(marker):
                lines[i] = f"{marker} {value}"
                return "\n".join(lines)
        return f"{marker} {value}\n" + text  # pragma: no cover

    meta = _set_field(meta, "Title", title.replace("_", " "))
    meta = _set_field(meta, "Source", str(root))
    meta = _set_field(meta, "Source file/folder", str(copied_path.relative_to(pos_dir)))
    meta = _set_field(meta, "Imported at", imported_at)
    meta_path.write_text(meta, encoding="utf-8")

    # NEW: delete original from clippings if it was inside clippings_root
    if is_subpath(src, root):
        try:
            if src.is_dir():
                shutil.rmtree(src)  # pragma: no cover
            else:
                src.unlink()
            print(f"🧹 Removed source from clippings: {src}")
        except Exception as e:  # pragma: no cover
            print(f"⚠️  Could not remove source '{src}': {e}")  # pragma: no cover
    else:  # pragma: no cover
        print("⚠️  Source was outside clippings_dir — skip deleting original.")  # pragma: no cover

    logger.info("import_from_clippings src=%s title=%s", src, title)
    print("✅ Imported new position from clippings")
    print(f"   → Positions/010_Drafts/{folder_name}")
    print(f"   → with source: {copied_path.relative_to(pos_dir)}")

def import_with_tag(clippings_root: Path, tag: str = "job"):
    """Import all files from clippings_root containing given tag in YAML meta."""
    ensure_structure()
    root = Path(clippings_root).expanduser().resolve()
    if not root.exists() or not root.is_dir():
        print(f"❌ Clippings folder not found: {root}")  # pragma: no cover
        return  # pragma: no cover

    def _extract_tags(text: str) -> List[str]:
        if not text.startswith("---"):
            return []
        try:
            after = text.split("---", 2)[1]
        except IndexError:  # pragma: no cover
            return []
        try:
            meta = yaml.safe_load(after) if yaml else {}
        except Exception:  # pragma: no cover
            meta = {}
        tags = meta.get("tags", []) if isinstance(meta, dict) else []
        if isinstance(tags, str):
            tags = [tags]
        return [str(t).lower() for t in tags]

    wanted = tag.lower()
    imported = 0
    for item in root.iterdir():
        if item.is_file():
            try:
                text = item.read_text(encoding="utf-8")
            except Exception:  # pragma: no cover
                continue  # pragma: no cover
            if wanted in _extract_tags(text):
                import_from_clippings(root, item.name)
                imported += 1
    logger.info("import_with_tag dir=%s tag=%s count=%s", root, tag, imported)
    print(f"✅ Imported {imported} items with tag '{tag}'")

# ---------- move logic (NO renumbering; shutil.move removes source) ----------
def find_position_candidates(pos_name: str) -> List[Tuple[str, Path]]:  # pragma: no cover
    ensure_structure()
    candidates: List[Tuple[str, Path]] = []
    for status_key in STATUSES.keys():
        p = BASE_DIR / "Positions" / status_key / pos_name
        if p.exists() and p.is_dir():
            candidates.append((status_key, p))
    return candidates

def _infer_status_from_abs_path(p: Path) -> Tuple[str, Path]:  # pragma: no cover
    """
    Given absolute path to a position directory, infer <status_key, position_dir>.
    Raises FileNotFoundError if not inside this vault.
    """
    p = p.resolve()
    positions_root = (BASE_DIR / "Positions").resolve()
    if not is_subpath(p, positions_root):
        raise FileNotFoundError("Position path is outside this vault's Positions directory.")
    cur = p
    while cur != positions_root and cur.parent != cur:
        parent = cur.parent
        if parent.name in STATUSES and cur.is_dir():
            return parent.name, cur
        cur = parent
    raise FileNotFoundError("Could not infer status from the provided path.")

def resolve_position_arg(pos_arg: str) -> Tuple[str, Path]:  # pragma: no cover
    """
    Resolve a position argument which can be:
    - "<statusAlias>/<positionFolder>"
    - "<positionFolder>" (searched across statuses; error if ambiguous)
    - "<absolute path to position folder>"
    """
    pos_arg_norm = pos_arg.replace("\\", "/")

    # Absolute path support
    cand_path = Path(pos_arg_norm)
    if cand_path.is_absolute():
        return _infer_status_from_abs_path(cand_path)

    if "/" in pos_arg_norm:
        left, right = pos_arg_norm.split("/", 1)
        src_status_key = resolve_status(left)
        src_path = BASE_DIR / "Positions" / src_status_key / right
        if not src_path.exists() or not src_path.is_dir():
            raise FileNotFoundError(f"Position not found at: Positions/{src_status_key}/{right}")
        return src_status_key, src_path

    matches = find_position_candidates(pos_arg_norm)
    if not matches:
        raise FileNotFoundError(f"Position folder '{pos_arg}' not found in any status.")
    if len(matches) > 1:
        options = ", ".join([m[0] for m in matches])
        raise RuntimeError(
            f"Ambiguous position '{pos_arg}' found in multiple statuses: {options}. "
            f"Disambiguate with 'applied/{pos_arg}' (etc.) or pass an absolute path."
        )
    return matches[0]

def move_position_auto(pos_arg: str, dst_status: str):
    ensure_structure()
    src_status_key, src_path = resolve_position_arg(pos_arg)
    dst_status_key = resolve_status(dst_status)

    if not src_path.exists():  # pragma: no cover
        print(f"❌ Position not found: {pos_arg}")  # pragma: no cover
        return  # pragma: no cover

    dst_dir = BASE_DIR / "Positions" / dst_status_key
    dst_dir.mkdir(parents=True, exist_ok=True)

    new_name = src_path.name  # keep original numbering/name (no renumbering on move)
    target = dst_dir / new_name
    if target.exists():  # pragma: no cover
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")  # pragma: no cover
        target = dst_dir / f"{new_name}_{stamp}"  # pragma: no cover

    shutil.move(str(src_path), str(target))  # real move: source folder is removed
    logger.info("move_position src=%s dst=%s", src_status_key, dst_status_key)
    print(f"✅ Moved: {src_status_key}/{src_path.name} → {dst_status_key}/{target.name}")

# ---------- clip into existing position ----------
def add_clipping_to_position(status: str, pos_name: str, clip_source: str, new_name: Optional[str] = None):  # pragma: no cover
    ensure_structure()
    status_key = resolve_status(status)
    pos_dir = BASE_DIR / "Positions" / status_key / pos_name
    if not pos_dir.exists():
        print(f"❌ Position not found: Positions/{status_key}/{pos_name}")
        return
    target_dir = pos_dir / "060_Clippings"
    target_dir.mkdir(exist_ok=True)

    if clip_source.lower() == "latest":
        default_dir = Path(os.environ.get("OBSIDIAN_CLIPPINGS_DIR", "~/Obsidian/Clippings")).expanduser()
        if not default_dir.exists():
            print(f"❌ Set OBSIDIAN_CLIPPINGS_DIR or pass an explicit path")
            return
        src = _latest_entry(default_dir)
        if not src:
            print("❌ No files in OBSIDIAN_CLIPPINGS_DIR")
            return
    else:
        src = Path(clip_source).expanduser().resolve()
        if not src.exists():
            print(f"❌ Source not found: {src}")
            return

    if src.is_dir() and is_subpath(target_dir, src):
        copied = _zip_dir(src, target_dir)
    else:
        if new_name:
            nn = sanitize_name(new_name)
            if src.is_dir():
                dst = target_dir / nn
                if dst.exists():
                    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                    dst = target_dir / f"{nn}_{stamp}"
                try:
                    shutil.copytree(src, dst)
                    copied = dst
                except OSError:
                    copied = _zip_dir(src, target_dir, base_name=nn)
            else:
                dst = target_dir / (nn if Path(nn).suffix else f"{nn}{src.suffix}")
                shutil.copy2(src, dst)
                copied = dst
        else:
            copied = _copy_any(src, target_dir)

    logger.info("add_clipping status=%s pos=%s src=%s", status_key, pos_name, clip_source)
    print(f"✅ Clipping added: {copied.relative_to(BASE_DIR)}")

# ---------- CLI ----------
USAGE = (
    "Usage:\n"
    "  init\n"
    "  add <status> <title>\n"
    "  move <positionFolder | statusAlias/positionFolder | /absolute/path/to/position> <dst_status>\n"
    "  clip <status> <pos_name> <latest|/path/to/file> [new_name]\n"
    "  import <clippings_dir> <latest|name|path> [title]\n"
    "  import-tag <clippings_dir> [tag]  # default tag: job\n"
    "\n"
    "Statuses (aliases): drafts | misfits | fits | applied | replies | interviews | rejected | offers\n"
    "Environment:\n"
    "  JOB_VAULT_DIR   - root of job_find (default: .)\n"
)

def main(argv: List[str]) -> int:  # pragma: no cover
    if len(argv) < 2:
        print(USAGE)
        return 0
    cmd = argv[1].lower()

    if cmd == "init":
        create_base_structure()
        return 0

    elif cmd == "add":
        if len(argv) < 4:
            print("Example: py job_vault.py add applied Backend_Developer_Google")
            return 1
        status = argv[2]
        title = "_".join(argv[3:])
        add_position(status, title)
        return 0

    elif cmd == "move":
        if len(argv) < 4:
            print("Examples:\n"
                  "  py job_vault.py move 123_Backend_Developer replies\n"
                  "  py job_vault.py move applied/123_Backend_Developer replies\n"
                  "  py job_vault.py move \"C:\\work\\zork_kb\\job_find\\Positions\\010_Drafts\\010_Frontend\" applied")
            return 1
        pos_arg = argv[2]
        dst_status = argv[3]
        try:
            move_position_auto(pos_arg, dst_status)
        except Exception as e:
            print(f"❌ {e}")
            return 1
        return 0

    elif cmd == "clip":
        if len(argv) < 5:
            print("Example: py job_vault.py clip interviews 123_Frontend JD.md [JD_Parsed.md]")
            return 1
        add_clipping_to_position(argv[2], argv[3], argv[4], argv[5] if len(argv) > 5 else None)
        return 0

    elif cmd == "import":
        if len(argv) < 4:
            print('Example: py job_vault.py import "C:\\\\work\\\\zork_kb\\\\Clippings" latest [Senior_Data_Engineer]')
            return 1
        clippings_dir = argv[2]
        source = argv[3]
        title = argv[4] if len(argv) > 4 else None
        import_from_clippings(clippings_dir, source, title)
        return 0

    elif cmd == "import-tag":
        if len(argv) < 3:
            print('Example: py job_vault.py import-tag "C:\\\\work\\\\Clippings" [tag]')
            return 1
        clippings_dir = argv[2]
        tag = argv[3] if len(argv) > 3 else "job"
        import_with_tag(clippings_dir, tag)
        return 0

    else:
        print("❌ Unknown command")
        print(USAGE)
        return 1

if __name__ == "__main__":  # pragma: no cover
    sys.exit(main(sys.argv))
