# Algorithm notes

Read the section for the algorithm you are implementing. Each one lists steps, the parameters that matter and the known weakness.

## BSP rooms and corridors

1. Treat the whole map as the root node.
2. Split a leaf along a random horizontal or vertical line. Repeat until leaves fall under a minimum size.
3. Place one room inside each leaf. Rooms can be smaller than the leaf.
4. Connect rooms along the tree hierarchy.

Rooms never overlap and the layout looks tidy. To use the tree as design structure, group the rooms under an interior node into a themed wing: a single entrance that a key can lock, a reward-only wing, a monster wing, a split of enemy difficulty between the two child nodes.

## Cellular automata caves

Parameters: grid size, the chance `r` that a cell starts as rock, the number of steps `n`, and the neighbour threshold `T`.

1. Fill the grid, each cell is rock with chance `r`.
2. For `n` steps, turn a cell into rock if at least `T` of its neighbours are rock. Otherwise make it free.
3. Mark rock that touches free space as wall.

A set of values that worked in the book: `r` 0.5, `n` 4, `T` 5. Tune from there.

Weakness: each parameter changes several features at once. You cannot ask for a given number of rooms with a given connectivity. Test a batch of seeds after each change.

## Gradient noise and octaves

- Independent random values per cell give spikes, not terrain. Heights near each other are related.
- Gradient noise (Perlin) interpolates between random gradients on a lattice. One scale looks the same everywhere.
- Real terrain varies at several scales. Sum noise at several frequencies and scale each layer by the inverse of its frequency (1/f noise).
- Diamond-square is a cheaper approximation. It needs corner seeds, a number of iterations and a roughness value.
- Noise is fast and reliable and hard to steer. If you need a flat area or two guaranteed-reachable points, use agents or search on top of it.

## Witness path

1. Generate the level and a reference solution together (the tiles the player touches in each state: pick up the key, open the door, reach the exit).
2. Accept the level only if the witness is valid. A valid witness proves the level is solvable.
3. If players must not skip content, test that even the shortest solution passes through the required content.

The book builds this with answer set programming. The same idea works in plain code: return the path with the level and run a check over it.
