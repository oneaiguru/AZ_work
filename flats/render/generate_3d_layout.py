#!/usr/bin/env python3
"""Render a cartoon-styled 3D visualization of the apartment layout."""

from __future__ import annotations

import argparse
import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Sequence, Tuple

import matplotlib

matplotlib.use("Agg")
from matplotlib import pyplot as plt
from mpl_toolkits.mplot3d import Axes3D  # noqa: F401 - side effect registration
from mpl_toolkits.mplot3d.art3d import Poly3DCollection
import numpy as np


Vec3 = Tuple[float, float, float]
Vec2 = Tuple[float, float]


@dataclass
class RenderContext:
    light_direction: np.ndarray
    outline_width: float = 1.2
    toon_levels: int = 4
    min_intensity: float = 0.35
    max_intensity: float = 1.05


@dataclass
class FurnitureInfo:
    label: str
    center: np.ndarray
    size: np.ndarray
    rotation: float
    elevation: float


def hex_to_rgb(color: str) -> Tuple[float, float, float]:
    color = color.lstrip("#")
    if len(color) == 3:
        color = "".join(ch * 2 for ch in color)
    r = int(color[0:2], 16) / 255.0
    g = int(color[2:4], 16) / 255.0
    b = int(color[4:6], 16) / 255.0
    return r, g, b


def rotate_xy(x: float, y: float, angle_deg: float) -> Tuple[float, float]:
    theta = math.radians(angle_deg)
    cos_t, sin_t = math.cos(theta), math.sin(theta)
    xr = x * cos_t - y * sin_t
    yr = x * sin_t + y * cos_t
    return xr, yr


def apply_offset(base: np.ndarray, offset: Sequence[float], rotation: float) -> np.ndarray:
    ox, oy = rotate_xy(offset[0], offset[1], rotation)
    return np.array([base[0] + ox, base[1] + oy, base[2] + offset[2]])


def normalize(vector: np.ndarray) -> np.ndarray:
    arr = np.array(vector, dtype=float)
    if arr.ndim == 1:
        length = np.linalg.norm(arr)
        if length == 0:
            return arr
        return arr / length
    lengths = np.linalg.norm(arr, axis=-1, keepdims=True)
    lengths[lengths == 0] = 1.0
    return arr / lengths


def toon_shade(base_color: Tuple[float, float, float], normal: np.ndarray, ctx: RenderContext) -> Tuple[float, float, float]:
    normal = normalize(normal)
    if normal.shape != (3,):
        raise ValueError("Normal must be a 3D vector")
    dot = float(np.dot(normal, ctx.light_direction))
    if dot < 0:
        dot = -dot  # always keep faces lit from the cartoon sun
    dot = max(0.0, min(1.0, dot))
    if ctx.toon_levels > 1:
        dot = round(dot * (ctx.toon_levels - 1)) / (ctx.toon_levels - 1)
    intensity = ctx.min_intensity + (ctx.max_intensity - ctx.min_intensity) * dot
    shaded = tuple(np.clip(np.array(base_color) * intensity, 0.0, 1.0))
    return shaded


def add_poly(ax, vertices: Sequence[Sequence[float]], color: Tuple[float, float, float], outline: str, ctx: RenderContext) -> None:
    poly = Poly3DCollection([vertices])
    poly.set_facecolor(color)
    poly.set_edgecolor(outline)
    poly.set_linewidth(ctx.outline_width)
    poly.set_alpha(1.0)
    ax.add_collection3d(poly)


def create_box_faces(center: np.ndarray, size: np.ndarray, rotation: float) -> Tuple[np.ndarray, List[List[int]]]:
    lx, ly, lz = size
    hx, hy, hz = lx / 2.0, ly / 2.0, lz / 2.0
    corners = np.array(
        [
            [-hx, -hy, -hz],
            [hx, -hy, -hz],
            [hx, hy, -hz],
            [-hx, hy, -hz],
            [-hx, -hy, hz],
            [hx, -hy, hz],
            [hx, hy, hz],
            [-hx, hy, hz],
        ]
    )
    if rotation:
        cos_t, sin_t = math.cos(math.radians(rotation)), math.sin(math.radians(rotation))
        rot = np.array([[cos_t, -sin_t, 0.0], [sin_t, cos_t, 0.0], [0.0, 0.0, 1.0]])
        corners = corners @ rot.T
    corners += center
    faces = [
        [0, 1, 2, 3],  # bottom
        [4, 5, 6, 7],  # top
        [0, 1, 5, 4],  # front
        [1, 2, 6, 5],  # right
        [2, 3, 7, 6],  # back
        [3, 0, 4, 7],  # left
    ]
    return corners, faces


def draw_box(ax, center: np.ndarray, size: np.ndarray, rotation: float, color: str, outline: str, ctx: RenderContext) -> None:
    base_color = hex_to_rgb(color)
    corners, faces = create_box_faces(center, size, rotation)
    for idx in faces:
        face = corners[idx]
        v1 = face[1] - face[0]
        v2 = face[2] - face[1]
        normal = np.cross(v1, v2)
        shade = toon_shade(base_color, normal, ctx)
        add_poly(ax, face, shade, outline, ctx)


def draw_floor(ax, room: dict, ctx: RenderContext) -> None:
    origin = np.array(room["origin"], dtype=float)
    width, depth = room["size"]
    floor_color = hex_to_rgb(room["floor"]["color"])
    x0, y0 = origin
    x1, y1 = x0 + width, y0 + depth
    base_vertices = [
        (x0, y0, 0.0),
        (x1, y0, 0.0),
        (x1, y1, 0.0),
        (x0, y1, 0.0),
    ]
    normal = np.array([0.0, 0.0, 1.0])
    shade = toon_shade(floor_color, normal, ctx)
    add_poly(ax, base_vertices, shade, room.get("baseboard_color", "#3b2b27"), ctx)

    # Stylised pattern overlays
    pattern = room["floor"].get("pattern")
    if pattern == "broad_planks":
        stripes = max(4, int(depth / 0.4))
        for i in range(1, stripes):
            y = y0 + (depth / stripes) * i
            ax.plot([x0, x1], [y, y], zs=0.01, color="#d8b890", linewidth=1.0, zdir="z")
    elif pattern == "checker":
        tiles_x = max(4, int(width / 0.45))
        tiles_y = max(4, int(depth / 0.45))
        for ix in range(tiles_x):
            for iy in range(tiles_y):
                if (ix + iy) % 2 == 0:
                    px0 = x0 + ix * (width / tiles_x)
                    py0 = y0 + iy * (depth / tiles_y)
                    px1 = px0 + (width / tiles_x)
                    py1 = py0 + (depth / tiles_y)
                    patch_color = tuple(np.clip(np.array(floor_color) * 0.92, 0, 1))
                    add_poly(ax, [(px0, py0, 0.001), (px1, py0, 0.001), (px1, py1, 0.001), (px0, py1, 0.001)], patch_color, "#c3c3c3", ctx)
    elif pattern == "plush":
        for i in range(6):
            angle = math.radians(i * 30)
            cx, cy = (x0 + width / 2), (y0 + depth / 2)
            radius = min(width, depth) / 2.2
            pts = [
                (cx + radius * math.cos(angle + j * math.pi / 3), cy + radius * math.sin(angle + j * math.pi / 3), 0.015)
                for j in range(6)
            ]
            add_poly(ax, pts, tuple(np.clip(np.array(floor_color) * 1.05, 0, 1)), "#bba7a0", ctx)
    elif pattern == "bubble":
        bubbles = int(width * depth * 1.2)
        rng = np.random.default_rng(42)
        for _ in range(bubbles):
            bx = rng.uniform(x0 + 0.1, x1 - 0.1)
            by = rng.uniform(y0 + 0.1, y1 - 0.1)
            radius = rng.uniform(0.05, 0.12)
            circle = []
            for a in np.linspace(0, 2 * math.pi, 12):
                circle.append((bx + radius * math.cos(a), by + radius * math.sin(a), 0.02))
            bubble_color = tuple(np.clip(np.array(floor_color) * 1.08, 0, 1))
            add_poly(ax, circle, bubble_color, "#a9cbe4", ctx)


def draw_walls(ax, room: dict, ctx: RenderContext) -> None:
    origin = np.array(room["origin"], dtype=float)
    width, depth = room["size"]
    height = room["height"]
    wall_color = hex_to_rgb(room["wall_color"])
    x0, y0 = origin
    x1, y1 = x0 + width, y0 + depth
    faces = [
        [(x0, y0, 0.0), (x1, y0, 0.0), (x1, y0, height), (x0, y0, height)],  # south wall
        [(x1, y0, 0.0), (x1, y1, 0.0), (x1, y1, height), (x1, y0, height)],  # east wall
        [(x1, y1, 0.0), (x0, y1, 0.0), (x0, y1, height), (x1, y1, height)],  # north wall
        [(x0, y1, 0.0), (x0, y0, 0.0), (x0, y0, height), (x0, y1, height)],  # west wall
    ]
    outline = room.get("baseboard_color", "#3b2b27")
    for face in faces:
        v1 = np.array(face[1]) - np.array(face[0])
        v2 = np.array(face[2]) - np.array(face[1])
        normal = np.cross(v1, v2)
        shade = toon_shade(wall_color, normal, ctx)
        add_poly(ax, face, shade, outline, ctx)

    # Baseboard accent
    base_color = room.get("baseboard_color")
    if base_color:
        base_rgb = hex_to_rgb(base_color)
        trim_height = 0.12
        trim_faces = [
            [(x0, y0, 0.0), (x1, y0, 0.0), (x1, y0, trim_height), (x0, y0, trim_height)],
            [(x1, y0, 0.0), (x1, y1, 0.0), (x1, y1, trim_height), (x1, y0, trim_height)],
            [(x1, y1, 0.0), (x0, y1, 0.0), (x0, y1, trim_height), (x1, y1, trim_height)],
            [(x0, y1, 0.0), (x0, y0, 0.0), (x0, y0, trim_height), (x0, y1, trim_height)],
        ]
        for face in trim_faces:
            normal = np.cross(np.array(face[1]) - np.array(face[0]), np.array(face[2]) - np.array(face[1]))
            shade = toon_shade(base_rgb, normal, ctx)
            add_poly(ax, face, shade, "#4c4138", ctx)


def draw_ceiling(ax, room: dict, ctx: RenderContext) -> None:
    origin = np.array(room["origin"], dtype=float)
    width, depth = room["size"]
    height = room["height"]
    x0, y0 = origin
    x1, y1 = x0 + width, y0 + depth
    color = hex_to_rgb(room.get("ceiling_color", "#ffffff"))
    vertices = [(x0, y0, height), (x1, y0, height), (x1, y1, height), (x0, y1, height)]
    shade = toon_shade(color, np.array([0.0, 0.0, -1.0]), ctx)
    add_poly(ax, vertices, shade, "#c4c1bc", ctx)


def draw_rug(ax, center: np.ndarray, size: Sequence[float], rotation: float, color: str, outline: str, ctx: RenderContext) -> None:
    length, width, thickness = size
    rug_center = np.array(center)
    rug_center[2] += thickness / 2.0
    draw_box(ax, rug_center, np.array([length, width, thickness]), rotation, color, outline, ctx)


def draw_throw(ax, center: np.ndarray, size: Sequence[float], rotation: float, color: str, outline: str, ctx: RenderContext) -> None:
    length, ripple, depth = size
    u = np.linspace(-length / 2.0, length / 2.0, 20)
    v = np.linspace(-depth / 2.0, depth / 2.0, 16)
    uu, vv = np.meshgrid(u, v)
    amplitude = ripple if ripple > 0 else 0.015
    wave = amplitude * np.sin(uu * 3.2 / max(length, 0.5)) * np.cos(vv * 2.6 / max(depth, 0.5))
    zz = center[2] + wave
    xx = uu
    yy = vv
    if rotation:
        flat = np.stack([uu.ravel(), vv.ravel()], axis=1)
        rotated = np.array([rotate_xy(p[0], p[1], rotation) for p in flat])
        xx = rotated[:, 0].reshape(uu.shape)
        yy = rotated[:, 1].reshape(uu.shape)
    xx = xx + center[0]
    yy = yy + center[1]
    base_rgb = np.array(hex_to_rgb(color))
    normals = np.dstack(np.gradient(zz))
    normals = np.dstack((-normals[:, :, 0], -normals[:, :, 1], np.ones_like(zz)))
    normals = normalize(normals)
    dots = np.clip(np.abs(normals @ ctx.light_direction), 0, 1)
    dots = np.round(dots * (ctx.toon_levels - 1)) / max(1, (ctx.toon_levels - 1))
    intensities = ctx.min_intensity + (ctx.max_intensity - ctx.min_intensity) * dots
    colors = np.clip(base_rgb * intensities[..., None], 0, 1)
    ax.plot_surface(xx, yy, zz, rstride=1, cstride=1, linewidth=0.0, antialiased=False, shade=False, facecolors=colors, edgecolor=outline, alpha=0.95)


def draw_ellipsoid(
    ax,
    center: np.ndarray,
    radius: Sequence[float],
    rotation: float,
    color: str,
    outline: str,
    ctx: RenderContext,
) -> None:
    rx, ry, rz = radius
    u = np.linspace(0, 2 * math.pi, 28)
    v = np.linspace(0, math.pi, 18)
    uu, vv = np.meshgrid(u, v)
    x = rx * np.cos(uu) * np.sin(vv)
    y = ry * np.sin(uu) * np.sin(vv)
    z = rz * np.cos(vv)
    if rotation:
        flat = np.stack([x.ravel(), y.ravel()], axis=1)
        rotated = np.array([rotate_xy(px, py, rotation) for px, py in flat])
        x = rotated[:, 0].reshape(x.shape)
        y = rotated[:, 1].reshape(y.shape)
    x = x + center[0]
    y = y + center[1]
    z = z + center[2]
    normals = np.stack((x - center[0], y - center[1], (z - center[2]) * (rx / rz) if rz else z * 0 + 1), axis=-1)
    normals = normals.reshape(-1, 3)
    normals = np.apply_along_axis(normalize, 1, normals)
    dots = np.dot(normals, ctx.light_direction)
    dots = np.abs(dots)
    if ctx.toon_levels > 1:
        dots = np.round(dots * (ctx.toon_levels - 1)) / (ctx.toon_levels - 1)
    intensities = ctx.min_intensity + (ctx.max_intensity - ctx.min_intensity) * dots
    base_rgb = np.array(hex_to_rgb(color))
    colors = np.clip(base_rgb * intensities[:, None], 0, 1)
    colors = colors.reshape(x.shape + (3,))
    ax.plot_surface(x, y, z, rstride=1, cstride=1, linewidth=0.0, antialiased=False, shade=False, facecolors=colors, edgecolor=outline, alpha=0.98)


def draw_panel(ax, center: np.ndarray, size: Sequence[float], rotation: float, color: str, outline: str, ctx: RenderContext) -> None:
    draw_box(ax, center, np.array(size), rotation, color, outline, ctx)


def draw_soft_item(
    ax,
    furniture: FurnitureInfo,
    item: dict,
    ctx: RenderContext,
) -> None:
    offset = item.get("offset", [0.0, 0.0, 0.0])
    item_center = apply_offset(furniture.center, offset, furniture.rotation)
    kind = item.get("kind", "pillow")
    color = item.get("color", "#ffffff")
    outline = item.get("outline", "#2e2e2e")
    if kind in {"pillow", "pillow_cluster", "seat_cushion", "bolster", "foam"}:
        radius = item.get("radius", [0.4, 0.3, 0.18])
        draw_ellipsoid(ax, item_center, radius, furniture.rotation + item.get("rotation", 0.0), color, outline, ctx)
    elif kind == "throw":
        size = item.get("size", [1.0, 0.02, 0.6])
        draw_throw(ax, item_center, size, furniture.rotation + item.get("rotation", 0.0), color, outline, ctx)
    elif kind in {"basket"}:
        radius = item.get("radius", [0.4, 0.3, 0.25])
        draw_ellipsoid(ax, item_center, radius, furniture.rotation + item.get("rotation", 0.0), color, outline, ctx)
    else:
        size = item.get("size", [0.6, 0.4, 0.25])
        draw_panel(ax, item_center, size, furniture.rotation + item.get("rotation", 0.0), color, outline, ctx)


def draw_soft_decor(
    ax,
    room_origin: np.ndarray,
    decor: dict,
    furniture_lookup: Dict[str, FurnitureInfo],
    ctx: RenderContext,
) -> None:
    kind = decor.get("kind", "rug")
    outline = decor.get("outline", "#3c2b2a")
    color = decor.get("color", "#ffffff")
    rotation = decor.get("rotation", 0.0)
    if "anchor" in decor:
        anchor = furniture_lookup.get(decor["anchor"])
        if not anchor:
            return
        offset = decor.get("offset", [0.0, 0.0, 0.0])
        center = apply_offset(anchor.center, offset, anchor.rotation)
        effective_rotation = anchor.rotation + rotation
    else:
        pos = decor.get("position", [0.0, 0.0])
        if len(pos) == 2:
            center = np.array([room_origin[0] + pos[0], room_origin[1] + pos[1], decor.get("elevation", 0.02)])
        else:
            center = np.array([room_origin[0] + pos[0], room_origin[1] + pos[1], pos[2]])
        effective_rotation = rotation

    if kind == "rug":
        size = decor.get("size", [2.0, 1.6, 0.04])
        draw_rug(ax, center, size, effective_rotation, color, outline, ctx)
    elif kind in {"wall_art", "panel"}:
        size = decor.get("size", [1.2, 0.05, 1.0])
        draw_panel(ax, center, size, effective_rotation, color, outline, ctx)
    elif kind in {"throw"}:
        size = decor.get("size", [1.4, 0.03, 0.9])
        draw_throw(ax, center, size, effective_rotation, color, outline, ctx)
    elif kind in {"drape", "towel"}:
        depth, width, height = decor.get("size", [0.05, 1.5, 2.0])
        u = np.linspace(-width / 2, width / 2, 18)
        v = np.linspace(0.0, height, 20)
        uu, vv = np.meshgrid(u, v)
        ripple = 0.05 * np.sin(uu * 4 / max(width, 0.5))
        xx = np.full_like(uu, depth / 2.0)
        yy = uu
        zz = center[2] + vv - height / 2.0
        if effective_rotation:
            flat = np.stack([xx.ravel(), yy.ravel()], axis=1)
            rotated = np.array([rotate_xy(px, py, effective_rotation) for px, py in flat])
            xx = rotated[:, 0].reshape(xx.shape)
            yy = rotated[:, 1].reshape(yy.shape)
        xx = xx + center[0]
        yy = yy + center[1]
        base_rgb = np.array(hex_to_rgb(color))
        normals = np.dstack(np.gradient(ripple + vv))
        normals = np.dstack((-normals[:, :, 0], -normals[:, :, 1], np.ones_like(zz)))
        normals = normalize(normals)
        dots = np.clip(np.abs(normals @ ctx.light_direction), 0, 1)
        if ctx.toon_levels > 1:
            dots = np.round(dots * (ctx.toon_levels - 1)) / (ctx.toon_levels - 1)
        intensities = ctx.min_intensity + (ctx.max_intensity - ctx.min_intensity) * dots
        colors = np.clip(base_rgb * intensities[..., None], 0, 1)
        ax.plot_surface(xx, yy, zz + ripple, rstride=1, cstride=1, linewidth=0.0, antialiased=False, shade=False, facecolors=colors, edgecolor=outline, alpha=0.9)
    else:
        size = decor.get("size", [1.0, 0.3, 0.8])
        draw_panel(ax, center, size, effective_rotation, color, outline, ctx)


def draw_light(ax, position: Sequence[float], radius: float, color: str, ctx: RenderContext) -> None:
    center = np.array(position)
    r = radius
    u = np.linspace(0, 2 * math.pi, 18)
    v = np.linspace(0, math.pi, 12)
    uu, vv = np.meshgrid(u, v)
    x = r * np.cos(uu) * np.sin(vv) + center[0]
    y = r * np.sin(uu) * np.sin(vv) + center[1]
    z = r * np.cos(vv) + center[2]
    base_rgb = np.array(hex_to_rgb(color))
    glow = np.clip(base_rgb * 1.2, 0, 1)
    ax.plot_surface(x, y, z, rstride=1, cstride=1, color=glow, linewidth=0.0, alpha=0.55, shade=False)
    ax.scatter([center[0]], [center[1]], [center[2]], color=glow, s=40, alpha=0.9)


def draw_room(ax, room: dict, ctx: RenderContext) -> None:
    draw_floor(ax, room, ctx)
    draw_walls(ax, room, ctx)
    # leave ceiling airy for readability but add a faint outline
    draw_ceiling(ax, room, ctx)

    furniture_lookup: Dict[str, FurnitureInfo] = {}
    origin = np.array(room["origin"], dtype=float)

    for item in room.get("furniture", []):
        label = item.get("label", "Furniture")
        size = np.array(item.get("size", [1.0, 1.0, 1.0]), dtype=float)
        pos = item.get("position", [0.0, 0.0])
        elevation = float(item.get("elevation", 0.0))
        rotation = float(item.get("rotation", 0.0))
        center = np.array([origin[0] + pos[0], origin[1] + pos[1], elevation + size[2] / 2.0])
        outline = item.get("outline", "#3b2b27")
        draw_box(ax, center, size, rotation, item.get("color", "#ffffff"), outline, ctx)
        info = FurnitureInfo(label=label, center=center, size=size, rotation=rotation, elevation=elevation)
        furniture_lookup[label] = info
        for soft in item.get("soft_items", []):
            draw_soft_item(ax, info, soft, ctx)

    for decor in room.get("soft_decor", []):
        draw_soft_decor(ax, origin, decor, furniture_lookup, ctx)

    for light in room.get("lighting", []):
        position = light.get("position", [origin[0], origin[1], room["height"] - 0.4])
        radius = light.get("radius", 0.18)
        color = light.get("color", "#fff5d0")
        draw_light(ax, position, radius, color, ctx)

    label_position = origin + np.array([room["size"][0] / 2.0, room["size"][1] / 2.0])
    ax.text(label_position[0], label_position[1], room["height"] + 0.2, f"{room['name']}\n{room.get('mood', '')}",
            ha="center", va="bottom", fontsize=9, color="#3a2d2a", weight="bold")


def configure_axes(ax, bounds: Tuple[float, float, float, float, float]) -> None:
    min_x, max_x, min_y, max_y, max_z = bounds
    ax.set_xlim(min_x, max_x)
    ax.set_ylim(min_y, max_y)
    ax.set_zlim(0.0, max_z)
    ax.set_box_aspect((max_x - min_x, max_y - min_y, max_z))
    ax.set_axis_off()
    ax.grid(False)
    ax.set_proj_type("persp")


def compute_bounds(rooms: Iterable[dict]) -> Tuple[float, float, float, float, float]:
    min_x, min_y = float("inf"), float("inf")
    max_x, max_y, max_z = float("-inf"), float("-inf"), float("-inf")
    for room in rooms:
        origin = np.array(room["origin"], dtype=float)
        size = np.array(room["size"], dtype=float)
        min_x = min(min_x, origin[0])
        min_y = min(min_y, origin[1])
        max_x = max(max_x, origin[0] + size[0])
        max_y = max(max_y, origin[1] + size[1])
        max_z = max(max_z, float(room.get("height", 3.0)))
    margin = 0.8
    return min_x - margin, max_x + margin, min_y - margin, max_y + margin, max_z + 1.2


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Cartoon 3D renderer for the apartment layout")
    parser.add_argument("--layout", default=Path(__file__).with_name("apartment_layout.json"), type=Path,
                        help="Path to the layout JSON file")
    parser.add_argument("--output", default=Path(__file__).with_name("render_output.png"), type=Path,
                        help="Where to save the rendered image")
    parser.add_argument("--dpi", type=int, default=None, help="Override render DPI")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    with args.layout.open("r", encoding="utf-8") as fh:
        layout = json.load(fh)

    render_cfg = layout.get("render", {})
    background = render_cfg.get("background", "#fef8ef")
    light_direction = np.array(render_cfg.get("light_direction", [0.4, 0.5, 0.8]), dtype=float)
    if np.linalg.norm(light_direction) == 0:
        light_direction = np.array([0.3, 0.4, 0.85])
    light_direction = normalize(light_direction)
    ctx = RenderContext(light_direction=light_direction)

    dpi = args.dpi or render_cfg.get("dpi", 260)
    fig = plt.figure(figsize=(11, 7), dpi=dpi)
    fig.patch.set_facecolor(background)
    ax = fig.add_subplot(111, projection="3d")
    ax.set_facecolor(background)

    bounds = compute_bounds(layout.get("rooms", []))
    configure_axes(ax, bounds)

    camera = render_cfg.get("camera", {})
    ax.view_init(elev=camera.get("elev", 25), azim=camera.get("azim", -60))
    if "distance" in camera:
        ax.dist = camera["distance"]

    for room in layout.get("rooms", []):
        draw_room(ax, room, ctx)

    meta = layout.get("meta", {})
    title = meta.get("title", "Apartment Render")
    concept = meta.get("concept", "")
    fig.suptitle(f"{title}\n{concept}", fontsize=16, fontweight="bold", color="#3a2d2a")

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    plt.tight_layout()
    plt.savefig(output_path, dpi=dpi, facecolor=background, bbox_inches="tight")
    print(f"Saved render to {output_path}")


if __name__ == "__main__":
    main()
