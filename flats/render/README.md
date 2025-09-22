# Apartment Render Scripts

This folder contains the detailed description of the apartment concept "Лесной свет" and a Python toolchain that builds a warm, high-fidelity 3D visualization from it.

## Files

- `apartment_layout.json` — исходное описание помещений, мебели, мягкого декора, световых сценариев и конструктивных элементов.
- `generate_3d_layout.py` — скрипт, который читает JSON и создает многослойный 3D-рендер с текстурами, стенами, оконными проёмами и световыми акцентами.

## Требования

Для выполнения скрипта понадобится Python 3.9+, `matplotlib` и `numpy`. Установите зависимости через:

```bash
pip install matplotlib numpy
```

(при необходимости используйте виртуальное окружение).

## Как запустить

```bash
python generate_3d_layout.py --output apartment_render.png
```

Опционально можно открыть окно с интерактивным просмотром, добавив ключ `--show`. Все параметры доступны через `--help`.

После выполнения изображение будет сохранено в указанном файле (по умолчанию `apartment_render.png` в этой же папке). Рендер включает тщательно расположенные стены, текстуры пола (паркет, плитка), мебель, текстиль, зелёные акценты и мягкое освещение, создавая атмосферу квартиры, в которой хочется жить.
