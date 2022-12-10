"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KeyValueList = void 0;
/**
 * Ordered Key-value store
 */
class KeyValueList extends EventTarget {
    /**
     * @param fieldNameID Name of field for id.
     */
    constructor(fieldNameID) {
        super();
        this._list = [];
        this.fieldNameID = fieldNameID;
    }
    /**
     * Get the list managed by the instance.
     * Note that changes to returned list DON'T affect managed list.
     */
    get list() {
        return this._list;
    }
    /**
     * Push items to the list.
     * @param items
     * @returns
     * @throws Throws `Duplicate id` when trying to push items with the id same to item already exists.
     */
    push(...items) {
        const idList = this._list.map((v) => {
            return v[this.fieldNameID];
        });
        const pushedIDList = items.map((v) => {
            return v[this.fieldNameID];
        });
        const setForComp = new Set([...idList, ...pushedIDList]);
        if (setForComp.size !== idList.length + pushedIDList.length) {
            throw new Error('Duplicate id');
        }
        this._list.push(...items);
        this.dispatchEvent(new Event('update'));
        return;
    }
    getIndex(id) {
        const idx = this._list.findIndex((v) => {
            return v[this.fieldNameID] === id;
        });
        return idx;
    }
    /**
     * Search for item with specified id.
     * @param id
     * @returns Item with specified id.
     * @throws Throws `Wrong id` when specified wrong/unused id.
     */
    get(id) {
        const item = this._list.find((v) => {
            return v[this.fieldNameID] === id;
        });
        if (!item) {
            throw new Error('Wrong id');
        }
        return item;
    }
    getNthItemAhead(id, n) {
        const idx = this.getIndex(id);
        if (idx === -1) {
            throw new Error('Wrong id');
        }
        if (idx + n < 0 || idx + n > this.list.length - 1) {
            throw new Error('Segmentation Fault');
        }
        return this._list[idx + n];
    }
    /**
     * Whether item with specified id exists or not.
     * @param id
     */
    has(id) {
        return this.getIndex(id) !== -1;
    }
    /**
     * Overwrite existing item.
     * The item which has id same as specified item will be overwritten.
     * @param item
     * @returns
     * @throws Throws `Wrong id` when specified item with wrong/unused id.
     */
    set(item) {
        const id = item[this.fieldNameID];
        const idx = this.getIndex(id);
        if (idx === -1) {
            throw new Error('Wrong id');
        }
        this._list[idx] = item;
        this.dispatchEvent(new Event('update'));
        return;
    }
    /**
     * Remove item with specified id.
     * @param id
     * @returns Throws `Wrong id` when specified wrong/unused id.
     */
    remove(id) {
        const idx = this.getIndex(id);
        if (idx === -1) {
            throw new Error('Wrong id');
        }
        this._list.splice(idx, 1);
        this.dispatchEvent(new Event('update'));
        return;
    }
    /**
     * Pick an item from the list by id (`pickFrom`) and insert to before/after the item specified by id (`insertTo`).
     * @param pickFrom Specify id for picked item
     * @param insertTo Specify id for item before/after insert position.
     * @param beforeOrAfter Specify whether picked items should be inserted to before or after `insertTo` item.
     */
    pickAndInsert(pickFrom, insertTo, beforeOrAfter) {
        const pickFromIdx = this.getIndex(pickFrom);
        let insertToIdx = this.getIndex(insertTo);
        if (pickFromIdx === -1 || insertToIdx === -1) {
            throw new Error('Wrong id');
        }
        if (pickFromIdx === insertToIdx) {
            return;
        }
        if (pickFromIdx < insertToIdx) {
            insertToIdx = insertToIdx - 1;
        }
        const pickedItem = this._list[pickFromIdx];
        this._list.splice(pickFromIdx, 1);
        if (beforeOrAfter === 'before') {
            this._list.splice(insertToIdx, 0, pickedItem);
        }
        else {
            this._list.splice(insertToIdx + 1, 0, pickedItem);
        }
        this.dispatchEvent(new Event('update'));
        return;
    }
}
exports.KeyValueList = KeyValueList;
