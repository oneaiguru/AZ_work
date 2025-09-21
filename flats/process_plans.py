import base64
import json
import re
from pathlib import Path
from typing import Dict, List, Tuple

import fitz
import numpy as np
from scipy import ndimage as ndi
from skimage import measure
from sklearn.cluster import KMeans

PDF_PATH = Path('flats/Планировки Возрождение.pdf')
OUTPUT_DIR = Path('flats/plans')
SCALE = 2  # render scale multiplier relative to PDF resolution
MAX_BOTTOM_MARGIN = 50  # pixels to ignore at bottom due to legend
BALCONY_AREA_RANGE = (500, 6000)
MAIN_AREA_THRESHOLD = 6000
WET_AREA_RANGE = (600, 6000)
SIMPLIFY_TOLERANCE = 2.0
CEILING_HEIGHT_M = 2.60
KMEANS_CLUSTERS = 6
MIN_CLUSTER_SHARE = 0.01
MIN_TOLERANCE = 12
MAX_TOLERANCE = 45
RNG = np.random.default_rng(0)


def ensure_output_dir() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def slugify(value: str) -> str:
    slug = re.sub(r'\s+', '_', value.strip())
    slug = re.sub(r'[^\w_\-]+', '', slug)
    return slug.strip('_') or 'plan'


def extract_labels(page: fitz.Page) -> Dict[str, str]:
    text = page.get_text('text')
    plan_label = None
    block_label = None
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line.startswith('Планировка'):
            plan_label = line
        elif line.startswith('Блок-секция'):
            block_label = line
    return {
        'plan_label': plan_label or 'Планировка',
        'block_label': block_label or 'Блок-секция',
    }


def render_page(page: fitz.Page) -> Tuple[np.ndarray, bytes]:
    matrix = fitz.Matrix(SCALE, SCALE)
    pix = page.get_pixmap(matrix=matrix, colorspace=fitz.csRGB)
    image = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
    png_bytes = pix.tobytes('png')
    return image, png_bytes


def detect_main_color(image: np.ndarray) -> Tuple[np.ndarray, float]:
    pixels = image.reshape(-1, 3).astype(np.float32)
    sample_size = min(len(pixels), 200_000)
    if sample_size == 0:
        return np.array([252.0, 216.0, 215.0]), float(MIN_TOLERANCE)
    idx = RNG.choice(len(pixels), size=sample_size, replace=False)
    sample = pixels[idx]
    kmeans = KMeans(n_clusters=KMEANS_CLUSTERS, random_state=0, n_init=3)
    labels = kmeans.fit_predict(sample)
    centers = kmeans.cluster_centers_
    counts = np.bincount(labels, minlength=len(centers))

    best_idx = None
    best_score = -1.0
    backup_idx = None
    backup_count = 0
    for i, (center, count) in enumerate(zip(centers, counts)):
        share = count / sample_size
        if share < MIN_CLUSTER_SHARE:
            continue
        if center.mean() > 245:  # skip background white
            continue
        if center.mean() < 40:  # skip dark annotations
            continue
        red_bias = max(center[0] - (center[1] + center[2]) / 2.0, 0.0)
        score = red_bias * count
        if score > best_score:
            best_idx = i
            best_score = score
        if count > backup_count:
            backup_idx = i
            backup_count = count

    if best_idx is None or best_score <= 0:
        if backup_idx is not None:
            # choose cluster with highest channel range as a fallback
            ranges = [center.max() - center.min() for center in centers]
            range_scores = [ranges[i] * counts[i] if counts[i] > 0 else -1 for i in range(len(centers))]
            best_idx = int(np.argmax(range_scores))
        if best_idx is None:
            best_idx = backup_idx if backup_idx is not None else int(np.argmax(counts))

    center = centers[best_idx]
    cluster_points = sample[labels == best_idx]
    if cluster_points.size == 0:
        tolerance = MIN_TOLERANCE
    else:
        distances = np.linalg.norm(cluster_points - center, axis=1)
        tolerance = float(np.clip(np.percentile(distances, 95), MIN_TOLERANCE, MAX_TOLERANCE))

    return center, tolerance


def classify_components(image: np.ndarray) -> Dict[str, object]:
    main_color, tolerance = detect_main_color(image)
    color_distance = np.linalg.norm(image.astype(float) - main_color, axis=2)
    main_mask = color_distance < tolerance
    ys, xs = main_mask.nonzero()
    if ys.size == 0 or xs.size == 0:
        return {
            'main_mask': main_mask,
            'main_ids': [],
            'balcony_ids': [],
            'wet_ids': [],
            'components': [],
            'labeled': np.zeros_like(main_mask, dtype=int),
            'bounds': {'min_x': 0, 'min_y': 0, 'max_x': 0, 'max_y': 0},
            'main_color': main_color.tolist(),
            'main_tolerance': tolerance,
        }

    min_x, min_y = xs.min(), ys.min()
    max_x, max_y = xs.max(), ys.max()

    labeled, num = ndi.label(main_mask)
    areas = ndi.sum(main_mask, labeled, index=range(1, num + 1))
    objects = ndi.find_objects(labeled)

    main_ids: List[int] = []
    balcony_ids: List[int] = []
    wet_ids: List[int] = []
    component_records: List[Dict[str, object]] = []

    for idx, (slice_obj, area) in enumerate(zip(objects, areas), start=1):
        if slice_obj is None or area < 200:
            continue
        y_slice, x_slice = slice_obj
        y0, y1 = y_slice.start, y_slice.stop
        x0, x1 = x_slice.start, x_slice.stop
        touches_edge = (
            x0 <= min_x + 2
            or x1 >= max_x - 2
            or y0 <= min_y + 2
            or y1 >= max_y - 2
        )
        if y1 >= max_y - MAX_BOTTOM_MARGIN:
            continue
        record = {
            'label_id': idx,
            'area_px': int(area),
            'bbox_px': [int(x0), int(y0), int(x1), int(y1)],
            'touches_edge': bool(touches_edge),
        }
        component_records.append(record)

        if area > MAIN_AREA_THRESHOLD:
            main_ids.append(idx)
        elif touches_edge and BALCONY_AREA_RANGE[0] <= area <= BALCONY_AREA_RANGE[1]:
            balcony_ids.append(idx)
        elif (not touches_edge) and WET_AREA_RANGE[0] <= area <= WET_AREA_RANGE[1]:
            wet_ids.append(idx)

    return {
        'main_mask': main_mask,
        'main_ids': main_ids,
        'balcony_ids': balcony_ids,
        'wet_ids': wet_ids,
        'components': component_records,
        'labeled': labeled,
        'bounds': {
            'min_x': int(min_x),
            'min_y': int(min_y),
            'max_x': int(max_x),
            'max_y': int(max_y),
        },
        'main_color': main_color.tolist(),
        'main_tolerance': float(tolerance),
    }


def mask_from_ids(labeled: np.ndarray, ids: List[int]) -> np.ndarray:
    if not ids:
        return np.zeros_like(labeled, dtype=bool)
    return np.isin(labeled, ids)


def contour_paths(mask: np.ndarray) -> List[str]:
    if not mask.any():
        return []
    contours = measure.find_contours(mask.astype(float), 0.5)
    paths: List[str] = []
    for contour in contours:
        if contour.shape[0] < 3:
            continue
        approx = measure.approximate_polygon(contour, tolerance=SIMPLIFY_TOLERANCE)
        if approx.shape[0] < 3:
            continue
        coords = [(float(point[1]), float(point[0])) for point in approx]
        if coords[0] != coords[-1]:
            coords.append(coords[0])
        path_d = 'M ' + ' L '.join(f'{x:.2f},{y:.2f}' for x, y in coords) + ' Z'
        paths.append(path_d)
    return paths


def compute_water_points(labeled: np.ndarray, ids: List[int], scale: float, height: int) -> List[Dict[str, float]]:
    points: List[Dict[str, float]] = []
    for label_id in ids:
        coords = ndi.center_of_mass(labeled == label_id)
        if coords is None:
            continue
        y, x = coords
        x_pt = float(x * scale)
        y_pt = float((height - y) * scale)
        points.append(
            {
                'label_id': int(label_id),
                'x_px': float(x),
                'y_px': float(y),
                'x_pt': x_pt,
                'y_pt': y_pt,
                'x_mm': x_pt * 25.4 / 72.0,
                'y_mm': y_pt * 25.4 / 72.0,
            }
        )
    return points


def build_svg(width: int, height: int, png_b64: str, main_paths: List[str], balcony_paths: List[str], water_points: List[Dict[str, float]]) -> str:
    lines: List[str] = []
    lines.append('<?xml version="1.0" encoding="UTF-8"?>')
    lines.append(
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">'
    )
    lines.append('  <defs>')
    lines.append('    <style>')
    lines.append('      .main-area { fill: rgba(240, 100, 120, 0.35); stroke: #ff6f91; stroke-width: 2; }')
    lines.append('      .balcony-area { fill: rgba(66, 135, 245, 0.35); stroke: #1d68d0; stroke-width: 2; }')
    lines.append('      .water-point { fill: #008080; stroke: white; stroke-width: 1.5; }')
    lines.append('    </style>')
    lines.append('  </defs>')
    lines.append(f'  <image width="{width}" height="{height}" href="data:image/png;base64,{png_b64}" />')
    if main_paths:
        lines.append('  <g id="main-areas" class="main-area">')
        for path in main_paths:
            lines.append(f'    <path d="{path}" />')
        lines.append('  </g>')
    if balcony_paths:
        lines.append('  <g id="balcony-areas" class="balcony-area">')
        for path in balcony_paths:
            lines.append(f'    <path d="{path}" />')
        lines.append('  </g>')
    if water_points:
        lines.append('  <g id="water-points">')
        for point in water_points:
            lines.append(
                f'    <circle class="water-point" cx="{point["x_px"]:.2f}" cy="{point["y_px"]:.2f}" r="6" />'
            )
        lines.append('  </g>')
    lines.append('</svg>')
    return '\n'.join(lines)


def process_plan(page: fitz.Page, page_index: int) -> Dict[str, object]:
    labels = extract_labels(page)
    image, png_bytes = render_page(page)
    classify_result = classify_components(image)
    labeled = classify_result['labeled']
    main_mask = mask_from_ids(labeled, classify_result['main_ids'])
    balcony_mask = mask_from_ids(labeled, classify_result['balcony_ids'])
    main_paths = contour_paths(main_mask)
    balcony_paths = contour_paths(balcony_mask)

    width, height = image.shape[1], image.shape[0]
    scale = page.rect.width / width
    water_points = compute_water_points(
        labeled,
        classify_result['wet_ids'],
        scale=scale,
        height=height,
    )

    svg_data = build_svg(
        width=width,
        height=height,
        png_b64=base64.b64encode(png_bytes).decode('ascii'),
        main_paths=main_paths,
        balcony_paths=balcony_paths,
        water_points=water_points,
    )

    plan_slug = slugify(labels['block_label']) + '__' + slugify(labels['plan_label'])
    svg_path = OUTPUT_DIR / f'{plan_slug}.svg'
    svg_path.write_text(svg_data, encoding='utf-8')

    metadata = {
        'page_index': page_index,
        'block_label': labels['block_label'],
        'plan_label': labels['plan_label'],
        'output_svg': svg_path.name,
        'image_size_px': {'width': width, 'height': height},
        'pdf_size_pt': {'width': float(page.rect.width), 'height': float(page.rect.height)},
        'px_per_pdf_point': width / float(page.rect.width),
        'ceiling_height_m': CEILING_HEIGHT_M,
        'main_component_ids': classify_result['main_ids'],
        'balcony_component_ids': classify_result['balcony_ids'],
        'water_component_ids': classify_result['wet_ids'],
        'component_stats': classify_result['components'],
        'bounds_px': classify_result['bounds'],
        'main_color_rgb': classify_result['main_color'],
        'main_color_tolerance': classify_result['main_tolerance'],
        'water_points': water_points,
    }
    return metadata


def main() -> None:
    ensure_output_dir()
    if not PDF_PATH.exists():
        raise FileNotFoundError(f'PDF not found: {PDF_PATH}')

    doc = fitz.open(str(PDF_PATH))
    all_metadata: List[Dict[str, object]] = []

    for page_index in range(doc.page_count):
        page = doc[page_index]
        labels = extract_labels(page)
        if not labels['plan_label'] or 'Планировка' not in labels['plan_label']:
            continue
        if labels['plan_label'] == 'Планировка' and labels['block_label'] == 'Блок-секция':
            continue
        metadata = process_plan(page, page_index)
        all_metadata.append(metadata)

    summary = {
        'source_pdf': PDF_PATH.name,
        'render_scale': SCALE,
        'ceiling_height_m': CEILING_HEIGHT_M,
        'plans': all_metadata,
    }
    (OUTPUT_DIR / 'plan_data.json').write_text(
        json.dumps(summary, ensure_ascii=False, indent=2),
        encoding='utf-8',
    )


if __name__ == '__main__':
    main()
