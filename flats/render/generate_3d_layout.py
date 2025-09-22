#!/usr/bin/env python3
"""Generate a detailed 3D render of the apartment layout."""
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Iterable, List, Mapping, Optional, Sequence, Tuple

DEFAULT_ROOM_HEIGHT = 2.75
WALL_THICKNESS = 0.18
FLOOR_THICKNESS = 0.05
BASEBOARD_HEIGHT = 0.12
FRAME_THICKNESS = 0.06
GROUND_MARGIN = 0.8

CATEGORY_DEFAULT_ALPHA: Dict[str, float] = {
    "floor": 1.0,
    "floor_detail": 1.0,
    "ground": 1.0,
    "baseboard": 1.0,
    "wall": 0.96,
    "window": 0.5,
    "door": 0.85,
    "glass": 0.45,
    "furniture": 0.96,
    "storage": 0.95,
    "surface": 0.95,
    "seating": 0.95,
    "kitchen": 0.95,
    "sanitary": 0.95,
    "decor": 0.92,
    "art": 0.85,
    "mirror": 0.4,
    "soft": 0.9,
    "textile": 0.88,
    "pillow": 0.9,
    "rug": 0.94,
    "plant": 0.92,
    "lighting": 0.8,
}

CATEGORY_TO_STYLE: Dict[str, str] = {
    "ground": "ground",
    "floor": "floor",
    "floor_detail": "floor_detail",
    "baseboard": "baseboard",
    "wall": "wall",
    "window": "window",
    "door": "door",
    "glass": "glass",
    "furniture": "furniture",
    "storage": "furniture",
    "surface": "furniture",
    "seating": "furniture",
    "kitchen": "furniture",
    "sanitary": "furniture",
    "decor": "decor",
    "art": "decor",
    "mirror": "glass",
    "soft": "soft",
    "textile": "soft",
    "pillow": "soft",
    "rug": "rug",
    "plant": "plant",
    "lighting": "lighting",
}

STYLE_LIBRARY: Dict[str, Dict[str, str]] = {
    "ground": {"edge": "#cabaa9", "legend_color": "#e2d4c3", "label": "Ground plane"},
    "floor": {"edge": "#b28d66", "legend_color": "#d8c2a6", "label": "Floors"},
    "floor_detail": {"edge": "#a57c55", "legend_color": "#c9b08f", "label": "Floor texture"},
    "baseboard": {"edge": "#8a7a67", "legend_color": "#e4d7c3", "label": "Baseboards"},
    "wall": {"edge": "#857565", "legend_color": "#f2e6d5", "label": "Walls"},
    "window": {"edge": "#7aa6b5", "legend_color": "#d5e8f0", "label": "Windows"},
    "door": {"edge": "#b6916b", "legend_color": "#ead9c4", "label": "Doors"},
    "glass": {"edge": "#6a9fb4", "legend_color": "#d9e7ee", "label": "Glass panels"},
    "furniture": {"edge": "#5d4e41", "legend_color": "#cfb69a", "label": "Furniture"},
    "soft": {"edge": "#4c6976", "legend_color": "#cfd8de", "label": "Textiles & soft decor"},
    "rug": {"edge": "#806752", "legend_color": "#e2d4c2", "label": "Rugs"},
    "decor": {"edge": "#6a5a4d", "legend_color": "#ddc9b4", "label": "Decor accents"},
    "plant": {"edge": "#4f6b49", "legend_color": "#88a27e", "label": "Plants"},
    "lighting": {"edge": "#947a5c", "legend_color": "#ffe8c6", "label": "Ambient lighting"},
}

STYLE_ORDER = [
    "ground",
    "floor",
    "floor_detail",
    "rug",
    "baseboard",
    "wall",
    "window",
    "door",
    "glass",
    "furniture",
    "soft",
    "decor",
    "plant",
]


class LayoutError(RuntimeError):
    """Raised when the layout configuration is invalid."""


@dataclass
class Dimensions:
    width: float
    depth: float
    height: float


@dataclass
class ItemSpec:
    name: str
    category: str
    size: Dimensions
    position: Tuple[float, float]
    color: str
    alpha: float
    elevation: float = 0.0
    count: int = 1
    spacing: Tuple[float, float, float] = (0.0, 0.0, 0.0)
    anchor: str = "corner"


@dataclass
class OpeningPanel:
    color: str
    alpha: float
    thickness: float
    offset: float


@dataclass
class OpeningSpec:
    name: str
    wall: str
    offset: float
    width: float
    height: float
    sill_height: float
    element: str
    color: str
    alpha: float
    frame_color: Optional[str] = None
    panel: Optional[OpeningPanel] = None


@dataclass
class LightSpec:
    name: str
    position: Tuple[float, float, float]
    radius: float
    color: str
    intensity: float


@dataclass
class RoomSpec:
    name: str
    origin: Tuple[float, float]
    dimensions: Dimensions
    wall_color: str
    floor_color: str
    ceiling_color: str
    floor_texture: Dict[str, object] = field(default_factory=dict)
    omit_walls: Tuple[str, ...] = field(default_factory=tuple)
    furniture: List[ItemSpec] = field(default_factory=list)
    soft_items: List[ItemSpec] = field(default_factory=list)
    decor: List[ItemSpec] = field(default_factory=list)
    rugs: List[ItemSpec] = field(default_factory=list)
    plants: List[ItemSpec] = field(default_factory=list)
    lighting: List[LightSpec] = field(default_factory=list)
    windows: List[OpeningSpec] = field(default_factory=list)
    doors: List[OpeningSpec] = field(default_factory=list)


@dataclass
class AmbientSettings:
    sky_color: str = "#f4f3ef"
    fog_color: str = "#ebe2d7"
    ground_tint: str = "#e0d3c2"


@dataclass
class CameraSettings:
    elev: float = 30.0
    azim: float = -135.0
    distance: float = 9.0


@dataclass
class LayoutSpec:
    layout_name: str
    style: str
    mood: str
    concept_notes: str
    rooms: List[RoomSpec]
    ambient: AmbientSettings
    camera: CameraSettings
    repeat_limits: Dict[str, str] = field(default_factory=dict)
    color_palette: Dict[str, Sequence[str]] = field(default_factory=dict)


@dataclass
class Box:
    name: str
    category: str
    x: float
    y: float
    z: float
    width: float
    depth: float
    height: float
    color: str
    alpha: float


@dataclass
class Scene:
    layout: LayoutSpec
    boxes: List[Box]
    lights: List[LightSpec]


# ---------------------------------------------------------------------------
# Parsing utilities


def load_layout(path: Path) -> Dict[str, object]:
    """Load the layout JSON file."""

    try:
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except FileNotFoundError as exc:  # pragma: no cover - defensive
        raise LayoutError(f"Layout file not found: {path}") from exc
    except json.JSONDecodeError as exc:  # pragma: no cover - defensive
        raise LayoutError(f"Layout file {path} is not valid JSON: {exc}") from exc


def parse_dimensions(data: Mapping[str, object], *, context: str, default_height: float = DEFAULT_ROOM_HEIGHT) -> Dimensions:
    try:
        width = float(data["width"])
        depth = float(data["depth"])
    except KeyError as exc:
        raise LayoutError(f"Missing dimension key {exc} for {context}") from exc
    height = float(data.get("height", default_height))
    return Dimensions(width=width, depth=depth, height=height)


def parse_position(data: Mapping[str, object], *, context: str) -> Tuple[float, float]:
    try:
        x = float(data.get("x", 0.0))
        y = float(data.get("y", 0.0))
    except (TypeError, ValueError) as exc:
        raise LayoutError(f"Invalid position for {context}") from exc
    return x, y


def parse_spacing(data: Mapping[str, object]) -> Tuple[float, float, float]:
    return (
        float(data.get("x", 0.0)),
        float(data.get("y", 0.0)),
        float(data.get("z", 0.0)),
    )


def category_style_color(category: str) -> str:
    style = CATEGORY_TO_STYLE.get(category, category if category in STYLE_LIBRARY else "decor")
    return STYLE_LIBRARY.get(style, STYLE_LIBRARY["decor"]).get("legend_color", "#d6c6b4")


def parse_item_list(raw: Optional[Iterable[Mapping[str, object]]], *, default_category: str) -> List[ItemSpec]:
    if not raw:
        return []

    items: List[ItemSpec] = []
    for entry in raw:
        name = str(entry.get("name", default_category.title()))
        category = str(entry.get("category", default_category))
        size_data = entry.get("size")
        if not isinstance(size_data, Mapping):
            raise LayoutError(f"Item '{name}' must define a size object")
        size = parse_dimensions(size_data, context=f"item '{name}'", default_height=float(size_data.get("height", 0.6)))
        position_data = entry.get("position", {})
        if not isinstance(position_data, Mapping):
            raise LayoutError(f"Item '{name}' position must be an object")
        position = parse_position(position_data, context=f"item '{name}'")
        color = str(entry.get("color", category_style_color(category)))
        alpha = float(entry.get("alpha", CATEGORY_DEFAULT_ALPHA.get(category, 0.95)))
        elevation = float(entry.get("elevation", 0.0))
        count = int(entry.get("count", 1))
        spacing = parse_spacing(entry.get("spacing", {}))
        anchor = str(entry.get("anchor", "corner"))
        if anchor not in {"corner", "center"}:
            raise LayoutError(f"Item '{name}' anchor must be 'corner' or 'center'")
        items.append(
            ItemSpec(
                name=name,
                category=category,
                size=size,
                position=position,
                color=color,
                alpha=alpha,
                elevation=elevation,
                count=count,
                spacing=spacing,
                anchor=anchor,
            )
        )
    return items


def parse_opening_panel(data: Mapping[str, object]) -> OpeningPanel:
    return OpeningPanel(
        color=str(data.get("color", "#ede1cf")),
        alpha=float(data.get("alpha", 0.85)),
        thickness=float(data.get("thickness", FRAME_THICKNESS)),
        offset=float(data.get("offset", 0.02)),
    )


def parse_openings(raw: Optional[Iterable[Mapping[str, object]]], *, element: str) -> List[OpeningSpec]:
    if not raw:
        return []

    openings: List[OpeningSpec] = []
    for entry in raw:
        name = str(entry.get("name", element.title()))
        wall = str(entry.get("wall", "north")).lower()
        if wall not in {"north", "south", "east", "west"}:
            raise LayoutError(f"Opening '{name}' has unsupported wall '{wall}'")
        offset = float(entry.get("offset", 0.0))
        width = float(entry.get("width", 0.9))
        height = float(entry.get("height", 2.2))
        sill = float(entry.get("sill_height", 0.0))
        color = str(entry.get("color", "#e7e7e7"))
        alpha = float(entry.get("alpha", 0.5 if element == "window" else 0.85))
        frame_color = entry.get("frame_color")
        panel_data = entry.get("panel")
        panel = parse_opening_panel(panel_data) if isinstance(panel_data, Mapping) else None
        openings.append(
            OpeningSpec(
                name=name,
                wall=wall,
                offset=offset,
                width=width,
                height=height,
                sill_height=sill,
                element=element,
                color=color,
                alpha=alpha,
                frame_color=str(frame_color) if frame_color else None,
                panel=panel,
            )
        )
    return openings


def parse_lights(raw: Optional[Iterable[Mapping[str, object]]]) -> List[LightSpec]:
    if not raw:
        return []

    lights: List[LightSpec] = []
    for entry in raw:
        name = str(entry.get("name", "Light"))
        position_data = entry.get("position")
        if not isinstance(position_data, Mapping):
            raise LayoutError(f"Light '{name}' position must be an object")
        x = float(position_data.get("x", 0.0))
        y = float(position_data.get("y", 0.0))
        z = float(position_data.get("z", DEFAULT_ROOM_HEIGHT))
        radius = float(entry.get("radius", 0.18))
        color = str(entry.get("color", "#ffe5c4"))
        intensity = float(entry.get("intensity", 0.8))
        lights.append(LightSpec(name=name, position=(x, y, z), radius=radius, color=color, intensity=intensity))
    return lights


def parse_room(raw: Mapping[str, object]) -> RoomSpec:
    name = str(raw.get("name", "Room"))
    origin_data = raw.get("origin", {})
    if not isinstance(origin_data, Mapping):
        raise LayoutError(f"Room '{name}' origin must be an object")
    origin = parse_position(origin_data, context=f"room '{name}' origin")
    dimensions_data = raw.get("dimensions")
    if not isinstance(dimensions_data, Mapping):
        raise LayoutError(f"Room '{name}' must define dimensions")
    dimensions = parse_dimensions(dimensions_data, context=f"room '{name}'")

    wall_color = str(raw.get("wall_color", "#ede4d7"))
    floor_color = str(raw.get("floor_color", "#d8c2a6"))
    ceiling_color = str(raw.get("ceiling_color", "#fdf9f3"))
    floor_texture = dict(raw.get("floor_texture", {}))
    omit_walls = tuple(str(value).lower() for value in raw.get("omit_walls", ()))

    furniture = parse_item_list(raw.get("furniture"), default_category="furniture")
    soft_items = parse_item_list(raw.get("soft_items"), default_category="soft")
    decor = parse_item_list(raw.get("decor"), default_category="decor")
    rugs = parse_item_list(raw.get("rugs"), default_category="rug")
    plants = parse_item_list(raw.get("plants"), default_category="plant")
    lighting = parse_lights(raw.get("lighting"))
    windows = parse_openings(raw.get("windows"), element="window")
    doors = parse_openings(raw.get("doors"), element="door")

    return RoomSpec(
        name=name,
        origin=origin,
        dimensions=dimensions,
        wall_color=wall_color,
        floor_color=floor_color,
        ceiling_color=ceiling_color,
        floor_texture=floor_texture,
        omit_walls=omit_walls,
        furniture=furniture,
        soft_items=soft_items,
        decor=decor,
        rugs=rugs,
        plants=plants,
        lighting=lighting,
        windows=windows,
        doors=doors,
    )


def parse_layout(data: Mapping[str, object]) -> LayoutSpec:
    rooms_raw = data.get("rooms")
    if not isinstance(rooms_raw, Iterable):
        raise LayoutError("Layout must contain a 'rooms' array")
    rooms = [parse_room(room) for room in rooms_raw]  # type: ignore[arg-type]
    if not rooms:
        raise LayoutError("Layout must define at least one room")

    ambient_raw = data.get("ambient", {})
    if not isinstance(ambient_raw, Mapping):
        raise LayoutError("Ambient section must be an object")
    ambient = AmbientSettings(
        sky_color=str(ambient_raw.get("sky_color", AmbientSettings.sky_color)),
        fog_color=str(ambient_raw.get("fog_color", AmbientSettings.fog_color)),
        ground_tint=str(ambient_raw.get("ground_tint", AmbientSettings.ground_tint)),
    )

    camera_raw = data.get("camera", {})
    if not isinstance(camera_raw, Mapping):
        raise LayoutError("Camera section must be an object")
    camera = CameraSettings(
        elev=float(camera_raw.get("elev", CameraSettings.elev)),
        azim=float(camera_raw.get("azim", CameraSettings.azim)),
        distance=float(camera_raw.get("distance", CameraSettings.distance)),
    )

    repeat_limits = dict(data.get("repeat_limits", {}))
    color_palette = dict(data.get("color_palette", {}))

    return LayoutSpec(
        layout_name=str(data.get("layout_name", "Apartment")),
        style=str(data.get("style", "")),
        mood=str(data.get("mood", "")),
        concept_notes=str(data.get("concept_notes", "")),
        rooms=rooms,
        ambient=ambient,
        camera=camera,
        repeat_limits=repeat_limits,
        color_palette=color_palette,
    )


# ---------------------------------------------------------------------------
# Geometry helpers

def blend_hex(color: str, target: str, amount: float) -> str:
    amount = max(0.0, min(1.0, amount))
    r1, g1, b1 = hex_to_rgb(color)
    r2, g2, b2 = hex_to_rgb(target)
    r = r1 * (1 - amount) + r2 * amount
    g = g1 * (1 - amount) + g2 * amount
    b = b1 * (1 - amount) + b2 * amount
    return rgb_to_hex((r, g, b))


def hex_to_rgb(value: str) -> Tuple[float, float, float]:
    value = value.lstrip("#")
    if len(value) != 6:
        raise LayoutError(f"Color '{value}' must be 6 hexadecimal digits")
    r = int(value[0:2], 16) / 255.0
    g = int(value[2:4], 16) / 255.0
    b = int(value[4:6], 16) / 255.0
    return r, g, b


def rgb_to_hex(rgb: Tuple[float, float, float]) -> str:
    r, g, b = rgb
    return "#%02x%02x%02x" % (
        max(0, min(255, int(round(r * 255)))),
        max(0, min(255, int(round(g * 255)))),
        max(0, min(255, int(round(b * 255)))),
    )


def create_scene(layout: LayoutSpec) -> Scene:
    boxes: List[Box] = []
    lights: List[LightSpec] = []

    min_x = float("inf")
    min_y = float("inf")
    max_x = float("-inf")
    max_y = float("-inf")
    max_z = float("-inf")

    for room in layout.rooms:
        room_boxes, room_max = create_room_geometry(room)
        boxes.extend(room_boxes)
        lights.extend(room.lighting)

        min_x = min(min_x, room.origin[0] - WALL_THICKNESS)
        min_y = min(min_y, room.origin[1] - WALL_THICKNESS)
        max_x = max(max_x, room.origin[0] + room.dimensions.width + WALL_THICKNESS)
        max_y = max(max_y, room.origin[1] + room.dimensions.depth + WALL_THICKNESS)
        max_z = max(max_z, room_max)

    ground_box = Box(
        name="Ground plane",
        category="ground",
        x=min_x - GROUND_MARGIN,
        y=min_y - GROUND_MARGIN,
        z=-FLOOR_THICKNESS * 2,
        width=(max_x - min_x) + GROUND_MARGIN * 2,
        depth=(max_y - min_y) + GROUND_MARGIN * 2,
        height=FLOOR_THICKNESS * 0.5,
        color=layout.ambient.ground_tint,
        alpha=1.0,
    )
    boxes.insert(0, ground_box)

    return Scene(layout=layout, boxes=boxes, lights=lights)


def create_room_geometry(room: RoomSpec) -> Tuple[List[Box], float]:
    boxes: List[Box] = []
    max_height = room.dimensions.height

    boxes.extend(create_floor(room))
    boxes.extend(create_floor_texture(room))
    boxes.extend(create_rugs(room))
    boxes.extend(create_baseboards(room))
    boxes.extend(create_walls(room))
    boxes.extend(create_openings(room))

    boxes.extend(instantiate_items(room, room.furniture))
    boxes.extend(instantiate_items(room, room.decor))
    boxes.extend(instantiate_items(room, room.soft_items))
    boxes.extend(instantiate_items(room, room.plants))

    return boxes, max_height


def create_floor(room: RoomSpec) -> List[Box]:
    floor_box = Box(
        name=f"{room.name} floor",
        category="floor",
        x=room.origin[0],
        y=room.origin[1],
        z=-FLOOR_THICKNESS,
        width=room.dimensions.width,
        depth=room.dimensions.depth,
        height=FLOOR_THICKNESS,
        color=room.floor_color,
        alpha=1.0,
    )
    return [floor_box]


def create_floor_texture(room: RoomSpec) -> List[Box]:
    texture_type = str(room.floor_texture.get("type", "")).lower()
    if texture_type not in {"planks", "tiles"}:
        return []

    palette = list(room.floor_texture.get("palette", ()))
    if not palette:
        palette = [blend_hex(room.floor_color, "#ffffff", 0.12)]

    detail_height = FLOOR_THICKNESS * 0.4
    z = -FLOOR_THICKNESS * 0.6
    boxes: List[Box] = []

    if texture_type == "planks":
        plank_width = float(room.floor_texture.get("plank_width", 0.18))
        direction = str(room.floor_texture.get("direction", "x")).lower()
        if direction not in {"x", "y"}:
            direction = "x"
        if direction == "x":
            y_cursor = room.origin[1]
            index = 0
            while y_cursor < room.origin[1] + room.dimensions.depth - 1e-6:
                depth = min(plank_width, room.origin[1] + room.dimensions.depth - y_cursor)
                color = palette[index % len(palette)]
                boxes.append(
                    Box(
                        name=f"{room.name} plank {index}",
                        category="floor_detail",
                        x=room.origin[0],
                        y=y_cursor,
                        z=z,
                        width=room.dimensions.width,
                        depth=depth,
                        height=detail_height,
                        color=color,
                        alpha=1.0,
                    )
                )
                y_cursor += depth
                index += 1
        else:
            x_cursor = room.origin[0]
            index = 0
            while x_cursor < room.origin[0] + room.dimensions.width - 1e-6:
                width = min(plank_width, room.origin[0] + room.dimensions.width - x_cursor)
                color = palette[index % len(palette)]
                boxes.append(
                    Box(
                        name=f"{room.name} plank {index}",
                        category="floor_detail",
                        x=x_cursor,
                        y=room.origin[1],
                        z=z,
                        width=width,
                        depth=room.dimensions.depth,
                        height=detail_height,
                        color=color,
                        alpha=1.0,
                    )
                )
                x_cursor += width
                index += 1
    else:  # tiles
        tile_size = float(room.floor_texture.get("tile_size", 0.6))
        palette_cycle = palette or [room.floor_color]
        palette_len = len(palette_cycle)
        x_cursor = room.origin[0]
        index_x = 0
        while x_cursor < room.origin[0] + room.dimensions.width - 1e-6:
            width = min(tile_size, room.origin[0] + room.dimensions.width - x_cursor)
            y_cursor = room.origin[1]
            index_y = 0
            while y_cursor < room.origin[1] + room.dimensions.depth - 1e-6:
                depth = min(tile_size, room.origin[1] + room.dimensions.depth - y_cursor)
                palette_index = (index_x + index_y) % palette_len
                color = palette_cycle[palette_index]
                boxes.append(
                    Box(
                        name=f"{room.name} tile {index_x}-{index_y}",
                        category="floor_detail",
                        x=x_cursor,
                        y=y_cursor,
                        z=z,
                        width=width,
                        depth=depth,
                        height=detail_height,
                        color=color,
                        alpha=1.0,
                    )
                )
                y_cursor += depth
                index_y += 1
            x_cursor += width
            index_x += 1

    return boxes


def create_rugs(room: RoomSpec) -> List[Box]:
    return instantiate_items(room, room.rugs)


def create_baseboards(room: RoomSpec) -> List[Box]:
    base_color = blend_hex(room.wall_color, room.floor_color, 0.35)
    thickness = 0.04
    boxes: List[Box] = []
    x0, y0 = room.origin
    width = room.dimensions.width
    depth = room.dimensions.depth

    if "south" not in room.omit_walls:
        boxes.append(
            Box(
                name=f"{room.name} south baseboard",
                category="baseboard",
                x=x0,
                y=y0,
                z=0.0,
                width=width,
                depth=thickness,
                height=BASEBOARD_HEIGHT,
                color=base_color,
                alpha=1.0,
            )
        )
    if "north" not in room.omit_walls:
        boxes.append(
            Box(
                name=f"{room.name} north baseboard",
                category="baseboard",
                x=x0,
                y=y0 + depth - thickness,
                z=0.0,
                width=width,
                depth=thickness,
                height=BASEBOARD_HEIGHT,
                color=base_color,
                alpha=1.0,
            )
        )
    if "west" not in room.omit_walls:
        boxes.append(
            Box(
                name=f"{room.name} west baseboard",
                category="baseboard",
                x=x0,
                y=y0,
                z=0.0,
                width=thickness,
                depth=depth,
                height=BASEBOARD_HEIGHT,
                color=base_color,
                alpha=1.0,
            )
        )
    if "east" not in room.omit_walls:
        boxes.append(
            Box(
                name=f"{room.name} east baseboard",
                category="baseboard",
                x=x0 + width - thickness,
                y=y0,
                z=0.0,
                width=thickness,
                depth=depth,
                height=BASEBOARD_HEIGHT,
                color=base_color,
                alpha=1.0,
            )
        )

    return boxes


def create_walls(room: RoomSpec) -> List[Box]:
    boxes: List[Box] = []
    for wall in ("north", "south", "east", "west"):
        if wall in room.omit_walls:
            continue
        openings = openings_for_wall(room, wall)
        segments = compute_wall_segments(wall_length(room, wall), openings)
        for index, (start, end) in enumerate(segments):
            length = end - start
            if length <= 1e-4:
                continue
            boxes.append(
                create_wall_box(
                    room=room,
                    wall=wall,
                    start=start,
                    length=length,
                    bottom=0.0,
                    height=room.dimensions.height,
                    color=room.wall_color,
                    alpha=CATEGORY_DEFAULT_ALPHA["wall"],
                    category="wall",
                    name=f"{room.name} {wall} wall {index}",
                )
            )
    return boxes


def create_openings(room: RoomSpec) -> List[Box]:
    boxes: List[Box] = []
    for opening in (*room.windows, *room.doors):
        if opening.wall in room.omit_walls:
            continue
        boxes.extend(create_opening_surround(room, opening))
        panel_box = create_opening_panel(room, opening)
        if panel_box is not None:
            boxes.append(panel_box)
        boxes.extend(create_opening_frames(room, opening, panel_box))
    return boxes


def wall_length(room: RoomSpec, wall: str) -> float:
    return room.dimensions.width if wall in {"north", "south"} else room.dimensions.depth


def openings_for_wall(room: RoomSpec, wall: str) -> List[OpeningSpec]:
    return sorted(
        [opening for opening in (*room.windows, *room.doors) if opening.wall == wall],
        key=lambda opening: opening.offset,
    )


def compute_wall_segments(length: float, openings: Sequence[OpeningSpec]) -> List[Tuple[float, float]]:
    segments: List[Tuple[float, float]] = []
    cursor = 0.0
    for opening in openings:
        start = max(0.0, min(length, opening.offset))
        end = max(start, min(length, opening.offset + opening.width))
        if start - cursor > 1e-4:
            segments.append((cursor, start))
        cursor = max(cursor, end)
    if length - cursor > 1e-4:
        segments.append((cursor, length))
    return segments


def create_wall_box(
    *,
    room: RoomSpec,
    wall: str,
    start: float,
    length: float,
    bottom: float,
    height: float,
    color: str,
    alpha: float,
    category: str,
    name: str,
    depth_override: Optional[float] = None,
) -> Box:
    x0, y0 = room.origin
    width = room.dimensions.width
    depth = room.dimensions.depth
    if wall == "north":
        depth_val = depth_override if depth_override is not None else WALL_THICKNESS
        return Box(
            name=name,
            category=category,
            x=x0 + start,
            y=y0 + depth,
            z=bottom,
            width=length,
            depth=depth_val,
            height=height,
            color=color,
            alpha=alpha,
        )
    if wall == "south":
        depth_val = depth_override if depth_override is not None else WALL_THICKNESS
        return Box(
            name=name,
            category=category,
            x=x0 + start,
            y=y0 - depth_val,
            z=bottom,
            width=length,
            depth=depth_val,
            height=height,
            color=color,
            alpha=alpha,
        )
    if wall == "east":
        width_val = depth_override if depth_override is not None else WALL_THICKNESS
        return Box(
            name=name,
            category=category,
            x=x0 + width,
            y=y0 + start,
            z=bottom,
            width=width_val,
            depth=length,
            height=height,
            color=color,
            alpha=alpha,
        )
    if wall == "west":
        width_val = depth_override if depth_override is not None else WALL_THICKNESS
        return Box(
            name=name,
            category=category,
            x=x0 - width_val,
            y=y0 + start,
            z=bottom,
            width=width_val,
            depth=length,
            height=height,
            color=color,
            alpha=alpha,
        )
    raise LayoutError(f"Unsupported wall '{wall}'")


def create_opening_surround(room: RoomSpec, opening: OpeningSpec) -> List[Box]:
    boxes: List[Box] = []
    if opening.sill_height > 1e-3:
        boxes.append(
            create_wall_box(
                room=room,
                wall=opening.wall,
                start=opening.offset,
                length=opening.width,
                bottom=0.0,
                height=opening.sill_height,
                color=room.wall_color,
                alpha=CATEGORY_DEFAULT_ALPHA["wall"],
                category="wall",
                name=f"{room.name} {opening.name} sill",
            )
        )
    top_height = room.dimensions.height - (opening.sill_height + opening.height)
    if top_height > 1e-3:
        boxes.append(
            create_wall_box(
                room=room,
                wall=opening.wall,
                start=opening.offset,
                length=opening.width,
                bottom=opening.sill_height + opening.height,
                height=top_height,
                color=room.wall_color,
                alpha=CATEGORY_DEFAULT_ALPHA["wall"],
                category="wall",
                name=f"{room.name} {opening.name} lintel",
            )
        )
    return boxes


def create_opening_panel(room: RoomSpec, opening: OpeningSpec) -> Optional[Box]:
    depth = WALL_THICKNESS * (0.55 if opening.element == "window" else 0.7)
    color = opening.color
    alpha = opening.alpha
    offset = 0.0
    if opening.panel is not None:
        depth = min(opening.panel.thickness, WALL_THICKNESS * 0.95)
        color = opening.panel.color
        alpha = opening.panel.alpha
        offset = opening.panel.offset
    x, y, width, depth_val = compute_panel_geometry(room, opening, depth, offset)
    return Box(
        name=f"{room.name} {opening.name} panel",
        category=opening.element,
        x=x,
        y=y,
        z=opening.sill_height,
        width=width,
        depth=depth_val,
        height=opening.height,
        color=color,
        alpha=alpha,
    )


def compute_panel_geometry(
    room: RoomSpec,
    opening: OpeningSpec,
    depth: float,
    offset: float,
) -> Tuple[float, float, float, float]:
    x0, y0 = room.origin
    width = room.dimensions.width
    depth_room = room.dimensions.depth
    if opening.wall == "north":
        x = x0 + opening.offset
        y = y0 + depth_room + (WALL_THICKNESS - depth) / 2 - offset
        return x, y, opening.width, depth
    if opening.wall == "south":
        x = x0 + opening.offset
        y = y0 - WALL_THICKNESS + (WALL_THICKNESS - depth) / 2 + offset
        return x, y, opening.width, depth
    if opening.wall == "east":
        x = x0 + width + (WALL_THICKNESS - depth) / 2 - offset
        y = y0 + opening.offset
        return x, y, depth, opening.width
    # west
    x = x0 - WALL_THICKNESS + (WALL_THICKNESS - depth) / 2 + offset
    y = y0 + opening.offset
    return x, y, depth, opening.width


def create_opening_frames(room: RoomSpec, opening: OpeningSpec, panel_box: Optional[Box]) -> List[Box]:
    if not opening.frame_color:
        return []
    depth = panel_box.depth if panel_box is not None else WALL_THICKNESS * 0.5
    offset = opening.panel.offset if opening.panel is not None else 0.0
    x, y, width, depth_val = compute_panel_geometry(room, opening, depth, offset)
    frame_thickness = min(FRAME_THICKNESS, opening.width * 0.2)
    frame_depth = min(depth_val, FRAME_THICKNESS)
    bottom = opening.sill_height
    height = opening.height
    color = opening.frame_color
    category = "door" if opening.element == "door" else "window"
    boxes: List[Box] = []

    if opening.wall in {"north", "south"}:
        boxes.append(
            Box(
                name=f"{room.name} {opening.name} frame left",
                category=category,
                x=x - frame_thickness,
                y=y,
                z=bottom,
                width=frame_thickness,
                depth=frame_depth,
                height=height,
                color=color,
                alpha=1.0,
            )
        )
        boxes.append(
            Box(
                name=f"{room.name} {opening.name} frame right",
                category=category,
                x=x + width,
                y=y,
                z=bottom,
                width=frame_thickness,
                depth=frame_depth,
                height=height,
                color=color,
                alpha=1.0,
            )
        )
        cap_height = min(FRAME_THICKNESS, height * 0.25)
        boxes.append(
            Box(
                name=f"{room.name} {opening.name} frame top",
                category=category,
                x=x,
                y=y,
                z=bottom + height - cap_height,
                width=width,
                depth=frame_depth,
                height=cap_height,
                color=color,
                alpha=1.0,
            )
        )
    else:
        boxes.append(
            Box(
                name=f"{room.name} {opening.name} frame south",
                category=category,
                x=x,
                y=y,
                z=bottom,
                width=frame_depth,
                depth=frame_thickness,
                height=height,
                color=color,
                alpha=1.0,
            )
        )
        boxes.append(
            Box(
                name=f"{room.name} {opening.name} frame north",
                category=category,
                x=x,
                y=y + depth_val - frame_thickness,
                z=bottom,
                width=frame_depth,
                depth=frame_thickness,
                height=height,
                color=color,
                alpha=1.0,
            )
        )
        cap_height = min(FRAME_THICKNESS, height * 0.25)
        boxes.append(
            Box(
                name=f"{room.name} {opening.name} frame top",
                category=category,
                x=x,
                y=y,
                z=bottom + height - cap_height,
                width=frame_depth,
                depth=depth_val,
                height=cap_height,
                color=color,
                alpha=1.0,
            )
        )
    return boxes


def instantiate_items(room: RoomSpec, items: Sequence[ItemSpec]) -> List[Box]:
    boxes: List[Box] = []
    for spec in items:
        base_x = room.origin[0] + spec.position[0]
        base_y = room.origin[1] + spec.position[1]
        if spec.anchor == "center":
            base_x -= spec.size.width / 2
            base_y -= spec.size.depth / 2
        for index in range(spec.count):
            shift_x = spec.spacing[0] * index
            shift_y = spec.spacing[1] * index
            shift_z = spec.spacing[2] * index
            boxes.append(
                Box(
                    name=f"{spec.name}{' #' + str(index + 1) if spec.count > 1 else ''}",
                    category=spec.category,
                    x=base_x + shift_x,
                    y=base_y + shift_y,
                    z=spec.elevation + shift_z,
                    width=spec.size.width,
                    depth=spec.size.depth,
                    height=spec.size.height,
                    color=spec.color,
                    alpha=spec.alpha,
                )
            )
    return boxes


def require_render_backend():
    try:
        import numpy as np  # type: ignore
        import matplotlib.pyplot as plt  # type: ignore
        from matplotlib.patches import Patch, Rectangle  # type: ignore
        from mpl_toolkits.mplot3d.art3d import Poly3DCollection  # type: ignore
    except ImportError as exc:  # pragma: no cover - defensive
        message = (
            "Matplotlib and NumPy are required for rendering. Install them via\n"
            "  pip install matplotlib numpy\n"
            "and try again."
        )
        raise SystemExit(message) from exc
    return np, plt, Patch, Rectangle, Poly3DCollection

def box_faces(box: Box) -> List[List[Tuple[float, float, float]]]:
    x, y, z = box.x, box.y, box.z
    dx, dy, dz = box.width, box.depth, box.height
    v000 = (x, y, z)
    v100 = (x + dx, y, z)
    v010 = (x, y + dy, z)
    v110 = (x + dx, y + dy, z)
    v001 = (x, y, z + dz)
    v101 = (x + dx, y, z + dz)
    v011 = (x, y + dy, z + dz)
    v111 = (x + dx, y + dy, z + dz)
    return [
        [v000, v100, v110, v010],
        [v001, v101, v111, v011],
        [v000, v100, v101, v001],
        [v010, v110, v111, v011],
        [v000, v010, v011, v001],
        [v100, v110, v111, v101],
    ]


def draw_light(ax, np, light: LightSpec) -> None:
    u = np.linspace(0, 2 * np.pi, 20)
    v = np.linspace(0, np.pi, 20)
    x = light.radius * np.outer(np.cos(u), np.sin(v)) + light.position[0]
    y = light.radius * np.outer(np.sin(u), np.sin(v)) + light.position[1]
    z = light.radius * np.outer(np.ones_like(u), np.cos(v)) + light.position[2]
    ax.plot_surface(x, y, z, color=light.color, alpha=0.3, linewidth=0, shade=False)
    ax.scatter([light.position[0]], [light.position[1]], [light.position[2]], color=light.color, s=light.intensity * 1200, alpha=0.9, edgecolors="none")


def render_scene(scene: Scene, output: Path, *, dpi: int, show: bool) -> None:
    np, plt, Patch, Rectangle, Poly3DCollection = require_render_backend()
    output.parent.mkdir(parents=True, exist_ok=True)

    fig = plt.figure(figsize=(14, 10))
    ax = fig.add_subplot(111, projection="3d")
    fig.patch.set_facecolor(scene.layout.ambient.sky_color)
    ax.set_facecolor(scene.layout.ambient.fog_color)

    layer_map: Dict[str, List[Box]] = {}
    for box in scene.boxes:
        style_key = CATEGORY_TO_STYLE.get(box.category, box.category if box.category in STYLE_LIBRARY else "decor")
        layer_map.setdefault(style_key, []).append(box)

    for style_key in STYLE_ORDER:
        for box in layer_map.get(style_key, []):
            style_info = STYLE_LIBRARY.get(style_key, STYLE_LIBRARY["decor"])
            poly = Poly3DCollection(
                box_faces(box),
                facecolors=box.color,
                edgecolors=style_info["edge"],
                linewidths=0.6 if style_key not in {"window", "glass"} else 0.4,
                alpha=box.alpha,
            )
            ax.add_collection3d(poly)

    for style_key, boxes in layer_map.items():
        if style_key in STYLE_ORDER:
            continue
        style_info = STYLE_LIBRARY.get(style_key, STYLE_LIBRARY["decor"])
        for box in boxes:
            poly = Poly3DCollection(
                box_faces(box),
                facecolors=box.color,
                edgecolors=style_info["edge"],
                linewidths=0.6,
                alpha=box.alpha,
            )
            ax.add_collection3d(poly)

    min_x = min(box.x for box in scene.boxes)
    max_x = max(box.x + box.width for box in scene.boxes)
    min_y = min(box.y for box in scene.boxes)
    max_y = max(box.y + box.depth for box in scene.boxes)
    min_z = min(box.z for box in scene.boxes)
    max_z = max(box.z + box.height for box in scene.boxes)
    margin = 0.6
    ax.set_xlim(min_x - margin, max_x + margin)
    ax.set_ylim(min_y - margin, max_y + margin)
    ax.set_zlim(min(min_z, -0.4), max_z + 0.8)

    ax.view_init(elev=scene.layout.camera.elev, azim=scene.layout.camera.azim)
    ax.dist = scene.layout.camera.distance
    ax.set_axis_off()

    for light in scene.lights:
        draw_light(ax, np, light)

    for room in scene.layout.rooms:
        cx = room.origin[0] + room.dimensions.width / 2
        cy = room.origin[1] + room.dimensions.depth / 2
        cz = room.dimensions.height + 0.15
        ax.text(cx, cy, cz, room.name, ha="center", va="bottom", fontsize=8, color="#3d3530")

    ax.text2D(0.02, 0.96, scene.layout.layout_name, transform=ax.transAxes, fontsize=14, fontweight="bold", color="#4a3f33")
    if scene.layout.style:
        ax.text2D(0.02, 0.92, scene.layout.style, transform=ax.transAxes, fontsize=11, color="#5b5145")
    if scene.layout.mood:
        ax.text2D(0.02, 0.88, scene.layout.mood, transform=ax.transAxes, fontsize=10, color="#5f5548")
    if scene.layout.concept_notes:
        ax.text2D(0.02, 0.84, scene.layout.concept_notes, transform=ax.transAxes, fontsize=9, color="#64594d", wrap=True)

    handles: List[Patch] = []
    for style_key in STYLE_ORDER:
        if layer_map.get(style_key):
            style_info = STYLE_LIBRARY.get(style_key, STYLE_LIBRARY["decor"])
            handles.append(Patch(facecolor=style_info["legend_color"], edgecolor=style_info["edge"], alpha=0.7, label=style_info["label"]))
    if handles:
        ax.legend(handles=handles, loc="upper left", bbox_to_anchor=(0.0, 1.02))

    if scene.layout.color_palette:
        y = 0.25
        for label, colors in scene.layout.color_palette.items():
            fig.text(0.76, y + 0.015, label.capitalize(), fontsize=9, color="#463c34", ha="left")
            for idx, color in enumerate(colors):
                rect = Rectangle((0.76 + idx * 0.035, y), 0.03, 0.03, transform=fig.transFigure, facecolor=color, edgecolor="#463c34")
                fig.patches.append(rect)
            y -= 0.05

    plt.tight_layout()
    fig.savefig(output, dpi=dpi, bbox_inches="tight")
    if show:
        plt.show()
    plt.close(fig)


def parse_args(argv: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate a detailed 3D render of the apartment layout.")
    default_layout = Path(__file__).with_name("apartment_layout.json")
    default_output = Path(__file__).with_name("apartment_render.png")
    parser.add_argument("--layout-json", type=Path, default=default_layout, help="Path to the layout JSON file (default: %(default)s).")
    parser.add_argument("--output", type=Path, default=default_output, help="Where to save the rendered PNG image (default: %(default)s).")
    parser.add_argument("--dpi", type=int, default=220, help="Rendering resolution in DPI (default: %(default)s).")
    parser.add_argument("--show", action="store_true", help="Display the render in an interactive window after saving.")
    return parser.parse_args(argv)


def main(argv: Sequence[str]) -> int:
    args = parse_args(argv)
    layout_data = load_layout(args.layout_json)
    layout = parse_layout(layout_data)
    scene = create_scene(layout)
    render_scene(scene, args.output, dpi=args.dpi, show=args.show)
    print(f"Render saved to {args.output.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
