'use strict';

var lodash = require('lodash');
var isNumber = lodash.isNumber;
var isArray = lodash.isArray;
var extend = lodash.extend;
var isFunction = lodash.isFunction;
var isUndefined = lodash.isUndefined;
var isString = lodash.isString;
var each = lodash.each;
var clone = lodash.clone;
var Signal = require('signals').Signal;

function indentity(thing) {
  return thing;
}

module.exports = function(globalConfig) {
  globalConfig = extend({
    castString: true,
    parseNumbers: true,
    changeEvent: true,
    extraProperties: false,
    embedPlainData: true,
    arrayConstructor: indentity
  }, globalConfig);

  function getConstructor(item) {
    if (isFunction(item)) {
      return item;
    }
    if (isString(item)) {
      return {
        string: function(value) {
          if (isString(value)) {
            return value;
          }
          if (globalConfig.castString) {
            return '' + value;
          }
          throw Error('Value "' + value + '" is not a string');
        },
        number: function(value) {
          if (isNumber(value)) {
            return value;
          }
          if (isString(value) && globalConfig.parseNumbers) {
            return parseFloat(value);
          }
          throw Error('Value ' + value + ' is not a number');
        }
      }[item];
    }
  }

  function parseConfig(config) {
    if (isArray(config) && config.length === 1) {
      // array of things
      return {
        isArray: true,
        constructor: getConstructor(config[0]),
        required: true,
        default: null
      };
    }
    if (isArray(config) && config.length === 3) {
      // short syntax [type, required, default]
      // or even [[type], required, default]
      return {
        isArray: isArray(config[0]) ? true : false,
        constructor: getConstructor(isArray(config[0]) ? config[0][0] : config[0]),
        required: config[1],
        default: config[2]
      };
    }
    if (isFunction(config)) {
      // plain constructor
      return {
        isArray: false,
        constructor: config,
        required: true,
        default: null
      };
    }
  }

  return function Schema(fields, config) {
    config = extend(globalConfig, config);
    return function(data) {
      var _data = clone(data);
      var result = {};

      if (globalConfig.extraProperties) {
        result = clone(_data);
      }
      if (config.embedPlainData) {
        result._data = _data;
      }
      if (config.changeEvent) {
        result.onChange = new Signal();
      }

      each(fields, function(fieldConfig, fieldname) {
        fieldConfig = parseConfig(fieldConfig);
        if (fieldConfig.isArray) {
          var arrayData = _data[fieldname].map(fieldConfig.constructor);
          _data[fieldname] = config.arrayConstructor(arrayData);
        } else {
          _data[fieldname] = fieldConfig.constructor(
            isUndefined(_data[fieldname]) ?
              fieldConfig.default : _data[fieldname]
          );
        }
        result.__defineGetter__(fieldname, function() {
          return result._data[fieldname];
        });
        result.__defineSetter__(fieldname, function(value) {
          var oldValue = _data[fieldname];
          _data[fieldname] = value;
          if (config.changeEvent) {
            result.onChange.dispatch(fieldname, value, oldValue);
          }
        });
      });
      return result;
    };
  };
};
