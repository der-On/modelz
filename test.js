'use strict';

var Signal = require('signals').Signal;
var Schema = require('./')();
var tape = require('tape');

function barThing(name) {
  return {
    what: function() {
      return 'this is a bar named "' + name + '"';
    },
    type: 'typeBar'
  };
}

var fooSchema = Schema({
  // required string with default
  type: ['string', true, 'typeFoo'],
  // required number with default
  baz: 123,
  // required string without default
  bar: ['string', true],
  // required number without default
  count: ['number', true, 1],
  // optional child model without default
  barThing: barThing,
  // optional child collection without default
  barThingList: [barThing]
}, {
  preInit: function(foo) {
    foo.onChange = new Signal();
    return foo;
  },
  onChangeListener: function(foo) {
    return foo.onChange.dispatch;
  }
});

function fooModel(foo) {
  foo = fooSchema(foo);
  foo.getPrefixedBar = function(prefix) {
    return prefix + foo.bar;
  };
  return foo;
}

var foo = fooModel({
  bar: 'this is a foo',
  count: 7,
  barThing: 'my super bar',
  barThingList: ['bar1', 'bar2', 'bar3']
});

tape('Schema', function(t) {

  t.test('# Basics', function(t) {
    t.equal(foo.type, 'typeFoo', 'should allow string properties and set defaults');
    t.equal(foo.count, 7, 'should allow number properties');
    t.equal(foo.baz, 123, 'should allow definition by default value');
    t.equal(foo.getPrefixedBar('ATTENTION: '), 'ATTENTION: this is a foo',
            'should use properties');
    t.equal(foo.barThing.type, 'typeBar', 'should instantiate sub models');
    t.equal(foo.barThing.what(), 'this is a bar named "my super bar"',
            'submodel should be fully instantiated');
    t.equal(foo.barThingList.length, 3, 'should allow array property');
    t.equal(foo.barThingList[1].what(), 'this is a bar named "bar2"',
            'items of array property should be instantiated');
    t.throws(function() {
      fooModel({
        barThing: 'aa',
        barThingList: []
      });
    }, 'should throw error if data misses a required field');
    foo.onChange.addOnce(function(key, value, oldValue) {
      t.ok(true, 'should fire events');
      t.equal(key, 'bar', 'should deliver changed key');
      t.equal(value, 'new bar', 'should deliver new value');
      t.equal(oldValue, 'this is a foo', 'should deliver old value');
      t.end();
    });
    foo.bar = 'new bar';
  });

  t.test('# Arrays', function(t) {
    var schema = Schema({
      list: ['string']
    }, {
      arrayConstructor: function(array) {
        array.last = function() {
          return array[array.length -1];
        };
        return array;
      }
    });
    var testObj = schema({
      list: ['haha', 'huhu', 'hoho']
    });
    t.equal(testObj.list.last(), 'hoho', 'defined function should be callable');
    t.end();
  });

  t.test('# Extra properties', function(t) {
    var schema = Schema({});
    var testObj = schema({ bar: 'huhu' });
    t.equal(testObj.bar, undefined, 'bar property shouldn\'t be presend');
    schema = Schema({}, {
      extraProperties: true
    });
    testObj = schema({ bar: 'huhu' });
    t.equal(testObj.bar, 'huhu', 'bar property should now be possible');
    t.end();
  });

  t.test('# Computed properties', function(t) {
    t.plan(6);
    var schema = Schema({
      a: 'string',
      b: 'string',
      ab: {
        cacheKey: ['a', 'b'],
        get: function(testObj) {
          return testObj.a + '|' + testObj.b;
        },
        set: function(testObj, value) {
          //ES6 [testObj.a, testObj.b] = value.split('|');
          value = value.split('|');
          testObj.a = value[0];
          testObj.b = value[1];
        }
      }
    }, {
      onChangeListener: function(obj) {
        return function(key, newValue, oldValue) {
          if (key === 'a') {
            t.deepEqual([oldValue, newValue], ['AA', 'CC'],
              'change event on first dependency should be fired');
          }
          if (key === 'b') {
            t.deepEqual([oldValue, newValue], ['BB', 'DD'],
              'change event on second dependency should be fired');
          }
          if (key === 'ab') {
            t.deepEqual([oldValue, newValue], ['AA|BB', 'CC|DD'],
              'change event on computed property should be fired');
          }
        };
      }
    });
    var testObj = schema({ a: 'AA', b: 'BB' });
    t.equal(testObj.ab, 'AA|BB', 'should have computed property');
    testObj.ab = 'CC|DD';
    t.equal(testObj.a, 'CC', 'attribute should be set by computed property');
    t.equal(testObj.b, 'DD', 'attribute should be set by computed property');
  });
});
