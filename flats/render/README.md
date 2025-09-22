# Apartment Render Scripts

This folder contains the conceptual description of the "Северное тепло" apartment layout and a Python script that builds a simple 3D visualization from it.

## Files

- `apartment_layout.json` — исходное описание помещений, мебели и мягких элементов.
- `generate_3d_layout.py` — скрипт, который читает JSON и создает 3D-рендер в виде PNG-файла.

## Требования

Для выполнения скрипта понадобится Python 3.9+ и библиотека `matplotlib`. Установите зависимости через:

```bash
pip install matplotlib
```

(при необходимости используйте виртуальное окружение).

## Как запустить

```bash
python generate_3d_layout.py --output apartment_render.png
```

Опционально можно открыть окно с интерактивным просмотром, добавив ключ `--show`. Все параметры доступны через `--help`.

После выполнения изображение будет сохранено в указанном файле (по умолчанию `apartment_render.png` в этой же папке).
