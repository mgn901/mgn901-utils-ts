import { describe, expect, test } from '@jest/globals';
import { KeyValueList } from './KeyValueList';

describe('KeyValueList', () => {

	const keyValueList = new KeyValueList<{ k: string, v: string }, 'k'>('k');

	test('push', () => {
		keyValueList.push({ k: '0', v: 'hoge' });
		keyValueList.push({ k: '1', v: 'fuga' });
		keyValueList.push({ k: '2', v: 'piyo' });
		keyValueList.push({ k: '3', v: 'foo' });
		keyValueList.push({ k: '4', v: 'bar' });
		expect(keyValueList.list).toEqual([
			{ k: '0', v: 'hoge' },
			{ k: '1', v: 'fuga' },
			{ k: '2', v: 'piyo' },
			{ k: '3', v: 'foo' },
			{ k: '4', v: 'bar' },
		]);
		expect(() => {
			keyValueList.push({ k: '0', v: 'foo' });
		}).toThrow('Duplicate id');
	});

	test('get', () => {
		expect(keyValueList.get('2')).toEqual({ k: '2', v: 'piyo' });
		expect(() => {
			keyValueList.get('901');
		}).toThrow('Wrong id');
	});

	test('getNthItemAhead', () => {
		expect(() => {
			keyValueList.getNthItemAhead('901', 1);
		}).toThrow('Wrong id');
		expect(keyValueList.getNthItemAhead('3', 1)).toEqual({ k: '4', v: 'bar' });
		expect(() => {
			keyValueList.getNthItemAhead('4', 1);
		}).toThrow('Segmentation Fault');
	});

	test('has', () => {
		expect(keyValueList.has('0')).toBe(true);
		expect(keyValueList.has('901')).toBe(false);
	});

	test('set', () => {
		keyValueList.set({ k: '2', v: 'piyo2' });
		expect(keyValueList.get('2')).toEqual({ k: '2', v: 'piyo2' });
		expect(() => {
			keyValueList.set({ k: '901', v: 'foo' });
		}).toThrow('Wrong id');
	});

	test('remove', () => {
		keyValueList.remove('2');
		expect(keyValueList.list.length).toBe(4);
		expect(keyValueList.list).toEqual([
			{ k: '0', v: 'hoge' },
			{ k: '1', v: 'fuga' },
			{ k: '3', v: 'foo' },
			{ k: '4', v: 'bar' },
		]);
		expect(() => {
			keyValueList.remove('901');
		}).toThrow('Wrong id');
	});

	test('pickAndInsert', () => {
		keyValueList.pickAndInsert('0', '0', 'before');
		keyValueList.pickAndInsert('0', '0', 'after');
		expect(keyValueList.list).toEqual([
			{ k: '0', v: 'hoge' },
			{ k: '1', v: 'fuga' },
			{ k: '3', v: 'foo' },
			{ k: '4', v: 'bar' },
		]);
		keyValueList.pickAndInsert('0', '4', 'before');
		expect(keyValueList.list).toEqual([
			{ k: '1', v: 'fuga' },
			{ k: '3', v: 'foo' },
			{ k: '0', v: 'hoge' },
			{ k: '4', v: 'bar' },
		]);
		keyValueList.pickAndInsert('3', '0', 'after');
		expect(keyValueList.list).toEqual([
			{ k: '1', v: 'fuga' },
			{ k: '0', v: 'hoge' },
			{ k: '3', v: 'foo' },
			{ k: '4', v: 'bar' },
		]);
		expect(() => {
			keyValueList.pickAndInsert('901', '902', 'before');
		}).toThrow('Wrong id');
	});

})
