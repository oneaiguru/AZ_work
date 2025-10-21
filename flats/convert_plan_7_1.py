from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from shapely.geometry import LineString, Point, Polygon
from shapely.ops import unary_union
from skimage import measure


ROOT = Path(__file__).resolve().parent
IMAGE_PATH = ROOT / "7.1 2Д.png"
OUTPUT_DIR = ROOT / "testFlat4"
OUTPUT_PATH = OUTPUT_DIR / "plan_2d_converted.json"

# Dimension reference extracted via OCR: 1410 mm across 166 pixels of the plan
REFERENCE_MM = 1410.0
REFERENCE_PX = 166.0


@dataclass
class OpeningProjection:
    edge: Tuple[Tuple[float, float], Tuple[float, float]]
    offset: float


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


def project_point_to_outline(point: Tuple[float, float], outline: Polygon) -> OpeningProjection:
    coords = list(outline.exterior.coords)
    best: OpeningProjection | None = None
    best_distance: float | None = None
    p = Point(point)
    for idx in range(len(coords) - 1):
        a = coords[idx]
        b = coords[idx + 1]
        segment = LineString([a, b])
        proj_distance = segment.project(p)
        closest = segment.interpolate(proj_distance)
        distance = p.distance(closest)
        if best_distance is None or distance < best_distance:
            best_distance = distance
            best = OpeningProjection(edge=(tuple(map(float, a)), tuple(map(float, b))), offset=float(proj_distance))
    if best is None:
        raise PlanExtractionError("Не удалось найти ближайший отрезок для проёма")
    return best


def to_mm(x_px: float, y_px: float, minx: float, miny: float, scale: float, height: int) -> Tuple[float, float]:
    x_mm = (x_px - minx) * scale
    y_mm = (height - y_px - miny) * scale
    return x_mm, y_mm


def detect_windows(arr: np.ndarray, minx: float, miny: float, scale: float, outline: Polygon) -> List[Dict[str, object]]:
    gray = np.mean(arr, axis=2)
    wall_mask = gray < 80
    labeled, num = ndi.label(wall_mask)
    height, width = wall_mask.shape
    raw_entries: List[Dict[str, object]] = []
    for idx in range(1, num + 1):
        component = labeled == idx
        area = int(component.sum())
        if not (30 <= area <= 600):
            continue
        ys, xs = np.where(component)
        if ys.size == 0:
            continue
        y0, y1 = ys.min(), ys.max()
        x0, x1 = xs.min(), xs.max()
        # Only consider thin horizontal components near нижняя стена
        if (y0 < height - 50) or (y1 - y0 > 15) or (x1 - x0 < 10):
            continue
        cx_px = (x0 + x1) / 2.0
        cy_px = (y0 + y1) / 2.0
        center_mm = to_mm(cx_px, cy_px, minx, miny, scale, height)
        width_mm = (x1 - x0 + 1) * scale
        projection = project_point_to_outline(center_mm, outline)
        raw_entries.append(
            {
                "edge": [
                    [round(projection.edge[0][0], 1), round(projection.edge[0][1], 1)],
                    [round(projection.edge[1][0], 1), round(projection.edge[1][1], 1)],
                ],
                "centerOffset": round(projection.offset, 1),
                "width": round(width_mm, 1),
            }
        )
    raw_entries.sort(key=lambda w: w["centerOffset"])
    for idx, entry in enumerate(raw_entries, start=1):
        entry.update({"id": f"window_{idx}", "height": 1570.0, "sillHeight": 480.0})
    return raw_entries


def detect_balcony(arr: np.ndarray, minx: float, miny: float, scale: float) -> Tuple[List[List[float]], Polygon]:
    target_color = np.array([193, 176, 213])
    mask = np.linalg.norm(arr - target_color, axis=2) < 30
    labeled, num = ndi.label(mask)
    areas = ndi.sum(mask, labeled, index=range(1, num + 1))
    candidates: List[Tuple[int, int]] = []
    for label_idx, area in enumerate(areas, start=1):
        if 4000 <= area <= 7000:
            ys, _ = np.where(labeled == label_idx)
            if ys.size == 0:
                continue
            candidates.append((int(ys.min()), label_idx))
    if not candidates:
        raise PlanExtractionError("Не удалось определить геометрию балкона")
    top_candidate = min(candidates)[1]
    component_mask = labeled == top_candidate
    contour = max(measure.find_contours(component_mask.astype(float), 0.5), key=len)
    height = arr.shape[0]
    coords = []
    for y, x in contour:
        x_mm, y_mm = to_mm(float(x), float(y), minx, miny, scale, height)
        coords.append((x_mm, y_mm))
    polygon = Polygon(coords).simplify(5)
    vertices = [[round(x, 1), round(y, 1)] for x, y in polygon.exterior.coords]
    return vertices, polygon


def detect_balcony_door(arr: np.ndarray, minx: float, miny: float, scale: float, outline: Polygon) -> Dict[str, object]:
    gray = np.mean(arr, axis=2)
    wall_mask = gray < 80
    labeled, num = ndi.label(wall_mask)
    height = wall_mask.shape[0]
    door_candidate = None
    for idx in range(1, num + 1):
        component = labeled == idx
        area = int(component.sum())
        if not (150 <= area <= 4000):
            continue
        ys, xs = np.where(component)
        if ys.size == 0:
            continue
        if ys.min() > 150:
            continue
        x0, x1 = xs.min(), xs.max()
        y0, y1 = ys.min(), ys.max()
        width = x1 - x0
        height_px = y1 - y0
        if width < 20 or height_px < 20:
            continue
        door_candidate = (x0, y0, x1, y1)
        break
    if door_candidate is None:
        raise PlanExtractionError("Не удалось определить дверной проём на балкон")
    x0, y0, x1, y1 = door_candidate
    cx_px = (x0 + x1) / 2.0
    cy_px = (y0 + y1) / 2.0
    center_mm = to_mm(cx_px, cy_px, minx, miny, scale, height)
    width_mm = (x1 - x0 + 1) * scale
    projection = project_point_to_outline(center_mm, outline)
    door = {
        "id": "door_balcony_1",
        "edge": [
            [round(projection.edge[0][0], 1), round(projection.edge[0][1], 1)],
            [round(projection.edge[1][0], 1), round(projection.edge[1][1], 1)],
        ],
        "offset": round(projection.offset, 1),
        "width": round(width_mm, 1),
        "height": 2040.0,
        "swing": "out",
        "hinge": "right",
        "from": "z_main",
        "to": "balcony_1",
    }
    return door


def build_json(
    outline_mm: Polygon,
    windows: List[Dict[str, object]],
    balcony_vertices: List[List[float]],
    balcony_door: Dict[str, object],
) -> dict:
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
        "balconies": [
            {
                "id": "balcony_1",
                "name": "Лоджия",
                "polygon": balcony_vertices,
                "accessDoorId": balcony_door["id"],
            }
        ],
        "openings": {
            "doors": [balcony_door],
            "windows": windows,
        },
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
    arr, mask = load_plan_mask(IMAGE_PATH)
    outline_px = extract_outline(mask)
    scale = REFERENCE_MM / REFERENCE_PX
    outline_mm = polygon_to_mm(simplify_polygon(outline_px, 0.8), scale)
    minx, miny, _, _ = outline_px.bounds
    windows = detect_windows(arr, minx, miny, scale, outline_mm)
    balcony_vertices, _ = detect_balcony(arr, minx, miny, scale)
    balcony_door = detect_balcony_door(arr, minx, miny, scale, outline_mm)
    plan_json = build_json(outline_mm, windows, balcony_vertices, balcony_door)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(plan_json, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Saved {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
