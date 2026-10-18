import test from "node:test";
import assert from "node:assert/strict";
import { matchesRooms, roomOptions } from "../web/room-filter.js";

test("multiple room counts match either choice and missing data is selectable separately", () => {
  const listings = [{ ambientes: 1 }, { ambientes: "2" }, { ambientes: 3 }, { ambientes: null }, {}];
  assert.deepEqual(listings.filter(item => matchesRooms(item, ["1", "3"])), [listings[0], listings[2]]);
  assert.deepEqual(listings.filter(item => matchesRooms(item, ["2", "unknown"])), [listings[1], listings[3], listings[4]]);
  assert.equal(listings.filter(item => matchesRooms(item, [])).length, 5);
});

test("room choices include larger properties present in the data", () => {
  assert.deepEqual(roomOptions([{ ambientes: 12 }, { ambientes: 6 }, { ambientes: 6 }]), ["1", "2", "3", "4", "5", "6", "12", "unknown"]);
});
