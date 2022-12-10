/**
 * Ordered Key-value store
 */
declare class KeyValueList<TObject extends object, FieldNameID extends keyof TObject> extends EventTarget {
    private _list;
    private fieldNameID;
    /**
     * @param fieldNameID Name of field for id.
     */
    constructor(fieldNameID: FieldNameID);
    /**
     * Get the list managed by the instance.
     * Note that changes to returned list DON'T affect managed list.
     */
    get list(): TObject[];
    /**
     * Push items to the list.
     * @param items
     * @returns
     * @throws Throws `Duplicate id` when trying to push items with the id same to item already exists.
     */
    push(...items: TObject[]): void;
    private getIndex;
    /**
     * Search for item with specified id.
     * @param id
     * @returns Item with specified id.
     * @throws Throws `Wrong id` when specified wrong/unused id.
     */
    get(id: TObject[FieldNameID]): TObject;
    getNthItemAhead(id: TObject[FieldNameID], n: number): TObject;
    /**
     * Whether item with specified id exists or not.
     * @param id
     */
    has(id: TObject[FieldNameID]): boolean;
    /**
     * Overwrite existing item.
     * The item which has id same as specified item will be overwritten.
     * @param item
     * @returns
     * @throws Throws `Wrong id` when specified item with wrong/unused id.
     */
    set(item: TObject): void;
    /**
     * Remove item with specified id.
     * @param id
     * @returns Throws `Wrong id` when specified wrong/unused id.
     */
    remove(id: TObject[FieldNameID]): void;
    /**
     * Pick an item from the list by id (`pickFrom`) and insert to before/after the item specified by id (`insertTo`).
     * @param pickFrom Specify id for picked item
     * @param insertTo Specify id for item before/after insert position.
     * @param beforeOrAfter Specify whether picked items should be inserted to before or after `insertTo` item.
     */
    pickAndInsert(pickFrom: TObject[FieldNameID], insertTo: TObject[FieldNameID], beforeOrAfter: 'before' | 'after'): void;
}
export { KeyValueList };
