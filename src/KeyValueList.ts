/**
 * Ordered Key-value store
 */
class KeyValueList<TObject extends object, FieldNameID extends keyof TObject> extends EventTarget {
  private _list: TObject[] = [];
  private fieldNameID: FieldNameID;

  /**
   * @param fieldNameID Name of field for id.
   */
  constructor(fieldNameID: FieldNameID) {
    super();
    this.fieldNameID = fieldNameID;
  }

  /**
   * Get the list managed by the instance.
   * Note that changes to returned list DON'T affect managed list.
   */
  get list(): TObject[] {
    return this._list;
  }

  /**
   * Push items to the list.
   * @param items
   * @returns
   * @throws Throws `Duplicate id` when trying to push items with the id same to item already exists.
   */
  public push(...items: TObject[]): void {
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

  private getIndex(id: TObject[FieldNameID]): number {
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
  public get(id: TObject[FieldNameID]): TObject {
    const item = this._list.find((v) => {
      return v[this.fieldNameID] === id;
    });
    if (!item) {
      throw new Error('Wrong id');
    }
    return item;
  }

  public getNthItemAhead(id: TObject[FieldNameID], n: number): TObject {
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
  public has(id: TObject[FieldNameID]): boolean {
    return this.getIndex(id) !== -1;
  }

  /**
   * Overwrite existing item.
   * The item which has id same as specified item will be overwritten.
   * @param item
   * @returns
   * @throws Throws `Wrong id` when specified item with wrong/unused id.
   */
  public set(item: TObject): void {
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
  public remove(id: TObject[FieldNameID]): void {
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
  public pickAndInsert(
    pickFrom: TObject[FieldNameID],
    insertTo: TObject[FieldNameID],
    beforeOrAfter: 'before' | 'after',
  ): void {
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
    } else {
      this._list.splice(insertToIdx + 1, 0, pickedItem);
    }
    this.dispatchEvent(new Event('update'));
    return;
  }
}

export { KeyValueList };
