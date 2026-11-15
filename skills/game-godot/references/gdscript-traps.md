# GDScript traps

Checked against Godot 4.7.2-stable and the 4.7 documentation, 2026-11-14. Each item is a change an assistant trained on older Godot gets wrong.

## Godot 3 to Godot 4

| Godot 3 habit | Godot 4 |
|---|---|
| `export var speed = 200`, `onready var label = $Label`, `tool` | `@export var speed = 200`, `@onready var label = $Label`, `@tool` |
| `yield(get_tree().create_timer(1), "timeout")` | `await get_tree().create_timer(1).timeout`. `yield` survives only as a reserved keyword |
| `button.connect("pressed", self, "_on_pressed")` | `button.pressed.connect(_on_pressed)`. The string form still exists but signal-name errors then show only at run time |
| Child `_ready()` also ran the parent's `_ready()` | Lifecycle overrides no longer call the parent. Call `super()` at the top of the override |
| Tween node | Removed; use Tweeners (`create_tween()`) |
| `File`, `Directory` | `FileAccess`, `DirAccess`; several methods are now static |
| `Spatial`, `KinematicBody`, `KinematicBody2D`, `Sprite`, `AnimatedSprite`, `SpatialMaterial` | `Node3D`, `CharacterBody3D`, `CharacterBody2D`, `Sprite2D`, `AnimatedSprite2D`, `StandardMaterial3D` |
| `TileMap` with layers | `TileMap` is deprecated. One `TileMapLayer` node per layer; the editor can extract layers from an old TileMap |
| Fixed random sequence without a seed | `randomize()` runs on project load. Seed explicitly for reproducible runs |
| Setter and getter syntax | Changed; the converter handles it only partly |
| `String` everywhere | `String` and `StringName` are distinct. `"a" == &"a"` is true but `is_same("a", &"a")` is false |

`godot --headless --path . --validate-conversion-3to4` lists what the converter would rename before you run `--convert-3to4`.

## Changes inside Godot 4

- **4.4**: FileAccess `store_*` methods return `bool` instead of nothing. `@export_file` stores `uid://` paths, so exported file arrays can mix `uid://` and `res://`. `.uid` files appear beside scripts and shaders.
- **4.5**: GDScript supports variadic functions (`func log_all(...args)`) and abstract classes and methods with `@abstract`.
- **4.6**: Jolt is the default physics engine for new 3D projects; existing projects keep their setting. New Windows projects default to Direct3D 12. `StreamPeerTCP` and `TCPServer` methods such as `poll` and `get_status` moved to the base classes `StreamPeerSocket` and `SocketServer`. AnimationPlayer's `current_animation`, `assigned_animation` and `autoplay` became `StringName`. Scenes stop writing `load_steps` and start writing node `unique_id`s.
- **4.7**: mouse and keyboard events use `InputEvent.DEVICE_ID_MOUSE` and `InputEvent.DEVICE_ID_KEYBOARD` as device IDs, not `0`, because some joypads use `0`. `Object.is_class()` takes a `StringName`.

## Rules that do not change between versions

- **Lifecycle order**: `_enter_tree()` runs parent first, then children; `_ready()` runs children first, then the parent. `queue_free()` deletes the node at the end of the current frame, with all its children.
- **Memory**: `RefCounted` and `Resource` free themselves when no longer referenced. A `Node` or plain `Object` stays until `free()` or `queue_free()`. Break reference cycles with `weakref()`; check a freed object with `is_instance_valid()`.
- **Processing**: `_physics_process()` runs at a fixed rate (60 per second by default); `_process()` runs once per rendered frame with a variable `delta`. Move physics bodies in `_physics_process()`. With physics interpolation on, call `reset_physics_interpolation()` after placing or teleporting a node, or it streaks.
- **Physics tick rate**: at very low rates, usually below 30 per second, physics can break down, and input lags. Godot also simulates at most `max_physics_steps_per_frame` ticks per rendered frame; past that, the game slows down.
- **Coordinates**: 3D is Y-up and right-handed, 1 unit is 1 metre. 2D has its origin top-left, Y pointing down, units in pixels. Angles are radians.
- **Naming**: snake_case for files, functions, variables and signals; PascalCase for `class_name`, node names and enums; CONSTANT_CASE for constants and enum members.
- **Tool scripts**: a `@tool` script runs in the editor. Freeing nodes from it, especially the script's owner, can crash the editor.
- **Input**: gameplay input goes in `_unhandled_input()`, so GUI controls see events first. Map keys to actions in the InputMap and read them with `Input.is_action_pressed()`.
