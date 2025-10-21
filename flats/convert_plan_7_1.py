from __future__ import annotations

import json
from pathlib import Path
from typing import List, Tuple

import numpy as np
from PIL import Image
from shapely.geometry import Polygon
from shapely.ops import unary_union
from skimage import measure


ROOT = Path(__file__).resolve().parent
IMAGE_PATH = ROOT / "7.1 2Д.png"
OUTPUT_DIR = ROOT / "testFlat4"
OUTPUT_PATH = OUTPUT_DIR / "plan_2d_converted.json"

# Dimension reference extracted via OCR: 1410 mm across 166 pixels of the plan
REFERENCE_MM = 1410.0
REFERENCE_PX = 166.0


class PlanExtractionError(RuntimeError):
    """Raised when the plan outline cannot be extracted."""

    pass


def load_plan_mask(image_path: Path) -> Tuple[np.ndarray, np.ndarray]:
    image = Image.open(image_path).convert("RGB")
    arr = np.array(image)
    # Anything darker than near-white is treated as part of the drawing.
    mask = np.all(arr < 240, axis=2)
    return arr, mask


def extract_outline(mask: np.ndarray) -> Polygon:
    contours = measure.find_contours(mask.astype(float), 0.5)
    polygons: List[Polygon] = []
    height = mask.shape[0]
    for contour in contours:
        if contour.shape[0] < 40:
            continue
        coords = [(float(x), float(height - y)) for y, x in contour]
        poly = Polygon(coords)
        if poly.area < 500.0:
            continue
        polygons.append(poly)
    if not polygons:
        raise PlanExtractionError("Не удалось выделить контур квартиры")
    polygons.sort(key=lambda p: p.area, reverse=True)
    return polygons[0]


def polygon_to_mm(poly: Polygon, scale: float) -> Polygon:
    minx, miny, _, _ = poly.bounds

    def transform(coords: List[Tuple[float, float]]) -> List[Tuple[float, float]]:
        return [((x - minx) * scale, (y - miny) * scale) for x, y in coords]

    shell = transform(list(poly.exterior.coords))
    holes = [transform(list(ring.coords)) for ring in poly.interiors]
    return Polygon(shell, holes)


def simplify_polygon(poly: Polygon, tolerance: float) -> Polygon:
    simplified = poly.simplify(tolerance, preserve_topology=True)
    if simplified.is_empty:
        return poly
    if isinstance(simplified, Polygon):
        return simplified
    unioned = unary_union(simplified)
    if isinstance(unioned, Polygon):
        return unioned
    largest = max(unioned.geoms, key=lambda g: g.area)
    return largest


def build_json(outline_mm: Polygon) -> dict:
    minx, miny, maxx, maxy = outline_mm.bounds
    outline_coords = [[round(x, 1), round(y, 1)] for x, y in outline_mm.exterior.coords]

    entrance_edge = [[round(0.0, 1), round(123.2, 1)], [round(0.0, 1), round(1813.5, 1)]]

    return {
        "version": "apartment.v1",
        "units": {"length": "mm"},
        "coordinateSystem": {
            "origin": [0.0, 0.0],
            "x": "right",
            "y": "up",
            "elevationZero": 0.0,
        },
        "outline": {
            "type": "Polygon",
            "vertices": outline_coords,
        },
        "entrance": {
            "id": "door_entrance",
            "edge": entrance_edge,
            "offset": round(900.0, 1),
            "width": 900.0,
            "height": 2040.0,
            "swing": "in",
            "hinge": "left",
            "from": "exterior",
            "to": "z_main",
        },
        "zones": [
            {
                "id": "z_main",
                "name": "Жилая зона",
                "polygon": outline_coords,
            }
        ],
        "balconies": [],
        "openings": {"doors": [], "windows": []},
        "waterPoints": [],
        "dimensions": [
            {
                "id": "overall_width",
                "type": "linear",
                "from": [0.0, 0.0],
                "to": [round(maxx - minx, 1), 0.0],
                "value": round(maxx - minx, 1),
            },
            {
                "id": "overall_depth",
                "type": "linear",
                "from": [0.0, 0.0],
                "to": [0.0, round(maxy - miny, 1)],
                "value": round(maxy - miny, 1),
            },
        ],
    }


def main() -> None:
    _, mask = load_plan_mask(IMAGE_PATH)
    outline_px = extract_outline(mask)
    scale = REFERENCE_MM / REFERENCE_PX
    outline_mm = polygon_to_mm(simplify_polygon(outline_px, 0.8), scale)
    plan_json = build_json(outline_mm)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(plan_json, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Saved {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
