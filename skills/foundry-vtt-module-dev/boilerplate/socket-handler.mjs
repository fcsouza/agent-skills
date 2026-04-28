const MODULE_ID = 'my-module';
const SOCKET_NAME = `module.${MODULE_ID}`;

// ─── Request type constants ──────────────────────────────────────────────────

export const REQUEST = Object.freeze({
  UPDATE_ACTOR: 'UPDATE_ACTOR',
  CREATE_ITEM:  'CREATE_ITEM',
  DELETE_ITEM:  'DELETE_ITEM',
  ROLL_REQUEST: 'ROLL_REQUEST',
});

// ─── GM-side listener ────────────────────────────────────────────────────────

/**
 * Register the socket listener. Call this in the "ready" hook.
 * Only the GM processes incoming requests — clients emit and forget.
 */
export function initSocketListeners() {
  game.socket.on(SOCKET_NAME, async (request) => {
    if (!game.user.isGM) return;

    try {
      switch (request.type) {
        case REQUEST.UPDATE_ACTOR:
          await _handleUpdateActor(request);
          break;
        case REQUEST.CREATE_ITEM:
          await _handleCreateItem(request);
          break;
        case REQUEST.DELETE_ITEM:
          await _handleDeleteItem(request);
          break;
        case REQUEST.ROLL_REQUEST:
          await _handleRollRequest(request);
          break;
        default:
          console.warn(`${MODULE_ID} | Unknown socket request type: ${request.type}`);
      }
    } catch (err) {
      console.error(`${MODULE_ID} | Socket handler error (${request.type}):`, err);
    }
  });

  console.log(`${MODULE_ID} | Socket listeners registered`);
}

// ─── GM handler implementations ─────────────────────────────────────────────

async function _handleUpdateActor({ actorId, changes }) {
  const actor = game.actors.get(actorId);
  if (!actor) throw new Error(`Actor ${actorId} not found`);

  await actor.update(changes);
}

async function _handleCreateItem({ actorId, itemData }) {
  const actor = game.actors.get(actorId);
  if (!actor) throw new Error(`Actor ${actorId} not found`);

  await actor.createEmbeddedDocuments('Item', [itemData]);
}

async function _handleDeleteItem({ actorId, itemId }) {
  const actor = game.actors.get(actorId);
  if (!actor) throw new Error(`Actor ${actorId} not found`);

  const item = actor.items.get(itemId);
  if (!item) throw new Error(`Item ${itemId} not found on actor ${actorId}`);

  await item.delete();
}

async function _handleRollRequest({ actorId, formula, flavor }) {
  const actor = game.actors.get(actorId);
  if (!actor) throw new Error(`Actor ${actorId} not found`);

  const roll = new Roll(formula, actor.getRollData());
  await roll.evaluate();
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor,
  });
}

// ─── Client-facing helpers ───────────────────────────────────────────────────

/**
 * Returns true if at least one connected GM is online.
 * Used before emitting a socket request that requires GM authority.
 */
function _assertGMOnline() {
  const gmOnline = game.users.some((u) => u.isGM && u.active);
  if (!gmOnline) {
    ui.notifications.error(game.i18n.localize('MY_MODULE.error.noGMOnline'));
    return false;
  }
  return true;
}

/**
 * Update an actor with GM authority.
 * If the caller is GM, executes directly. Otherwise emits a socket request.
 */
export async function requestActorUpdate(actorId, changes) {
  if (game.user.isGM) {
    const actor = game.actors.get(actorId);
    if (!actor) return ui.notifications.error(`Actor ${actorId} not found`);
    return actor.update(changes);
  }

  if (!_assertGMOnline()) return;

  game.socket.emit(SOCKET_NAME, {
    type: REQUEST.UPDATE_ACTOR,
    actorId,
    changes,
  });
}

/**
 * Create an embedded Item on an actor with GM authority.
 */
export async function requestItemCreate(actorId, itemData) {
  if (game.user.isGM) {
    const actor = game.actors.get(actorId);
    if (!actor) return ui.notifications.error(`Actor ${actorId} not found`);
    return actor.createEmbeddedDocuments('Item', [itemData]);
  }

  if (!_assertGMOnline()) return;

  game.socket.emit(SOCKET_NAME, {
    type: REQUEST.CREATE_ITEM,
    actorId,
    itemData,
  });
}

/**
 * Delete an embedded Item from an actor with GM authority.
 */
export async function requestItemDelete(actorId, itemId) {
  if (game.user.isGM) {
    const actor = game.actors.get(actorId);
    if (!actor) return ui.notifications.error(`Actor ${actorId} not found`);
    const item = actor.items.get(itemId);
    if (!item) return ui.notifications.error(`Item ${itemId} not found`);
    return item.delete();
  }

  if (!_assertGMOnline()) return;

  game.socket.emit(SOCKET_NAME, {
    type: REQUEST.DELETE_ITEM,
    actorId,
    itemId,
  });
}
