# API changes and C# traps in Unity 6

Checked against the Unity 6000.3 and 6000.6 manuals and script references on 2026-11-14. Each upgrade guide lists more changes than this file; read the guide for every version you cross: `https://docs.unity.com/en-us/engine/6000.6/manual/upgrade-guides/`.

## Language

- C# 9.0 on Roslyn in 6.3 and 6.6. Unsupported C# 9 features: suppressing the localsinit flag, covariant return types, module initializers, extensible calling conventions for unmanaged function pointers, init-only setters. Using them is a compile error.
- Records need `System.Runtime.CompilerServices.IsExternalInit`, which Unity's runtime lacks. Declare it in your own project. The same page warns against records in serialized types.
- CoreCLR exists in the 6.7 beta as a technical preview, "not suitable for production use". Unity 7 is announced with CoreCLR, .NET 10 and C# 14. None of that applies to 6.3 or 6.6.

## Changes by version

| Version | Change | What to write |
|---|---|---|
| 6.0 | `Object.FindObjectsOfType` and `FindObjectOfType` obsolete | `FindObjectsByType` and friends; the guide recommends `FindObjectsSortMode.None` because sorting is slow |
| 6.0 | `AddForceAtPosition` and `AddExplosionForce` apply a different torque with `ForceMode.VelocityChange` or `ForceMode.Acceleration` than in 2022 LTS | Re-tune physics that relied on the old torque |
| 6.0 | Enlighten Baked Global Illumination removed | Use another lightmapper |
| 6.3 | `[SerializeField]` only on fields; on a property or method it is an error | `[field: SerializeField]` for an auto-property's backing field |
| 6.3 | Netcode for GameObjects 1.x deprecated | Not used in this pack (see networking.md) |
| 6.4 | `Object.Destroy` now calls `OnDisable` on all descendants, not only the object and its direct children | Remove workarounds that propagated `OnDisable` by hand, or it fires twice |
| 6.4 | URP Compatibility Mode removed for custom render passes | Custom render passes that relied on it need rework; read the 6.4 guide |
| 6.5 | `InstanceID` replaced by `EntityId`; the old APIs are obsolete errors | `go.GetEntityId()` instead of `go.GetInstanceID()`; the id does not fit in an `int` |
| 6.5 | Built-In Render Pipeline deprecated; supported through the full 6.7 LTS lifecycle | New projects use URP or HDRP |
| 6.5 | Editor log moved to `<Project>/Logs/Editor.log` | Update CI log paths |
| 6.6 | `FindObjectsByType` overloads that take a sort mode obsolete; `FindFirstObjectByType` obsolete | `FindObjectsByType<T>()` (or the overload that takes `FindObjectsInactive`) and `FindAnyObjectByType<T>()` |
| 6.6 | `[SerializeField] Dictionary<TKey, TValue>` fields now serialize | Existing wrapper types keep working; moving data to a plain dictionary is a manual migration |
| 6.6 | Dynamic batching removed | Use another draw-call optimization |
| 6.6 | `UNITY_64` and `DEVELOPMENT_BUILD` symbols deprecated | `UNITY_ENABLE_CHECKS` for safety checks, `UNITY_INCLUDE_INSTRUMENTATION` for profiling and logging |
| 6.6 | Cinemachine 3 is a core package | Cinemachine 2 projects are upgraded automatically; review camera code |
| 6.6 | YAML word wrapping always off; Reduce Version Control Noise removed | Expect YAML diffs unrelated to your change after the upgrade; Unity suggests `AssetDatabase.ForceReserializeAssets` once, in its own commit |

Physics names: the 6.3 Rigidbody reference lists `linearVelocity`, `linearDamping` and `maxLinearVelocity`. In Unity's C# reference source, `velocity` and `drag` carry `[Obsolete]` attributes that point to `linearVelocity` and `linearDamping`. Code that uses them was written for an older editor.

## Engine behaviour

- **Null checks.** Unity overrides `==` and `!=` on `UnityEngine.Object`, so a destroyed object compares equal to `null` while it is not truly null. `?.` and `??` bypass that override; Unity's reference says they are not supported with Unity objects. Write `if (target != null)`.
- **Destroy is deferred.** `Destroy` marks the object; destruction happens after the current Update loop and before rendering. Code later in the same frame still sees it.
- **What serializes.** Unity serializes fields, not properties, and skips `static`, `const` and `readonly` fields. A custom class needs `[Serializable]`. Up to 6.5 it does not serialize multidimensional arrays, jagged arrays, dictionaries or nested containers. `JsonUtility` follows the same rules: fields only, no `Dictionary<>`, and no primitives or arrays passed at the top level.
- **Enter Play mode.** By default Unity reloads the domain and the scene on entering Play mode. A project that turns domain reload off keeps static state between runs; reset statics yourself.
- **Coordinates.** Unity uses a left-handed coordinate system, and `Vector3.forward` is (0, 0, 1). Check the axes of every imported model; `game-blender` covers the export side.
- **Editor code.** Code that uses `UnityEditor` goes in an `Editor` folder or an editor-only assembly. It is not in Player builds.

## Input

The legacy Input Manager is deprecated and will be removed in a future version. The Input System package is the replacement (assets-and-input.md). The Input System 7.0 docs describe a core package for Unity 6.7 and later; read `com.unity.inputsystem@1.20` for 6.3 and 6.6.
