// Writes map data as JSON that is easy to read and to compare between versions:
// one room (or node, edge, feature...) per line, and points written tight as [x,y].
// Every tool that writes a building or campus file uses this, so the files always look the same.
//   var fmt = require('./json_format.js'); fs.writeFileSync(file, fmt.format(obj));
'use strict';

// One value on one line: {"id": "S01", "shape": [[79,389],[253,389]]}
function inline(v) {
  if (Array.isArray(v)) {
    if (v.length && v.every(function (x) { return typeof x === 'number'; })) { return '[' + v.join(',') + ']'; }
    if (v.length && v.every(function (x) { return Array.isArray(x) && x.every(function (y) { return typeof y === 'number'; }); })) {
      return '[' + v.map(inline).join(',') + ']';
    }
    return '[' + v.map(inline).join(', ') + ']';
  }
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v).filter(function (k) { return v[k] !== undefined; })
      .map(function (k) { return JSON.stringify(k) + ': ' + inline(v[k]); }).join(', ') + '}';
  }
  return JSON.stringify(v);
}

// A list of objects (or of lists) gets one item per line. Small objects stay on one line.
function block(v, indent) {
  var pad = new Array(indent + 1).join('  '), pad2 = pad + '  ';
  if (Array.isArray(v)) {
    var big = v.length > 1 && v.some(function (x) { return (x && typeof x === 'object') || typeof x === 'string'; }) && inline(v).length > 100;
    if (!big) { return inline(v); }
    return '[\n' + v.map(function (x) { return pad2 + inline(x); }).join(',\n') + '\n' + pad + ']';
  }
  if (v && typeof v === 'object') {
    if (inline(v).length <= 100 && indent > 0) { return inline(v); }
    var keys = Object.keys(v).filter(function (k) { return v[k] !== undefined; });
    return '{\n' + keys.map(function (k) { return pad2 + JSON.stringify(k) + ': ' + block(v[k], indent + 1); }).join(',\n') + '\n' + pad + '}';
  }
  return JSON.stringify(v);
}

function format(obj) { return block(obj, 0) + '\n'; }

module.exports = { format: format, inline: inline };
