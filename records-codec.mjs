/**
 * HoldingsAtlas records document codec v1. Pure browser ES module, no dependencies.
 * All arrays and objects are tagged, so literal arrays/objects cannot collide with refs.
 * This encodes JSON data, not JavaScript-only values, accessors or prototype instances.
 */
export const RECORDS_CODEC_VERSION = 1;
const MAGIC = '$holdingsAtlasRecords';
const ARRAY = 0, OBJECT = 1, STRING_REFERENCE = 2, NEGATIVE_ZERO = 3;
const own = (object, key) => Object.hasOwn(object, key);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const legacy = value => {
  if (!object(value) || !own(value, 'sources')) return false;
  const descriptor = Object.getOwnPropertyDescriptor(value, 'records');
  return !!descriptor && own(descriptor, 'value') && Array.isArray(descriptor.value);
};
const invalid = reason => { throw new TypeError('Invalid records JSON format: ' + reason); };

export function isEncodedRecordsDocument(value) {
  return object(value) && !legacy(value) && own(value, MAGIC) && value[MAGIC] === RECORDS_CODEC_VERSION;
}

export function encodeRecordsDocument(document, options = {}) {
  if (!legacy(document)) invalid('document requires a records array and sources');
  const dictionary = options.dictionary !== false;
  const minStringLength = options.minStringLength ?? 16;
  if (!Number.isSafeInteger(minStringLength) || minStringLength < 0) invalid('dictionary minimum string length');
  const counts = new Map(), ancestors = new Set();
  function visit(value) {
    if (value === null || typeof value === 'boolean' || typeof value === 'string') {
      if (dictionary && typeof value === 'string' && value.length >= minStringLength) counts.set(value, (counts.get(value) || 0) + 1);
      return;
    }
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) invalid('only finite JSON numbers are supported');
      return;
    }
    if (typeof value !== 'object') invalid('Unsupported non-JSON value: ' + typeof value);
    if (ancestors.has(value)) invalid('cyclic JSON value');
    if (Object.getOwnPropertySymbols(value).length) invalid('JSON symbol property');
    ancestors.add(value);
    try {
      if (Array.isArray(value)) {
        if (Object.keys(value).length !== value.length || Object.getOwnPropertyNames(value).length !== value.length + 1) invalid('sparse JSON array or extra array property');
        for (let index = 0; index < value.length; index++) {
          const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
          if (!descriptor || !own(descriptor, 'value')) invalid('JSON array hole or accessor');
          visit(descriptor.value);
        }
      } else {
        if (Object.getPrototypeOf(value) !== Object.prototype) invalid('Unsupported JSON object prototype');
        const keys = Object.keys(value);
        if (Object.getOwnPropertyNames(value).length !== keys.length) invalid('non-enumerable JSON object property');
        for (const key of keys) {
          const descriptor = Object.getOwnPropertyDescriptor(value, key);
          if (!descriptor || !own(descriptor, 'value')) invalid('JSON object accessor property');
          visit(descriptor.value);
        }
      }
    } finally { ancestors.delete(value); }
  }
  visit(document);
  const strings = [], references = new Map();
  for (const [text, count] of counts) {
    if (count < 2) continue;
    const literalLength = JSON.stringify(text).length;
    const referenceLength = 4 + String(strings.length).length; // [2,index]
    if (count * (literalLength - referenceLength) <= literalLength + 1) continue;
    references.set(text, strings.length);
    strings.push(text);
  }
  const shapes = [], shapeIds = new Map();
  function encode(value) {
    if (typeof value === 'string') return references.has(value) ? [STRING_REFERENCE, references.get(value)] : value;
    if (typeof value === 'number') return Object.is(value, -0) ? [NEGATIVE_ZERO] : value;
    if (value === null || typeof value === 'boolean') return value;
    if (Array.isArray(value)) {
      const row = new Array(value.length + 1);
      row[0] = ARRAY;
      for (let index = 0; index < value.length; index++) row[index + 1] = encode(value[index]);
      return row;
    }
    const keys = Object.keys(value), signature = JSON.stringify(keys);
    let shapeId = shapeIds.get(signature);
    if (shapeId === undefined) { shapeId = shapes.length; shapeIds.set(signature, shapeId); shapes.push(keys); }
    const row = new Array(keys.length + 2);
    row[0] = OBJECT; row[1] = shapeId;
    for (let index = 0; index < keys.length; index++) row[index + 2] = encode(value[keys[index]]);
    return row;
  }
  const encodedDocument = encode(document);
  return { [MAGIC]: RECORDS_CODEC_VERSION, strings, shapes, document: encodedDocument };
}

export function decodeRecordsDocument(input) {
  // Old public files remain usable, including their unrelated metadata/magic-like fields.
  if (legacy(input)) return input;
  if (!object(input) || !own(input, MAGIC)) invalid('Unsupported document');
  if (input[MAGIC] !== RECORDS_CODEC_VERSION) invalid('Unsupported format version');
  if (Object.keys(input).some(key => ![MAGIC, 'strings', 'shapes', 'document'].includes(key)) || !own(input, 'document')) invalid('Unsupported envelope fields');
  const { strings, shapes } = input;
  if (!Array.isArray(strings) || Object.keys(strings).length !== strings.length || strings.some(text => typeof text !== 'string')) invalid('dictionary must contain strings');
  if (!Array.isArray(shapes) || Object.keys(shapes).length !== shapes.length) invalid('shape table');
  for (const keys of shapes) {
    if (!Array.isArray(keys) || Object.keys(keys).length !== keys.length || keys.some(key => typeof key !== 'string') || new Set(keys).size !== keys.length) invalid('shape keys must be unique strings');
  }
  const ancestors = new Set();
  const indexIn = (index, table) => Number.isSafeInteger(index) && index >= 0 && index < table.length;
  function decode(node) {
    if (node === null || typeof node === 'boolean' || typeof node === 'string') return node;
    if (typeof node === 'number') { if (!Number.isFinite(node)) invalid('non-finite number'); return node; }
    if (!Array.isArray(node) || !node.length || Object.keys(node).length !== node.length) invalid('encoded node or tag');
    if (ancestors.has(node)) invalid('cyclic encoded node');
    ancestors.add(node);
    try {
      if (node[0] === ARRAY) {
        const values = new Array(node.length - 1);
        for (let index = 1; index < node.length; index++) values[index - 1] = decode(node[index]);
        return values;
      }
      if (node[0] === OBJECT) {
        if (node.length < 2 || !indexIn(node[1], shapes)) invalid('object shape reference');
        const keys = shapes[node[1]];
        if (node.length !== keys.length + 2) invalid('object row arity');
        const result = {};
        for (let index = 0; index < keys.length; index++) Object.defineProperty(result, keys[index], { value: decode(node[index + 2]), enumerable: true, writable: true, configurable: true });
        return result;
      }
      if (node[0] === STRING_REFERENCE) {
        if (node.length !== 2 || !indexIn(node[1], strings)) invalid('string dictionary reference');
        return strings[node[1]];
      }
      if (node[0] === NEGATIVE_ZERO) {
        if (node.length !== 1) invalid('negative-zero tag arity');
        return -0;
      }
      invalid('Unsupported node tag');
    } finally { ancestors.delete(node); }
  }
  const document = decode(input.document);
  if (!legacy(document)) invalid('decoded document requires records and sources');
  return document;
}
