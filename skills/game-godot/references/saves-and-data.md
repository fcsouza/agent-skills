# Saves and data in Godot

Checked against Godot 4.7.2-stable and the 4.7 documentation, 2026-11-14. `game-save-load` owns the save design: what goes on the server, the versioned envelope, migrations, validation, slots, backups and conflicts. This file covers what changes when the client is Godot.

## Where and how to write

- Write saves under `user://`, the writable user-data path; `res://` is the project and is not a place for player data.
- Open files with `FileAccess.open(path, FileAccess.WRITE)` and `FileAccess.READ`. Since 4.4 the `store_*` methods return `bool`; check it.
- Settings and key bindings fit `ConfigFile`, which the docs suggest for user configuration.
- For saves, prefer JSON with the envelope from `game-save-load`, so a save uploaded to the Bun server parses there as well (this skill's rule). Godot's binary `store_var`/`var_to_bytes` format has no TypeScript decoder in this pack, so the server would need one (this skill's rule).

## Loading data that allows objects runs code

- `FileAccess.get_var(allow_objects)` defaults to `false`. With `true`, the docs warn that deserialized objects can contain code that gets executed, and not to use it on data from untrusted sources, to avoid remote code execution.
- `bytes_to_var_with_objects()` carries the same warning, and `var_to_bytes_with_objects()` can encode executable code.
- Untrusted includes cloud saves, saves shared between players, mod downloads and anything the server relays from another client (this skill's rule). Load those with `allow_objects` left `false`, or as JSON.

## JSON rules

- `JSON.stringify()` and `JSON.parse_string()` turn every number into a float, because JSON has only one number type. Convert ids, ticks, counts and enum values with `int()` after parsing.
- `JSON.parse_string()` returns `null` on a parse error. Check the type of the result (`if data is Dictionary`) before reading it.
- Godot's parser is laxer than the JSON specification: it ignores trailing commas, accepts raw newlines and tabs in strings, and parses numbers with `String.to_float()`. Do not use Godot's parser to decide whether a file is valid JSON for another system.
- `INF` becomes `1e99999` and `NAN` becomes `null`, which is lost. Keep non-finite numbers out of saves and messages.
- JSON cannot hold `Vector2`, `Vector3`, `Color`, `Rect2` or `Quaternion`. Write their parts as numbers (`{"x": 1.0, "y": 2.0}`), as Godot's own saving tutorial does, and rebuild them on load. This also matches `game-save-load`'s rule that a save holds plain data only.
- `JSON.from_native()` and `JSON.to_native()` convert Godot types to and from a JSON-safe form. Its output is Godot's own encoding, so a TypeScript server must know it; plain numbers are simpler (this skill's rule).

```gdscript
# Godot 4.7.2. Read a save written in game-save-load's envelope.
func read_save(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		return {}
	var f := FileAccess.open(path, FileAccess.READ)
	if f == null:
		return {}  # FileAccess.get_open_error() says why
	var data = JSON.parse_string(f.get_as_text())
	if not data is Dictionary:
		return {}  # damaged: fall back to the backup slot
	if not data.has("version"):
		return {}  # not an envelope: treat as damaged
	data.version = int(data.version)  # JSON numbers are floats
	return data
```

Verify the digest, migrate and validate as `game-save-load` describes before using the payload.
