/**
 * GM-authoritative writes for players, through Foundry queries (User#query).
 * Foundry v14 only: the second handler argument, { user }, is new in v14.
 * In v13 that argument carries timeout information and no user.
 *
 * A player asks the active GM to make a change the player cannot make alone.
 * The GM client runs the handler, so the handler must decide whether the
 * asking user may make this change. Without that check any player could edit
 * any actor by sending a crafted request.
 *
 * Why queries and not game.socket: a raw socket handler receives only the
 * arguments the sender emitted, so any user id in the payload can be forged.
 * In v14 a query handler receives the asking User in its second argument;
 * trust that, never an id from the payload. Core's "dialog" query takes the
 * same { user } argument (CONFIG.queries in the v14 API docs). This skill
 * relies on core setting that user on the server side; no public page says
 * a client cannot forge it. Every handler refuses when it is not a User.
 *
 * canUserModify is the default check. When your rule lets a player change a
 * document they do not own (damage to a monster), replace it with a rule the
 * GM can verify, such as "the user owns the attacking actor".
 * Never drop the check.
 *
 * Sending a query needs the QUERY_USER permission. Players have it by default,
 * but a GM can revoke it; the query then fails on the player's side.
 */

const MODULE_ID = "my-module";
const Q_UPDATE_ACTOR = `${MODULE_ID}.updateActor`;
const Q_CREATE_ITEM = `${MODULE_ID}.createItem`;
const Q_DELETE_ITEM = `${MODULE_ID}.deleteItem`;

// Fields a player may change through this path. Everything else is refused,
// even for an owner, so a request cannot touch ownership, flags or type.
// The paths match HeroDataModel in type-data-model.mjs.
const ACTOR_FIELDS = new Set(["system.health", "system.mana"]);

// Item types and top-level fields a player may create through this path.
// Set this list yourself. A module cannot assume the world's system defines
// an Item type called "equipment": check the system's documentTypes, or use
// your own module sub-type, which carries the module prefix ("my-module.gear").
// "equipment" matches what actor-sheet.mjs creates.
// system data is left out on purpose: the item's data model fills defaults.
const ITEM_TYPES = new Set(["equipment"]);
const ITEM_FIELDS = new Set(["name", "type", "img"]);

const refuse = (reason) => ({ ok: false, reason });

/** Fail closed when the query context carries no User (v13, or a bad call). */
const isUser = (user) => user instanceof foundry.documents.User;

/** Register the handlers. Call in the "init" hook on every client. */
export function registerSocketQueries() {
  CONFIG.queries[Q_UPDATE_ACTOR] = handleUpdateActor;
  CONFIG.queries[Q_CREATE_ITEM] = handleCreateItem;
  CONFIG.queries[Q_DELETE_ITEM] = handleDeleteItem;
}

// ─── GM side ────────────────────────────────────────────────────────────────
// The GM client performs each write, so document hooks (createItem,
// updateActor, ...) see the GM as the author (userId), not the player who asked.

async function handleUpdateActor({ actorUuid, changes }, { user } = {}) {
  if (!isUser(user)) {
    return refuse("no-user");
  }
  const actor = await fromUuid(actorUuid);
  if (actor?.documentName !== "Actor") {
    return refuse("not-found");
  }

  const flat = foundry.utils.flattenObject(changes ?? {});
  const keys = Object.keys(flat);
  if (keys.length === 0 || !keys.every((k) => ACTOR_FIELDS.has(k))) {
    return refuse("field-not-allowed");
  }
  // The permission check runs against the asking user, not the GM running this code.
  if (!actor.canUserModify(user, "update", flat)) {
    return refuse("forbidden");
  }

  await actor.update(flat);
  return { ok: true };
}

async function handleCreateItem({ actorUuid, itemData }, { user } = {}) {
  if (!isUser(user)) {
    return refuse("no-user");
  }
  const actor = await fromUuid(actorUuid);
  if (actor?.documentName !== "Actor") {
    return refuse("not-found");
  }

  const data = itemData ?? {};
  if (
    !(
      ITEM_TYPES.has(data.type) &&
      Object.keys(data).every((k) => ITEM_FIELDS.has(k))
    )
  ) {
    return refuse("field-not-allowed");
  }
  // Test "create" for the asking user on an unsaved item whose parent is the
  // actor. Do not gate on the static Item.canUserCreate(user): it tests the
  // ITEM_CREATE role permission, which defaults to Assistant GM, so it refuses
  // every player even for items embedded in an actor they own.
  const ItemClass = foundry.documents.Item.implementation;
  // The constructor may mutate the object it gets, so pass a copy.
  const draft = new ItemClass({ ...data }, { parent: actor });
  if (!draft.canUserModify(user, "create", data)) {
    return refuse("forbidden");
  }

  await actor.createEmbeddedDocuments("Item", [data]);
  return { ok: true };
}

async function handleDeleteItem({ itemUuid }, { user } = {}) {
  if (!isUser(user)) {
    return refuse("no-user");
  }
  const item = await fromUuid(itemUuid);
  if (item?.documentName !== "Item") {
    return refuse("not-found");
  }
  if (!item.canUserModify(user, "delete")) {
    return refuse("forbidden");
  }

  await item.delete();
  return { ok: true };
}

// ─── Player side ────────────────────────────────────────────────────────────

/**
 * Send a query to the active GM, or report that none is online. When the
 * current user is the active GM, run the handler directly with its own User.
 */
function askGM(queryName, data) {
  const gm = game.users.activeGM;
  if (!gm) {
    ui.notifications.error("MY_MODULE.error.noGMOnline", { localize: true });
    return Promise.resolve(refuse("no-gm"));
  }
  if (gm === game.user) {
    return CONFIG.queries[queryName](data, { user: game.user });
  }
  return gm.query(queryName, data, { timeout: 10_000 });
}

/** Update allowed fields on an actor the user may modify. */
export function requestActorUpdate(actor, changes) {
  return askGM(Q_UPDATE_ACTOR, { actorUuid: actor.uuid, changes });
}

/** Create an allowed embedded Item on an actor the user may modify. */
export function requestItemCreate(actor, itemData) {
  return askGM(Q_CREATE_ITEM, { actorUuid: actor.uuid, itemData });
}

/** Delete an embedded Item the user may delete. */
export function requestItemDelete(item) {
  return askGM(Q_DELETE_ITEM, { itemUuid: item.uuid });
}
