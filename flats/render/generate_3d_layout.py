#!/usr/bin/env python3
"""Generate a simple 3D render of the apartment layout.

The script reads the conceptual layout from ``apartment_layout.json`` and uses
matplotlib's 3D toolkit to extrude each room into a block, placing simplified
furniture and soft decor elements inside. It saves the render as a PNG image and
optionally displays it in an interactive window.
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Sequence, Tuple

ROOM_HEIGHT_METERS = 2.7
WALL_GAP_METERS = 0.25
MIN_ROOM_SIDE_METERS = 2.2

ROOM_COLORS = [
    "#d8e2dc",
    "#ffe5d9",
    "#ffcad4",
    "#f4acb7",
    "#9d8189",
    "#c7f9cc",
    "#f6bd60",
    "#84a59d",
]
FURNITURE_COLOR = "#705c53"
SOFT_ITEM_COLOR = "#bcd4de"


@dataclass
class Room:
    """Structure representing the parsed data for a room."""

    name: str
    area_sqm: float
    description: str
    furniture: Sequence[str]
    soft_items: Sequence[str]


@dataclass
class PlacedRoom(Room):
    """A room with layout metadata for rendering."""

    origin: Tuple[float, float, float]
    width: float
    depth: float
    height: float = ROOM_HEIGHT_METERS
    color: str = "#d8e2dc"

    @property
    def x(self) -> float:
        return self.origin[0]

    @property
    def y(self) -> float:
        return self.origin[1]

    @property
    def z(self) -> float:
        return self.origin[2]

    @property
    def center(self) -> Tuple[float, float, float]:
        return (self.x + self.width / 2, self.y + self.depth / 2, self.z + self.height)


@dataclass
class Box:
    """Generic box primitive used to represent furniture and decor."""

    name: str
    x: float
    y: float
    z: float
    width: float
    depth: float
    height: float
    color: str
    alpha: float


class LayoutError(RuntimeError):
    """Raised when the layout configuration cannot be processed."""


def load_layout(path: Path) -> Dict:
    """Read the layout JSON file."""

    try:
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except FileNotFoundError as exc:
        raise LayoutError(f"Layout file not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise LayoutError(f"Layout file {path} is not valid JSON: {exc}") from exc


def parse_rooms(raw_rooms: Iterable[Dict]) -> List[Room]:
    """Convert raw JSON dictionaries into :class:`Room` instances."""

    rooms: List[Room] = []
    for data in raw_rooms:
        try:
            room = Room(
                name=data["name"],
                area_sqm=float(data["area_sqm"]),
                description=data.get("description", ""),
                furniture=tuple(data.get("furniture", ())),
                soft_items=tuple(data.get("soft_items", ())),
            )
        except KeyError as exc:
            raise LayoutError(f"Room definition is missing key: {exc}") from exc
        rooms.append(room)
    if not rooms:
        raise LayoutError("No rooms found in layout data.")
    return rooms


def compute_room_dimensions(area: float) -> Tuple[float, float]:
    """Estimate width and depth for a room with a given area."""

    width = max(math.sqrt(area), MIN_ROOM_SIDE_METERS)
    depth = max(area / width, MIN_ROOM_SIDE_METERS * 0.75)

    # Keep aspect ratios within a reasonable range for nicer renders.
    ratio_limit = 1.75
    if depth > width * ratio_limit:
        depth = width * ratio_limit
        width = max(area / depth, MIN_ROOM_SIDE_METERS)
    elif width > depth * ratio_limit:
        width = depth * ratio_limit
        depth = max(area / width, MIN_ROOM_SIDE_METERS * 0.75)

    return width, depth


def layout_rooms(rooms: Sequence[Room]) -> List[PlacedRoom]:
    """Arrange rooms in rows to avoid overlaps."""

    total_area = sum(room.area_sqm for room in rooms)
    target_row_width = math.sqrt(total_area)

    placed: List[PlacedRoom] = []
    x_cursor = 0.0
    y_cursor = 0.0
    row_height = 0.0

    for index, room in enumerate(rooms):
        width, depth = compute_room_dimensions(room.area_sqm)
        threshold = target_row_width * 1.05
        if x_cursor > 0.0 and x_cursor + width > threshold:
            y_cursor += row_height + WALL_GAP_METERS
            x_cursor = 0.0
            row_height = 0.0

        placed.append(
            PlacedRoom(
                name=room.name,
                area_sqm=room.area_sqm,
                description=room.description,
                furniture=room.furniture,
                soft_items=room.soft_items,
                origin=(x_cursor, y_cursor, 0.0),
                width=width,
                depth=depth,
                color=ROOM_COLORS[index % len(ROOM_COLORS)],
            )
        )

        x_cursor += width + WALL_GAP_METERS
        row_height = max(row_height, depth)

    return placed


def subdivide_items(room: PlacedRoom, items: Sequence[str], *, height: float, color: str, alpha: float) -> List[Box]:
    """Position items on a loose grid inside the room."""

    if not items:
        return []

    usable_width = room.width * 0.85
    usable_depth = room.depth * 0.85
    margin_x = (room.width - usable_width) / 2
    margin_y = (room.depth - usable_depth) / 2

    columns = max(1, math.ceil(math.sqrt(len(items))))
    rows = max(1, math.ceil(len(items) / columns))

    cell_width = usable_width / columns
    cell_depth = usable_depth / rows

    box_width = cell_width * 0.75
    box_depth = cell_depth * 0.75

    boxes: List[Box] = []
    for idx, name in enumerate(items):
        column = idx % columns
        row = idx // columns

        x = room.x + margin_x + column * cell_width + (cell_width - box_width) / 2
        y = room.y + margin_y + row * cell_depth + (cell_depth - box_depth) / 2

        boxes.append(
            Box(
                name=name,
                x=x,
                y=y,
                z=0.0,
                width=box_width,
                depth=box_depth,
                height=height,
                color=color,
                alpha=alpha,
            )
        )

    return boxes


def create_primitives(rooms: Sequence[PlacedRoom]) -> Tuple[List[PlacedRoom], List[Box], List[Box]]:
    """Build render primitives for rooms, furniture, and decor."""

    furniture_boxes: List[Box] = []
    soft_boxes: List[Box] = []

    for room in rooms:
        furniture_boxes.extend(
            subdivide_items(
                room,
                room.furniture,
                height=ROOM_HEIGHT_METERS * 0.4,
                color=FURNITURE_COLOR,
                alpha=0.85,
            )
        )
        soft_boxes.extend(
            subdivide_items(
                room,
                room.soft_items,
                height=ROOM_HEIGHT_METERS * 0.2,
                color=SOFT_ITEM_COLOR,
                alpha=0.9,
            )
        )

    # Raise soft items so they visually float above furniture.
    for box in soft_boxes:
        box.z = ROOM_HEIGHT_METERS * 0.45

    return list(rooms), furniture_boxes, soft_boxes


def require_matplotlib():
    """Import matplotlib lazily and provide a helpful error message if missing."""

    try:
        import matplotlib.pyplot as plt
        from matplotlib.patches import Patch
        from mpl_toolkits.mplot3d.art3d import Poly3DCollection
    except ImportError as exc:  # pragma: no cover - defensive guard
        message = (
            "Matplotlib is required to run this script. Install it via\n"
            "  pip install matplotlib\n"
            "and try again."
        )
        raise SystemExit(message) from exc
    return plt, Patch, Poly3DCollection


def box_faces(box: Box) -> List[List[Tuple[float, float, float]]]:
    """Return the six faces of a rectangular prism."""

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
        [v000, v100, v110, v010],  # bottom
        [v001, v101, v111, v011],  # top
        [v000, v100, v101, v001],  # front
        [v010, v110, v111, v011],  # back
        [v000, v010, v011, v001],  # left
        [v100, v110, v111, v101],  # right
    ]


def render_scene(
    rooms: Sequence[PlacedRoom],
    furniture: Sequence[Box],
    soft_items: Sequence[Box],
    output: Path,
    *,
    dpi: int,
    show: bool,
) -> None:
    """Render the 3D scene using matplotlib."""

    plt, Patch, Poly3DCollection = require_matplotlib()

    output.parent.mkdir(parents=True, exist_ok=True)

    fig = plt.figure(figsize=(12, 8))
    ax = fig.add_subplot(111, projection="3d")

    for room in rooms:
        room_box = Box(
            name=room.name,
            x=room.x,
            y=room.y,
            z=room.z,
            width=room.width,
            depth=room.depth,
            height=room.height,
            color=room.color,
            alpha=0.7,
        )
        poly = Poly3DCollection(box_faces(room_box), facecolors=room.color, edgecolors="#4a4a4a", linewidths=0.6, alpha=0.7)
        ax.add_collection3d(poly)
        ax.text(
            room.center[0],
            room.center[1],
            room.center[2] + 0.1,
            room.name,
            zdir="z",
            ha="center",
            va="bottom",
            fontsize=8,
            color="#2f2f2f",
        )

    for collection, edge_color in ((furniture, "#2b2119"), (soft_items, "#446064")):
        for box in collection:
            poly = Poly3DCollection(
                box_faces(box),
                facecolors=box.color,
                edgecolors=edge_color,
                linewidths=0.4,
                alpha=box.alpha,
            )
            ax.add_collection3d(poly)

    max_x = max(room.x + room.width for room in rooms) + WALL_GAP_METERS
    max_y = max(room.y + room.depth for room in rooms) + WALL_GAP_METERS
    ax.set_xlim(0, max_x)
    ax.set_ylim(0, max_y)
    ax.set_zlim(0, ROOM_HEIGHT_METERS * 1.2)
    ax.set_box_aspect((max_x, max_y, ROOM_HEIGHT_METERS * 1.2))

    ax.view_init(elev=25, azim=-135)
    ax.set_axis_off()

    legend_handles = [
        Patch(facecolor="#999999", edgecolor="#4a4a4a", alpha=0.4, label="Rooms"),
        Patch(facecolor=FURNITURE_COLOR, edgecolor="#2b2119", alpha=0.85, label="Furniture"),
        Patch(facecolor=SOFT_ITEM_COLOR, edgecolor="#446064", alpha=0.9, label="Soft decor"),
    ]
    ax.legend(handles=legend_handles, loc="upper left", bbox_to_anchor=(0.0, 1.02))

    plt.tight_layout()
    fig.savefig(output, dpi=dpi, bbox_inches="tight")
    if show:
        plt.show()
    plt.close(fig)


def parse_args(argv: Sequence[str]) -> argparse.Namespace:
    """Define and parse command line arguments."""

    default_layout = Path(__file__).with_name("apartment_layout.json")
    default_output = Path(__file__).with_name("apartment_render.png")

    parser = argparse.ArgumentParser(
        description="Generate a simple 3D render of the apartment layout.",
    )
    parser.add_argument(
        "--layout-json",
        type=Path,
        default=default_layout,
        help="Path to the layout JSON file (default: %(default)s).",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=default_output,
        help="Where to save the rendered PNG image (default: %(default)s).",
    )
    parser.add_argument(
        "--dpi",
        type=int,
        default=200,
        help="Rendering resolution in DPI (default: %(default)s).",
    )
    parser.add_argument(
        "--show",
        action="store_true",
        help="Open an interactive window after saving the render.",
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str]) -> int:
    args = parse_args(argv)

    layout_data = load_layout(args.layout_json)
    rooms = parse_rooms(layout_data.get("rooms", ()))
    placed_rooms = layout_rooms(rooms)
    rooms, furniture, soft_items = create_primitives(placed_rooms)

    render_scene(rooms, furniture, soft_items, args.output, dpi=args.dpi, show=args.show)
    print(f"Render saved to {args.output.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
