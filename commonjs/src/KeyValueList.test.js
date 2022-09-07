"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const KeyValueList_1 = require("./KeyValueList");
(0, globals_1.describe)('KeyValueList', () => {
    const keyValueList = new KeyValueList_1.KeyValueList('k');
    (0, globals_1.test)('push', () => {
        keyValueList.push({ k: '0', v: 'hoge' });
        keyValueList.push({ k: '1', v: 'fuga' });
        keyValueList.push({ k: '2', v: 'piyo' });
        keyValueList.push({ k: '3', v: 'foo' });
        keyValueList.push({ k: '4', v: 'bar' });
        (0, globals_1.expect)(keyValueList.list).toEqual([
            { k: '0', v: 'hoge' },
            { k: '1', v: 'fuga' },
            { k: '2', v: 'piyo' },
            { k: '3', v: 'foo' },
            { k: '4', v: 'bar' },
        ]);
        (0, globals_1.expect)(() => {
            keyValueList.push({ k: '0', v: 'foo' });
        }).toThrow('Duplicate id');
    });
    (0, globals_1.test)('get', () => {
        (0, globals_1.expect)(keyValueList.get('2')).toEqual({ k: '2', v: 'piyo' });
        (0, globals_1.expect)(() => {
            keyValueList.get('901');
        }).toThrow('Wrong id');
    });
    (0, globals_1.test)('has', () => {
        (0, globals_1.expect)(keyValueList.has('0')).toBe(true);
        (0, globals_1.expect)(keyValueList.has('901')).toBe(false);
    });
    (0, globals_1.test)('set', () => {
        keyValueList.set({ k: '2', v: 'piyo2' });
        (0, globals_1.expect)(keyValueList.get('2')).toEqual({ k: '2', v: 'piyo2' });
        (0, globals_1.expect)(() => {
            keyValueList.set({ k: '901', v: 'foo' });
        }).toThrow('Wrong id');
    });
    (0, globals_1.test)('remove', () => {
        keyValueList.remove('2');
        (0, globals_1.expect)(keyValueList.list.length).toBe(4);
        (0, globals_1.expect)(keyValueList.list).toEqual([
            { k: '0', v: 'hoge' },
            { k: '1', v: 'fuga' },
            { k: '3', v: 'foo' },
            { k: '4', v: 'bar' },
        ]);
        (0, globals_1.expect)(() => {
            keyValueList.remove('901');
        }).toThrow('Wrong id');
    });
    (0, globals_1.test)('pickAndInsert', () => {
        keyValueList.pickAndInsert('0', '0', 'before');
        keyValueList.pickAndInsert('0', '0', 'after');
        (0, globals_1.expect)(keyValueList.list).toEqual([
            { k: '0', v: 'hoge' },
            { k: '1', v: 'fuga' },
            { k: '3', v: 'foo' },
            { k: '4', v: 'bar' },
        ]);
        keyValueList.pickAndInsert('0', '4', 'before');
        (0, globals_1.expect)(keyValueList.list).toEqual([
            { k: '1', v: 'fuga' },
            { k: '3', v: 'foo' },
            { k: '0', v: 'hoge' },
            { k: '4', v: 'bar' },
        ]);
        keyValueList.pickAndInsert('3', '0', 'after');
        (0, globals_1.expect)(keyValueList.list).toEqual([
            { k: '1', v: 'fuga' },
            { k: '0', v: 'hoge' },
            { k: '3', v: 'foo' },
            { k: '4', v: 'bar' },
        ]);
        (0, globals_1.expect)(() => {
            keyValueList.pickAndInsert('901', '902', 'before');
        }).toThrow('Wrong id');
    });
});
