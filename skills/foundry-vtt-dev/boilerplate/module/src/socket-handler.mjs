/**
 * GM-authoritative writes for players, through Foundry queries (User#query, v13+).
 *
 * A player asks the active GM to make a change the player cannot make alone.
 * The GM client runs the handler, so the handler must decide whether the
 * asking user may make this change. Without that check any player could edit
 * any actor by sending a crafted request.
 *
 * Why queries and not game.socket: a raw socket handler receives only the
 * arguments the sender emitted, so any user id in the payload can be forged.
 * A query handler receives the asking User in its second argument from
 * Foundry; trust that, never an id from the payload. Core's own "dialog"
 * query and Foundry's Crucible system use the same { user } context.
 *
 * canUserModify is the default check. When your rule lets a player change a
 * document they do not own (damage to a monster), replace it with a rule the
 * GM can verify, such as "the user owns the attacking actor".
 * Never drop the check.
 *
 * Sending a query needs the QUERY_USER permission. Players have it by default,
 * but a GM can revoke it; the query then fails on the player's side.
 */

const MODULE_ID = 'my-module';
const Q_UPDATE_ACTOR = `${MODULE_ID}.updateActor`;
const Q_CREATE_ITEM = `${MODULE_ID}.createItem`;
const Q_DELETE_ITEM = `${MODULE_ID}.deleteItem`;

// Fields a player may change through this path. Everything else is refused,
// even for an owner, so a request cannot touch ownership, flags or type.
// The paths match HeroDataModel in type-data-model.mjs.
const ACTOR_FIELDS = new Set(['system.health', 'system.mana']);

/** Register the handlers. Call in the "init" hook on every client. */
export function registerSocketQueries() {
  CONFIG.queries[Q_UPDATE_ACTOR] = handleUpdateActor;
  CONFIG.queries[Q_CREATE_ITEM] = handleCreateItem;
  CONFIG.queries[Q_DELETE_ITEM] = handleDeleteItem;
}

// ─── GM side ────────────────────────────────────────────────────────────────

async function handleUpdateActor({ actorUuid, changes }, { user }) {
  const actor = await fromUuid(actorUuid);
  if (actor?.documentName !== 'Actor') return { ok: false, reason: 'not-found' };

  const flat = foundry.utils.flattenObject(changes ?? {});
  const keys = Object.keys(flat);
  if (keys.length === 0 || !keys.every((k) => ACTOR_FIELDS.has(k))) {
    return { ok: false, reason: 'field-not-allowed' };
  }
  // The permission check runs against the asking user, not the GM running this code.
  if (!actor.canUserModify(user, 'update', flat)) return { ok: false, reason: 'forbidden' };

  await actor.update(flat);
  return { ok: true };
}

async function handleCreateItem({ actorUuid, itemData }, { user }) {
  const actor = await fromUuid(actorUuid);
  if (actor?.documentName !== 'Actor') return { ok: false, reason: 'not-found' };
  if (!actor.canUserModify(user, 'update')) return { ok: false, reason: 'forbidden' };

  await actor.createEmbeddedDocuments('Item', [itemData]);
  return { ok: true };
}

async function handleDeleteItem({ itemUuid }, { user }) {
  const item = await fromUuid(itemUuid);
  if (item?.documentName !== 'Item') return { ok: false, reason: 'not-found' };
  if (!item.canUserModify(user, 'delete')) return { ok: false, reason: 'forbidden' };

  await item.delete();
  return { ok: true };
}

// ─── Player side ────────────────────────────────────────────────────────────

/** Send a query to the active GM, or report that none is online. */
function askGM(queryName, data) {
  const gm = game.users.activeGM;
  if (!gm) {
    ui.notifications.error('MY_MODULE.error.noGMOnline', { localize: true });
    return Promise.resolve({ ok: false, reason: 'no-gm' });
  }
  return gm.query(queryName, data, { timeout: 10_000 });
}

/** Update allowed fields on an actor the user may modify. A GM writes directly. */
export function requestActorUpdate(actor, changes) {
  if (game.user.isGM) return actor.update(changes);
  return askGM(Q_UPDATE_ACTOR, { actorUuid: actor.uuid, changes });
}

/** Create an embedded Item on an actor the user may modify. */
export function requestItemCreate(actor, itemData) {
  if (game.user.isGM) return actor.createEmbeddedDocuments('Item', [itemData]);
  return askGM(Q_CREATE_ITEM, { actorUuid: actor.uuid, itemData });
}

/** Delete an embedded Item the user may delete. */
export function requestItemDelete(item) {
  if (game.user.isGM) return item.delete();
  return askGM(Q_DELETE_ITEM, { itemUuid: item.uuid });
}
