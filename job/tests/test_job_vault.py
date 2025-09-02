from pathlib import Path
import importlib.util
import pytest

from pathlib import Path
import importlib.util
import pytest

spec = importlib.util.spec_from_file_location("job_vault", Path(__file__).resolve().parents[1] / "job_vault.py")
job_vault = importlib.util.module_from_spec(spec)
spec.loader.exec_module(job_vault)


@pytest.fixture
def vault_tmp(tmp_path, monkeypatch):
    monkeypatch.setenv('JOB_VAULT_DIR', str(tmp_path))
    job_vault.BASE_DIR = Path(str(tmp_path))
    job_vault.LOG_FILE = job_vault.BASE_DIR / 'job_vault.log'
    job_vault.logger.handlers.clear()
    handler = job_vault.logging.FileHandler(job_vault.LOG_FILE)
    formatter = job_vault.logging.Formatter('%(message)s')
    handler.setFormatter(formatter)
    job_vault.logger.addHandler(handler)
    job_vault.logger.setLevel(job_vault.logging.INFO)
    return tmp_path


def test_add_and_move_with_prefix_and_logging(vault_tmp):
    job_vault.create_base_structure()
    job_vault.add_position('drafts', 'Test Position')
    job_vault.move_position_auto('010_Test_Position', '015')
    dst = job_vault.BASE_DIR / 'Positions' / '015_Misfits' / '010_Test_Position'
    assert dst.exists()
    assert job_vault.LOG_FILE.exists()
    content = job_vault.LOG_FILE.read_text()
    assert 'add_position' in content and 'move_position' in content


def test_import_with_tag(vault_tmp, tmp_path):
    clippings = tmp_path / 'clips'
    clippings.mkdir()
    (clippings / 'a.md').write_text('---\ntags: [job]\n---\ntext', encoding='utf-8')
    (clippings / 'b.md').write_text('---\ntags: [other]\n---\ntext', encoding='utf-8')
    job_vault.import_with_tag(clippings, 'job')
    drafts = job_vault.BASE_DIR / 'Positions' / '010_Drafts'
    items = list(drafts.iterdir())
    assert len(items) == 1
    assert (clippings / 'a.md').exists() is False
    assert (clippings / 'b.md').exists() is True


def test_resolve_status_numeric_prefix():
    assert job_vault.resolve_status('015') == '015_Misfits'
    assert job_vault.resolve_status('misfit') == '015_Misfits'
    assert job_vault.resolve_status('015_Misfits') == '015_Misfits'
    with pytest.raises(ValueError):
        job_vault.resolve_status('')
    with pytest.raises(ValueError):
        job_vault.resolve_status('999')
    with pytest.raises(ValueError):
        job_vault.resolve_status('unknown')


def test_add_clipping_to_position(vault_tmp, tmp_path):
    job_vault.create_base_structure()
    job_vault.add_position('drafts', 'Clip Test')
    source_file = tmp_path / 'src.txt'
    source_file.write_text('hello', encoding='utf-8')
    job_vault.add_clipping_to_position('010', '010_Clip_Test', str(source_file))
    clip = job_vault.BASE_DIR / 'Positions' / '010_Drafts' / '010_Clip_Test' / '060_Clippings' / 'src.txt'
    assert clip.exists()
