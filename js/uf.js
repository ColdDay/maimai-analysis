
(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(factory());
}(this, (function () { 'use strict';

/**
 * @this {Promise}
 */
function finallyConstructor(callback) {
  var constructor = this.constructor;
  return this.then(
    function(value) {
      // @ts-ignore
      return constructor.resolve(callback()).then(function() {
        return value;
      });
    },
    function(reason) {
      // @ts-ignore
      return constructor.resolve(callback()).then(function() {
        // @ts-ignore
        return constructor.reject(reason);
      });
    }
  );
}

// Store setTimeout reference so promise-polyfill will be unaffected by
// other code modifying setTimeout (like sinon.useFakeTimers())
var setTimeoutFunc = setTimeout;

function isArray(x) {
  return Boolean(x && typeof x.length !== 'undefined');
}

function noop() {}

// Polyfill for Function.prototype.bind
function bind(fn, thisArg) {
  return function() {
    fn.apply(thisArg, arguments);
  };
}

/**
 * @constructor
 * @param {Function} fn
 */
function Promise(fn) {
  if (!(this instanceof Promise))
    throw new TypeError('Promises must be constructed via new');
  if (typeof fn !== 'function') throw new TypeError('not a function');
  /** @type {!number} */
  this._state = 0;
  /** @type {!boolean} */
  this._handled = false;
  /** @type {Promise|undefined} */
  this._value = undefined;
  /** @type {!Array<!Function>} */
  this._deferreds = [];

  doResolve(fn, this);
}

function handle(self, deferred) {
  while (self._state === 3) {
    self = self._value;
  }
  if (self._state === 0) {
    self._deferreds.push(deferred);
    return;
  }
  self._handled = true;
  Promise._immediateFn(function() {
    var cb = self._state === 1 ? deferred.onFulfilled : deferred.onRejected;
    if (cb === null) {
      (self._state === 1 ? resolve : reject)(deferred.promise, self._value);
      return;
    }
    var ret;
    try {
      ret = cb(self._value);
    } catch (e) {
      reject(deferred.promise, e);
      return;
    }
    resolve(deferred.promise, ret);
  });
}

function resolve(self, newValue) {
  try {
    // Promise Resolution Procedure: https://github.com/promises-aplus/promises-spec#the-promise-resolution-procedure
    if (newValue === self)
      throw new TypeError('A promise cannot be resolved with itself.');
    if (
      newValue &&
      (typeof newValue === 'object' || typeof newValue === 'function')
    ) {
      var then = newValue.then;
      if (newValue instanceof Promise) {
        self._state = 3;
        self._value = newValue;
        finale(self);
        return;
      } else if (typeof then === 'function') {
        doResolve(bind(then, newValue), self);
        return;
      }
    }
    self._state = 1;
    self._value = newValue;
    finale(self);
  } catch (e) {
    reject(self, e);
  }
}

function reject(self, newValue) {
  self._state = 2;
  self._value = newValue;
  finale(self);
}

function finale(self) {
  if (self._state === 2 && self._deferreds.length === 0) {
    Promise._immediateFn(function() {
      if (!self._handled) {
        Promise._unhandledRejectionFn(self._value);
      }
    });
  }

  for (var i = 0, len = self._deferreds.length; i < len; i++) {
    handle(self, self._deferreds[i]);
  }
  self._deferreds = null;
}

/**
 * @constructor
 */
function Handler(onFulfilled, onRejected, promise) {
  this.onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : null;
  this.onRejected = typeof onRejected === 'function' ? onRejected : null;
  this.promise = promise;
}

/**
 * Take a potentially misbehaving resolver function and make sure
 * onFulfilled and onRejected are only called once.
 *
 * Makes no guarantees about asynchrony.
 */
function doResolve(fn, self) {
  var done = false;
  try {
    fn(
      function(value) {
        if (done) return;
        done = true;
        resolve(self, value);
      },
      function(reason) {
        if (done) return;
        done = true;
        reject(self, reason);
      }
    );
  } catch (ex) {
    if (done) return;
    done = true;
    reject(self, ex);
  }
}

Promise.prototype['catch'] = function(onRejected) {
  return this.then(null, onRejected);
};

Promise.prototype.then = function(onFulfilled, onRejected) {
  // @ts-ignore
  var prom = new this.constructor(noop);

  handle(this, new Handler(onFulfilled, onRejected, prom));
  return prom;
};

Promise.prototype['finally'] = finallyConstructor;

Promise.all = function(arr) {
  return new Promise(function(resolve, reject) {
    if (!isArray(arr)) {
      return reject(new TypeError('Promise.all accepts an array'));
    }

    var args = Array.prototype.slice.call(arr);
    if (args.length === 0) return resolve([]);
    var remaining = args.length;

    function res(i, val) {
      try {
        if (val && (typeof val === 'object' || typeof val === 'function')) {
          var then = val.then;
          if (typeof then === 'function') {
            then.call(
              val,
              function(val) {
                res(i, val);
              },
              reject
            );
            return;
          }
        }
        args[i] = val;
        if (--remaining === 0) {
          resolve(args);
        }
      } catch (ex) {
        reject(ex);
      }
    }

    for (var i = 0; i < args.length; i++) {
      res(i, args[i]);
    }
  });
};

Promise.resolve = function(value) {
  if (value && typeof value === 'object' && value.constructor === Promise) {
    return value;
  }

  return new Promise(function(resolve) {
    resolve(value);
  });
};

Promise.reject = function(value) {
  return new Promise(function(resolve, reject) {
    reject(value);
  });
};

Promise.race = function(arr) {
  return new Promise(function(resolve, reject) {
    if (!isArray(arr)) {
      return reject(new TypeError('Promise.race accepts an array'));
    }

    for (var i = 0, len = arr.length; i < len; i++) {
      Promise.resolve(arr[i]).then(resolve, reject);
    }
  });
};

// Use polyfill for setImmediate for performance gains
Promise._immediateFn =
  // @ts-ignore
  (typeof setImmediate === 'function' &&
    function(fn) {
      // @ts-ignore
      setImmediate(fn);
    }) ||
  function(fn) {
    setTimeoutFunc(fn, 0);
  };

Promise._unhandledRejectionFn = function _unhandledRejectionFn(err) {
  if (typeof console !== 'undefined' && console) {
    console.warn('Possible Unhandled Promise Rejection:', err); // eslint-disable-line no-console
  }
};

/** @suppress {undefinedVars} */
var globalNS = (function() {
  // the only reliable means to get the global object is
  // `Function('return this')()`
  // However, this causes CSP violations in Chrome apps.
  if (typeof self !== 'undefined') {
    return self;
  }
  if (typeof window !== 'undefined') {
    return window;
  }
  if (typeof global !== 'undefined') {
    return global;
  }
  throw new Error('unable to locate global object');
})();

if (!('Promise' in globalNS)) {
  globalNS['Promise'] = Promise;
} else if (!globalNS.Promise.prototype['finally']) {
  globalNS.Promise.prototype['finally'] = finallyConstructor;
}

})));

(function() {
    (function() {
        var token = /d{1,4}|M{1,4}|YY(?:YY)?|S{1,3}|Do|ZZ|Z|([HhMsDm])\1?|[aA]|"[^"]*"|'[^']*'/g;
        var twoDigitsOptional = "[1-9]\\d?";
        var twoDigits = "\\d\\d";
        var threeDigits = "\\d{3}";
        var fourDigits = "\\d{4}";
        var word = "[^\\s]+";
        var literal = /\[([^]*?)\]/gm;
        function shorten(arr, sLen) {
            var newArr = [];
            for (var i = 0, len = arr.length; i < len; i++) {
                newArr.push(arr[i].substr(0, sLen));
            }
            return newArr;
        }
        var monthUpdate = function (arrName) { return function (v, i18n) {
            var lowerCaseArr = i18n[arrName].map(function (v) { return v.toLowerCase(); });
            var index = lowerCaseArr.indexOf(v.toLowerCase());
            if (index > -1) {
                return index;
            }
            return null;
        }; };
        function assign(origObj) {
            var args = [];
            for (var _i = 1; _i < arguments.length; _i++) {
                args[_i - 1] = arguments[_i];
            }
            for (var _a = 0, args_1 = args; _a < args_1.length; _a++) {
                var obj = args_1[_a];
                for (var key in obj) {
                    // @ts-ignore ex
                    origObj[key] = obj[key];
                }
            }
            return origObj;
        }
        var dayNames = [
            "Sunday",
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday"
        ];
        var monthNames = [
            "January",
            "February",
            "March",
            "April",
            "May",
            "June",
            "July",
            "August",
            "September",
            "October",
            "November",
            "December"
        ];
        var monthNamesShort = shorten(monthNames, 3);
        var dayNamesShort = shorten(dayNames, 3);
        var defaultI18n = {
            dayNamesShort: dayNamesShort,
            dayNames: dayNames,
            monthNamesShort: monthNamesShort,
            monthNames: monthNames,
            amPm: ["am", "pm"],
            DoFn: function (dayOfMonth) {
                return (dayOfMonth +
                    ["th", "st", "nd", "rd"][dayOfMonth % 10 > 3
                        ? 0
                        : ((dayOfMonth - (dayOfMonth % 10) !== 10 ? 1 : 0) * dayOfMonth) % 10]);
            }
        };
        var globalI18n = assign({}, defaultI18n);
        var setGlobalDateI18n = function (i18n) {
            return (globalI18n = assign(globalI18n, i18n));
        };
        var regexEscape = function (str) {
            return str.replace(/[|\\{()[^$+*?.-]/g, "\\$&");
        };
        var pad = function (val, len) {
            if (len === void 0) { len = 2; }
            val = String(val);
            while (val.length < len) {
                val = "0" + val;
            }
            return val;
        };
        var formatFlags = {
            D: function (dateObj) { return String(dateObj.getDate()); },
            DD: function (dateObj) { return pad(dateObj.getDate()); },
            Do: function (dateObj, i18n) {
                return i18n.DoFn(dateObj.getDate());
            },
            d: function (dateObj) { return String(dateObj.getDay()); },
            dd: function (dateObj) { return pad(dateObj.getDay()); },
            ddd: function (dateObj, i18n) {
                return i18n.dayNamesShort[dateObj.getDay()];
            },
            dddd: function (dateObj, i18n) {
                return i18n.dayNames[dateObj.getDay()];
            },
            M: function (dateObj) { return String(dateObj.getMonth() + 1); },
            MM: function (dateObj) { return pad(dateObj.getMonth() + 1); },
            MMM: function (dateObj, i18n) {
                return i18n.monthNamesShort[dateObj.getMonth()];
            },
            MMMM: function (dateObj, i18n) {
                return i18n.monthNames[dateObj.getMonth()];
            },
            YY: function (dateObj) {
                return pad(String(dateObj.getFullYear()), 4).substr(2);
            },
            YYYY: function (dateObj) { return pad(dateObj.getFullYear(), 4); },
            h: function (dateObj) { return String(dateObj.getHours() % 12 || 12); },
            hh: function (dateObj) { return pad(dateObj.getHours() % 12 || 12); },
            H: function (dateObj) { return String(dateObj.getHours()); },
            HH: function (dateObj) { return pad(dateObj.getHours()); },
            m: function (dateObj) { return String(dateObj.getMinutes()); },
            mm: function (dateObj) { return pad(dateObj.getMinutes()); },
            s: function (dateObj) { return String(dateObj.getSeconds()); },
            ss: function (dateObj) { return pad(dateObj.getSeconds()); },
            S: function (dateObj) {
                return String(Math.round(dateObj.getMilliseconds() / 100));
            },
            SS: function (dateObj) {
                return pad(Math.round(dateObj.getMilliseconds() / 10), 2);
            },
            SSS: function (dateObj) { return pad(dateObj.getMilliseconds(), 3); },
            a: function (dateObj, i18n) {
                return dateObj.getHours() < 12 ? i18n.amPm[0] : i18n.amPm[1];
            },
            A: function (dateObj, i18n) {
                return dateObj.getHours() < 12
                    ? i18n.amPm[0].toUpperCase()
                    : i18n.amPm[1].toUpperCase();
            },
            ZZ: function (dateObj) {
                var offset = dateObj.getTimezoneOffset();
                return ((offset > 0 ? "-" : "+") +
                    pad(Math.floor(Math.abs(offset) / 60) * 100 + (Math.abs(offset) % 60), 4));
            },
            Z: function (dateObj) {
                var offset = dateObj.getTimezoneOffset();
                return ((offset > 0 ? "-" : "+") +
                    pad(Math.floor(Math.abs(offset) / 60), 2) +
                    ":" +
                    pad(Math.abs(offset) % 60, 2));
            }
        };
        var monthParse = function (v) { return +v - 1; };
        var emptyDigits = [null, twoDigitsOptional];
        var emptyWord = [null, word];
        var amPm = [
            "isPm",
            word,
            function (v, i18n) {
                var val = v.toLowerCase();
                if (val === i18n.amPm[0]) {
                    return 0;
                }
                else if (val === i18n.amPm[1]) {
                    return 1;
                }
                return null;
            }
        ];
        var timezoneOffset = [
            "timezoneOffset",
            "[^\\s]*?[\\+\\-]\\d\\d:?\\d\\d|[^\\s]*?Z?",
            function (v) {
                var parts = (v + "").match(/([+-]|\d\d)/gi);
                if (parts) {
                    var minutes = +parts[1] * 60 + parseInt(parts[2], 10);
                    return parts[0] === "+" ? minutes : -minutes;
                }
                return 0;
            }
        ];
        var parseFlags = {
            D: ["day", twoDigitsOptional],
            DD: ["day", twoDigits],
            Do: ["day", twoDigitsOptional + word, function (v) { return parseInt(v, 10); }],
            M: ["month", twoDigitsOptional, monthParse],
            MM: ["month", twoDigits, monthParse],
            YY: [
                "year",
                twoDigits,
                function (v) {
                    var now = new Date();
                    var cent = +("" + now.getFullYear()).substr(0, 2);
                    return +("" + (+v > 68 ? cent - 1 : cent) + v);
                }
            ],
            h: ["hour", twoDigitsOptional, undefined, "isPm"],
            hh: ["hour", twoDigits, undefined, "isPm"],
            H: ["hour", twoDigitsOptional],
            HH: ["hour", twoDigits],
            m: ["minute", twoDigitsOptional],
            mm: ["minute", twoDigits],
            s: ["second", twoDigitsOptional],
            ss: ["second", twoDigits],
            YYYY: ["year", fourDigits],
            S: ["millisecond", "\\d", function (v) { return +v * 100; }],
            SS: ["millisecond", twoDigits, function (v) { return +v * 10; }],
            SSS: ["millisecond", threeDigits],
            d: emptyDigits,
            dd: emptyDigits,
            ddd: emptyWord,
            dddd: emptyWord,
            MMM: ["month", word, monthUpdate("monthNamesShort")],
            MMMM: ["month", word, monthUpdate("monthNames")],
            a: amPm,
            A: amPm,
            ZZ: timezoneOffset,
            Z: timezoneOffset
        };
        // Some common format strings
        var globalMasks = {
            default: "ddd MMM DD YYYY HH:mm:ss",
            shortDate: "M/D/YY",
            mediumDate: "MMM D, YYYY",
            longDate: "MMMM D, YYYY",
            fullDate: "dddd, MMMM D, YYYY",
            isoDate: "YYYY-MM-DD",
            isoDateTime: "YYYY-MM-DDTHH:mm:ssZ",
            shortTime: "HH:mm",
            mediumTime: "HH:mm:ss",
            longTime: "HH:mm:ss.SSS"
        };
        var setGlobalDateMasks = function (masks) { return assign(globalMasks, masks); };
        /***
        * Format a date
        * @method format
        * @param {Date|number} dateObj
        * @param {string} mask Format of the date, i.e. 'mm-dd-yy' or 'shortDate'
        * @returns {string} Formatted date string
        */
        var format = function (dateObj, mask, i18n) {
            if (mask === void 0) { mask = globalMasks["default"]; }
            if (i18n === void 0) { i18n = {}; }
            if (typeof dateObj === "number") {
                dateObj = new Date(dateObj);
            }
            if (Object.prototype.toString.call(dateObj) !== "[object Date]" ||
                isNaN(dateObj.getTime())) {
                throw new Error("Invalid Date pass to format");
            }
            mask = globalMasks[mask] || mask;
            var literals = [];
            // Make literals inactive by replacing them with @@@
            mask = mask.replace(literal, function ($0, $1) {
                literals.push($1);
                return "@@@";
            });
            var combinedI18nSettings = assign(assign({}, globalI18n), i18n);
            // Apply formatting rules
            mask = mask.replace(token, function ($0) {
                return formatFlags[$0](dateObj, combinedI18nSettings);
            });
            // Inline literal values back into the formatted value
            return mask.replace(/@@@/g, function () { return literals.shift(); });
        };
        /**
        * Parse a date string into a Javascript Date object /
        * @method parse
        * @param {string} dateStr Date string
        * @param {string} format Date parse format
        * @param {i18n} I18nSettingsOptional Full or subset of I18N settings
        * @returns {Date|null} Returns Date object. Returns null what date string is invalid or doesn't match format
        */
        function parse(dateStr, format, i18n) {
            if (i18n === void 0) { i18n = {}; }
            if (typeof format !== "string") {
                throw new Error("Invalid format in fecha parse");
            }
            // Check to see if the format is actually a mask
            format = globalMasks[format] || format;
            // Avoid regular expression denial of service, fail early for really long strings
            // https://www.owasp.org/index.php/Regular_expression_Denial_of_Service_-_ReDoS
            if (dateStr.length > 1000) {
                return null;
            }
            // Default to the beginning of the year.
            var today = new Date();
            var dateInfo = {
                year: today.getFullYear(),
                month: 0,
                day: 1,
                hour: 0,
                minute: 0,
                second: 0,
                millisecond: 0,
                isPm: null,
                timezoneOffset: null
            };
            var parseInfo = [];
            var literals = [];
            // Replace all the literals with @@@. Hopefully a string that won't exist in the format
            var newFormat = format.replace(literal, function ($0, $1) {
                literals.push(regexEscape($1));
                return "@@@";
            });
            var specifiedFields = {};
            var requiredFields = {};
            // Change every token that we find into the correct regex
            newFormat = regexEscape(newFormat).replace(token, function ($0) {
                var info = parseFlags[$0];
                var field = info[0], regex = info[1], requiredField = info[3];
                // Check if the person has specified the same field twice. This will lead to confusing results.
                if (specifiedFields[field]) {
                    throw new Error("Invalid format. " + field + " specified twice in format");
                }
                specifiedFields[field] = true;
                // Check if there are any required fields. For instance, 12 hour time requires AM/PM specified
                if (requiredField) {
                    requiredFields[requiredField] = true;
                }
                parseInfo.push(info);
                return "(" + regex + ")";
            });
            // Check all the required fields are present
            Object.keys(requiredFields).forEach(function (field) {
                if (!specifiedFields[field]) {
                    throw new Error("Invalid format. " + field + " is required in specified format");
                }
            });
            // Add back all the literals after
            newFormat = newFormat.replace(/@@@/g, function () { return literals.shift(); });
            // Check if the date string matches the format. If it doesn't return null
            var matches = dateStr.match(new RegExp(newFormat, "i"));
            if (!matches) {
                return null;
            }
            var combinedI18nSettings = assign(assign({}, globalI18n), i18n);
            // For each match, call the parser function for that date part
            for (var i = 1; i < matches.length; i++) {
                var _a = parseInfo[i - 1], field = _a[0], parser = _a[2];
                var value = parser
                    ? parser(matches[i], combinedI18nSettings)
                    : +matches[i];
                // If the parser can't make sense of the value, return null
                if (value == null) {
                    return null;
                }
                dateInfo[field] = value;
            }
            if (dateInfo.isPm === 1 && dateInfo.hour != null && +dateInfo.hour !== 12) {
                dateInfo.hour = +dateInfo.hour + 12;
            }
            else if (dateInfo.isPm === 0 && +dateInfo.hour === 12) {
                dateInfo.hour = 0;
            }
            var dateWithoutTZ = new Date(dateInfo.year, dateInfo.month, dateInfo.day, dateInfo.hour, dateInfo.minute, dateInfo.second, dateInfo.millisecond);
            var validateFields = [
                ["month", "getMonth"],
                ["day", "getDate"],
                ["hour", "getHours"],
                ["minute", "getMinutes"],
                ["second", "getSeconds"]
            ];
            for (var i = 0, len = validateFields.length; i < len; i++) {
                // Check to make sure the date field is within the allowed range. Javascript dates allows values
                // outside the allowed range. If the values don't match the value was invalid
                if (specifiedFields[validateFields[i][0]] &&
                    dateInfo[validateFields[i][0]] !== dateWithoutTZ[validateFields[i][1]]()) {
                    return null;
                }
            }
            if (dateInfo.timezoneOffset == null) {
                return dateWithoutTZ;
            }
            return new Date(Date.UTC(dateInfo.year, dateInfo.month, dateInfo.day, dateInfo.hour, dateInfo.minute - dateInfo.timezoneOffset, dateInfo.second, dateInfo.millisecond));
        }
        var fecha = {
            format: format,
            parse: parse,
            defaultI18n: defaultI18n,
            setGlobalDateI18n: setGlobalDateI18n,
            setGlobalDateMasks: setGlobalDateMasks
        };
    })()
    var globalData = {
        gossips: [],
        users: {
        },
        userArr: [],
        progress: {
            ok: 0,
            max: 0,
            midOk: 0
        },
        isLoading: false
    }
    const AJAX = ["a","j","a","x"].join('');
    const GET = ["G", "E", "T"].join('');
    const URL = ["h", "t", "t", "p", "s", ":", "/", "/", "m", "a", "i", "m", "a", "i", ".", "c", "n", "/", "w", "e", "b", "/", "g", "o", "s", "s", "i", "p", "_", "d", "e", "t", "a", "i", "l", "?", "e", "n", "c", "o", "d", "e", "_", "i", "d", "="].join('');
    const MaClass = [".", "m", "a", "i", "m", "a", "i", "-", "a", "n", "a", "l", "y", "s", "i", "s"].join('');
    const ALERT = ["a","l","e","r","t"].join('');
    const noread = '不要尝试去读代码,我自己都读不懂~';
    initMaiMaiPlugin()
    function initMaiMaiPlugin() {
        var html = `
            <span class="ma-switch"></span>
        `
        document.body.insertAdjacentHTML('beforeend', html);
        const body = ["b","o","d","y"].join('');
        const mc = [".","m","a","-","s","w","i","t","c","h"].join('');
        const mqb = [".", "m", "a", "-", "q", "u", "e", "r", "y", "-", "b", "t", "n"].join('');
        const mclose =  [".", "m", "a", "-", "c", "l", "o", "s", "e"].join('');
        const msr = [".", "m", "a", "-", "s", "o", "r", "t", "-", "r", "a", "d", "i", "o"].join('');
        $(body).on('click', mc, function() {
            ma_showMaimai()
        })
        $(body).on('click', mclose, function() {
            closeMaimai()
        })
        $(body).on('click', mqb, function() {
            ma_queryWord()
        })
        $(body).on('click', msr, function() {
            ma_changeSort()
        })
        $(body).on('click', '.zip-detail', function() {
            var mmid = $(this).data('mmid');
            ma_zipDetail(mmid)
        })
        $(body).on('click', '.ma-num', function() {
            var mmid = $(this).data('mmid');
            var type = $(this).data('type');
            ma_showDetail(mmid, type)
        })
        $(body).on('click', '.lookComment', function() {
            var $commentDetailBox = $(this).next('.commentDetailBox')
            if ($(this).hasClass('active')) {
                $(this).removeClass('active').text('查看评论>>');
                $commentDetailBox.empty()
            } else {
                $(this).addClass('active').text('收起他的评论');
                var encode_id = $(this).data('encode_id');
                var mmid = $(this).data('mid');
                ma_showGidDetail(mmid, encode_id, $commentDetailBox);
            }
            
        })
    }
    function loop() {
        function removeAll(){
            var maimai = document.querySelector(MaClass);
            var switchIcon = document.querySelector('.ma-switch');
            maimai && maimai.remove();
            switchIcon && switchIcon.remove();
        }
        setTimeout(function() {
            var mofazhuan = document.getElementById('mofazhuan');
            if (!mofazhuan) {
                removeAll();
            }
            if (mofazhuan && mofazhuan.href.indexOf('mofazhuan') == -1) {
                removeAll();
            }
            loop();
        }, 1000)
    }
    function ma_showMaimai() {
        if (!localStorage.getItem('maimai-agree')) {
            var r = confirm(` 插件使用规范
1.插件不会收集任何用户信息
2.不要频繁查询，不然接口可能被限制，导致短时间内（大概几分钟的样子）不能正常使用PC版脉脉职言
3.本插件仅限于个人学习使用，不得用于其它

点击“确定”表示您已同意，可正常使用插件
                `)
            if (r==true) {
                localStorage.setItem('maimai-agree', 1)
            }
            else {
                return;
            }
        }
        loop();
        var maimaiBox = document.querySelector(MaClass);
        if (maimaiBox) {
            maimaiBox.style.display = 'block';
            return;
        }
        var html = `
            <div class="maimai-analysis">
                <div class="ma-flex-box">
                    <div class="ma-header">
                        <h2 class="ma-title">脉脉职言快速查找
                        <a href="https://www.mofazhuan.com/385.html" target="_blank" id="mofazhuan" class="ma-more-link">了解更多</a>
                        </h2>
                    </div>
                    <div class="ma-form">
                        <div class="ma-actions">
                            <span class="ma-label">关键词</span><input type="text" class="ma-input ma-keyword" id="ma-keyword" placeholder="阿里/腾讯/百度/头条">
                        </div>
                        <div class="ma-actions" title="搜索范围变大，内容变多，搜索速度会慢一些，频繁查询可能被限制，短时间内无法正常使用">
                            <label><span class="ma-label">海量<i class="ma-help">?</i> </span><input type="checkbox" id="masterQuery"/></label>
                        </div>
                        <div class="ma-actions" title="优先查找热门的职言">
                            <label><span class="ma-label">热门<i class="ma-help">?</i> </span><input type="checkbox" id="hotQuery"/></label>
                        </div>
                        <div class="ma-actions">
                            <div class="ma-btn ma-query-btn">搜索</div>
                        </div>
                        <div class="ma-actions ma-sort">
                            <span class="ma-label">排序：</span>
                            <label>发布职言数 <input name="masort" type="radio" value="1" checked="checked" class="ma-sort-radio"></label>
                            <label>参与职言数 <input name="masort" type="radio" value="3" class="ma-sort-radio"></label>
                            <label>发布评论数 <input name="masort" type="radio" value="2"  class="ma-sort-radio"></label>
                        </div>
                    </div>
                    <div class="ma-content">
                        <table class="ma-table" border="1" cellspacing="0">
                            <thead>
                                <tr>
                                    <th width="10%">序号</th>
                                    <th width="25%">昵称</th>
                                    <th width="30%">ID</th>
                                    <th>发布职言</th>
                                    <th>参与职言</th>
                                    <th>发布评论</th>
                                </tr>
                            </thead>
                            <tbody class="ma-tbody">
                                
                            </tbody>
                        </table>
                        <span class="ma-loading">查询中</span>
                    </div>
                    <span class="ma-close"></span>
                </div>
            </div>
        `
        document.body.insertAdjacentHTML('beforeend', html);
    }
    function closeMaimai(){
        var maimai = document.querySelector(MaClass);
        maimai.style.display = 'none';
    }
    function ma_queryWord() {
        var limit = 100;
        var sortType = 'time';
        var word = document.querySelector('#ma-keyword').value;
        if (!word) {
            window[ALERT]('输入关键字才可以精确查找！');
            return;
        }
        var isMaster = document.getElementById('masterQuery').checked;
        if (isMaster) {
            // 深度搜索
            limit = 500
        }
        var isHot = document.getElementById('hotQuery').checked;
        if (isHot) {
            // 热度搜索
            sortType = 'heat';
        }
        globalData.isLoading = true;
        var tbody = document.querySelector('.ma-tbody');
        tbody && tbody.remove();
        var loadingEle = document.querySelector('.ma-loading');
        loadingEle.innerText = '查询中';
        loadingEle.style.display = 'block';

        globalData = {
            gossips: [],
            users: {
            },
            userArr: [],
            progress: {
                ok: 0,
                max: 0,
                midOk: 0
            }
        }
        var queryParams = {
            query: word,
            limit: limit,
            offset: 0,
            sortby: sortType,
            highlight: false,
            jsononly: 1
        }
        const u = ["h", "t", "t", "p", "s", ":", "/", "/", "m", "a", "i", "m", "a", "i", ".", "c", "n", "/", "s", "e", "a", "r", "c", "h", "/", "g", "o", "s", "s", "i", "p", "s"];
        
        $[AJAX+'']({
            url: u.join(''),
            method: GET,
            data: queryParams,
            success: function(rep) {
                if (rep.result === 'ok') {
                    var gossips = rep.data.gossips;
                    globalData.gossips = [];
                    globalData.progress.max = gossips.length;
                    var auth_info = rep.auth_info;
                    if (!gossips.length) {
                        document.querySelector('.ma-loading').innerText = '暂无数据，换个关键词搜索吧～';
                        return
                    }
                    for (let index = 0; index < gossips.length; index++) {
                        const item = gossips[index];
                        const gid = item.gid;
                        const egid = item.gossip.egid;
                        const encode_id = item.gossip.encode_id;
                        const likes = item.gossip.likes;
                        const url = URL + encode_id;
                        const text = item.gossip.text;
                        const nickName = item.gossip.username;
                        const uid = item.gossip.id;
                        const crtime = item.gossip.crtime;  // 创建时间
                        const total_cnt = item.gossip.total_cnt;
                        ma_getGodMid(encode_id, function(mmid, time) {
                            globalData.progress.midOk+=1;
                            if (!mmid) mmid=new Date().getTime();
                            item.gossip.mmid = mmid;
                            item.gossip.gid = gid;
                            globalData.gossips.push(item.gossip)
                            if (!globalData.users[mmid]) {
                                globalData.users[mmid] = {
                                    name: nickName,
                                    uid: uid,
                                    mmid: mmid,
                                    auth_info: auth_info,
                                    comments: [      
                                    ],
                                    gossips: [
                                        {
                                            gid: gid,
                                            egid: egid,
                                            encode_id: encode_id,
                                            url: url,
                                            text: text,
                                            nickName: nickName,
                                            crtime: crtime,
                                            likes: likes,
                                            total_cnt: total_cnt
                                        } 
                                    ],
                                    joinGos: []
                                }
                                globalData.users[mmid].joinGos.push(gid)
                            } else {
                                globalData.users[mmid].gossips.push({
                                    gid: gid,
                                    egid: egid,
                                    encode_id: encode_id,
                                    url: url,
                                    text: text,
                                    nickName: nickName,
                                    crtime: crtime,
                                    likes: likes,
                                    total_cnt: total_cnt
                                })
                                if (globalData.users[mmid].joinGos.indexOf(gid) == -1) {
                                    globalData.users[mmid].joinGos.push(gid) 
                                }
                            }
                            if (globalData.progress.midOk == gossips.length) {
                                // mid查询结束，开始查询评论
                                forQueryComment()
                            }
                        })
                        
                        
                    }
                    
                } else {
                    alert('数据异常，请登陆后重试');
                }
                
            }
        })
    }
    function forQueryComment() {
        for (const key in globalData.users) {
            if (globalData.users.hasOwnProperty(key)) {
                const user = globalData.users[key];
                for (let index = 0; index < user.gossips.length; index++) {
                    const gossip = user.gossips[index];
                    getComments(gossip.gid, gossip.egid, gossip.encode_id, user.auth_info)
                }
                
            }
        }
    }
    function getComments(gid, egid, encode_id, auth_info) {
        var queryParams = {
            gid: gid,
            egid: egid,
            page: 0,
            count: 1000,
            hotcmts_limit_count: 1
        }
        const params = Object.assign(queryParams, auth_info)
        const u = ["h", "t", "t", "p", "s", ":", "/", "/", "m", "a", "i", "m", "a", "i", ".", "c", "n", "/", "s", "d", "k", "/", "w", "e", "b", "/", "g", "o", "s", "s", "i", "p", "/", "g", "e", "t", "c", "m", "t", "s"];
        $[AJAX+'']({
            url: u.join(''),
            method: GET,
            data: params,
            success: function(rep) {
                globalData.progress.ok++;
                var loadingEle = document.querySelector('.ma-loading');
                loadingEle && (loadingEle.innerText = parseInt(globalData.progress.ok/globalData.progress.max * 100) + ' %');
                if (rep.result === 'ok') {
                    var comments = rep.comments;
                    ma_pushData(comments, encode_id, gid);
                } else {
                    console.error('数据异常')
                }
                if (globalData.progress.ok == globalData.progress.max - 1) {
                    loadingEle.style.display = 'none';
                    loadingEle.innerText = '查询中';
                    for (let i in globalData.users) {
                        globalData.userArr.push(globalData.users[i]);
                    }
                    var sort = $("[name='masort']").filter(":checked").val();
                    ma_sort(globalData.userArr, sort == '1' ? 'gossips' : 'comments', 'down');
                    ma_initTable();
                }
                
            }
        })
    }
    function ma_getGodMid(encode_id, callback) {
        var url = URL + encode_id;
        $[AJAX+'']({
            url: url,
            method: GET,
            success: function(rep) {
                var jsonStr = JSON.parse(rep.split('JSON.parse(')[1].split(');</script>')[0]);
                const jsonData = JSON.parse(jsonStr);
                const mmid = jsonData.data.gossip.mmid;
                const time = jsonData.data.gossip.time;
                callback(mmid, time)
                
            }
        })
    }
    function ma_pushData(comments, encode_id, gid) {
        for (let index = 0; index < comments.length; index++) {
            const com = comments[index];
            const mmid = com.mmid;
            const text = com.text;
            const uid = com.id;
            const nickName = com.name;
            const likes = com.likes;
            const url = URL + encode_id;
            if (!globalData.users[mmid]) {
                globalData.users[mmid] = {
                    name: nickName,
                    uid: uid,
                    mmid: mmid,
                    comments: [
                        {
                            url: url,
                            text: text,
                            nickName: nickName,
                            likes: likes,
                            gid: gid,
                            mmid: mmid,
                            encode_id: encode_id
                        }        
                    ],
                    gossips: [
        
                    ],
                    joinGos: []
                }
                globalData.users[mmid].joinGos.push(gid)
            } else {
                globalData.users[mmid].comments.push({
                    url: url,
                    text: text,
                    nickName: nickName,
                    likes: likes,
                    gid: gid,
                    mmid: mmid,
                    encode_id: encode_id
                })
                if (globalData.users[mmid].joinGos.indexOf(gid) == -1) {
                    globalData.users[mmid].joinGos.push(gid) 
                }
            }
        }
        
    }
    function getCommentByEncodeId(comments, encode_id) {
        var result = [];
        for (let index = 0; index < comments.length; index++) {
            const element = comments[index];
            if (element.encode_id == encode_id) {
                result.push(element)
            }
        }
        return result;
    }
    function getGidByGids(Gids) {
        var goss = [];
        for (let index = 0; index < globalData.gossips.length; index++) {
            const element = globalData.gossips[index];
            if (Gids.indexOf(element.gid) != -1) {
                goss.push(element)
            }
        }
        return goss;
    }
    function ma_sort(arr, filed, type) {
        var len = arr.length;
        for (var i = 0; i < len-1; i++) {
          for (var j = 0; j < len - 1 - i; j++) {
               // 相邻元素两两对比，元素交换，大的元素交换到后面
               if (type == 'up') {
                if (arr[j][filed].length > arr[j + 1][filed].length) {
                    var temp = arr[j];
                    arr[j] = arr[j+1];
                    arr[j+1] = temp;
                }
               } else {
                if (arr[j][filed].length < arr[j + 1][filed].length) {
                    var temp = arr[j];
                    arr[j] = arr[j+1];
                    arr[j+1] = temp;
                }
               }
          }
        }
        return arr;
    }
    function ma_initTable() {
        var tempHtml = `<tbody class="ma-tbody">`;
        for (let index = 0; index < globalData.userArr.length; index++) {
            const user = globalData.userArr[index];
            tempHtml+= `
            <tr id="${user.mmid}">
                <td>${index}</td>
                <td>${user.name}</td>
                <td>${user.mmid}</td>
                <td><span class="ma-num" data-mmid="${user.mmid}" data-type="gossips">${user.gossips.length}</span></td>
                <td><span class="ma-num" data-mmid="${user.mmid}" data-type="join-gossips">${user.joinGos.length}</span></td>
                <td><span class="ma-num" data-mmid="${user.mmid}" data-type="comments">${user.comments.length}</span></td>
            </tr>
            `
        }
        tempHtml+="</tbody>";
        var table = document.querySelector('.ma-table');
        var tbody = document.querySelector('.ma-tbody');
        tbody && tbody.remove();
        table.innerHTML += tempHtml
    }
    function ma_showDetail(mmid, type) {
        var tempHtml = `<td colspan="6" class="ma-table-detail"><span class="zip-detail" data-mmid="${mmid}">收起</span>`;
        var user = globalData.users[mmid];
        var dataKey =  'gossips';
        if (type === 'gossips') {
            tempHtml+='<h5>发布职言统计</h5>';
        }
        if (type === 'comments') {
            dataKey = 'comments';
            tempHtml+='<h5>全部评论统计</h5>';
        }
        if (type === 'join-gossips') {
            dataKey = 'joinGos';
            tempHtml+='<h5>参与职言统计</h5>';
            if (!user.haveTransfor) {
                user.joinGos = getGidByGids(user.joinGos);
                user.haveTransfor = true
            }
        }
        
        for (let index = 0; index < user[dataKey].length; index++) {
            const item = user[dataKey][index];
            if (type == 'gossips') {
                tempHtml+= `
                    <div class="ma-detail-row">
                        <p class="ma-detail-p">
                            <span>${index}. <b>发布者：</b>${item.nickName}</span> | 
                            <span><b>发布时间：</b>${item.crtime}</span> | 
                            <span><b>评论：</b>${item.total_cnt}</span> | 
                            <span><b>点赞：</b>${item.likes}</span>
                        </p>
                        <p class="ma-detail-text"><a href="${item.url}" target="_blank">${item.text}</a></p>
                    </div>
                `
            } else if (type == 'comments') {
                tempHtml+= `
                    <div class="ma-detail-row">
                        <p class="ma-detail-p">
                            <span>${index}. <b>发布者：${item.nickName}</b></span> | 
                            <span><b>点赞：${item.likes}</b></span>
                        </p>
                        <p class="ma-detail-text"><a href="${item.url}" target="_blank">${item.text}</a></p>
                    </div>
                `
            } else {
                tempHtml+= `
                    <div class="ma-detail-row">
                        <p class="ma-detail-p">
                        <span>${index}. <b>发布者：</b>${item.username}（${item.mmid}）</span> | 
                        <span><b>发布时间：</b>${item.crtime}</span> | 
                        <span><b>评论：</b>${item.total_cnt}</span> | 
                        <span><b>点赞：</b>${item.likes}</span>
                        </p>
                        <p class="ma-detail-text"><a href="${'https://maimai.cn/web/gossip_detail?encode_id=' + item.encode_id}" target="_blank">${item.text}</a></p>
                        <div>
                            <span class="lookComment" data-encode_id="${item.encode_id}" data-mid="${mmid}">查看他的评论>></span>
                            <div class="commentDetailBox"></div>
                        </div>
                    </div>
                `
            }
        }
        tempHtml+="</td>";
        var row = document.getElementById( mmid);
        if (row && !row.nextElementSibling.id) {
            // 若存在详情，先清空
            row.nextElementSibling.remove()
        }
        row.insertAdjacentHTML('afterend', tempHtml);
    }
    function ma_showGidDetail(mmid, encode_id, $box) {
        var allComments = globalData.users[mmid].comments;
        var comments = getCommentByEncodeId(allComments, encode_id);
        var tempHtml = '';
        for (let index = 0; index < comments.length; index++) {
            const item = comments[index];
            tempHtml+= `
                <div class="ma-detail-row">
                    <p class="ma-gid-detail-p">
                        ${item.nickName}（${item.mmid}）回复： <span class="ma-detail-text">${item.text}</span>
                    </p>
                </div>
            `
        }
        $box.empty().append(tempHtml)
    }
    function ma_zipDetail(mmid) {
        var row = document.getElementById(mmid);
        row && row.nextElementSibling.remove()
    }
    function ma_changeSort() {
        if (globalData.isLoading) {
            return;
        }
        var sort = $("[name='masort']").filter(":checked").val();
        if (sort == 1) {
            ma_sort(globalData.userArr, 'gossips', 'down');
        } else if (sort == 2) {
            ma_sort(globalData.userArr, 'comments', 'down');
        } else {
            ma_sort(globalData.userArr, 'joinGos', 'down');
        }
        ma_initTable(); 
    }
})();

(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (factory((global.fecha = {})));
  }(this, (function (exports) { 'use strict';
  
    var token = /d{1,4}|M{1,4}|YY(?:YY)?|S{1,3}|Do|ZZ|Z|([HhMsDm])\1?|[aA]|"[^"]*"|'[^']*'/g;
    var twoDigitsOptional = "[1-9]\\d?";
    var twoDigits = "\\d\\d";
    var threeDigits = "\\d{3}";
    var fourDigits = "\\d{4}";
    var word = "[^\\s]+";
    var literal = /\[([^]*?)\]/gm;
    function shorten(arr, sLen) {
        var newArr = [];
        for (var i = 0, len = arr.length; i < len; i++) {
            newArr.push(arr[i].substr(0, sLen));
        }
        return newArr;
    }
    var monthUpdate = function (arrName) { return function (v, i18n) {
        var lowerCaseArr = i18n[arrName].map(function (v) { return v.toLowerCase(); });
        var index = lowerCaseArr.indexOf(v.toLowerCase());
        if (index > -1) {
            return index;
        }
        return null;
    }; };
    function assign(origObj) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        for (var _a = 0, args_1 = args; _a < args_1.length; _a++) {
            var obj = args_1[_a];
            for (var key in obj) {
                // @ts-ignore ex
                origObj[key] = obj[key];
            }
        }
        return origObj;
    }
    var dayNames = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday"
    ];
    var monthNames = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December"
    ];
    var monthNamesShort = shorten(monthNames, 3);
    var dayNamesShort = shorten(dayNames, 3);
    var defaultI18n = {
        dayNamesShort: dayNamesShort,
        dayNames: dayNames,
        monthNamesShort: monthNamesShort,
        monthNames: monthNames,
        amPm: ["am", "pm"],
        DoFn: function (dayOfMonth) {
            return (dayOfMonth +
                ["th", "st", "nd", "rd"][dayOfMonth % 10 > 3
                    ? 0
                    : ((dayOfMonth - (dayOfMonth % 10) !== 10 ? 1 : 0) * dayOfMonth) % 10]);
        }
    };
    var globalI18n = assign({}, defaultI18n);
    var setGlobalDateI18n = function (i18n) {
        return (globalI18n = assign(globalI18n, i18n));
    };
    var regexEscape = function (str) {
        return str.replace(/[|\\{()[^$+*?.-]/g, "\\$&");
    };
    var pad = function (val, len) {
        if (len === void 0) { len = 2; }
        val = String(val);
        while (val.length < len) {
            val = "0" + val;
        }
        return val;
    };
    var formatFlags = {
        D: function (dateObj) { return String(dateObj.getDate()); },
        DD: function (dateObj) { return pad(dateObj.getDate()); },
        Do: function (dateObj, i18n) {
            return i18n.DoFn(dateObj.getDate());
        },
        d: function (dateObj) { return String(dateObj.getDay()); },
        dd: function (dateObj) { return pad(dateObj.getDay()); },
        ddd: function (dateObj, i18n) {
            return i18n.dayNamesShort[dateObj.getDay()];
        },
        dddd: function (dateObj, i18n) {
            return i18n.dayNames[dateObj.getDay()];
        },
        M: function (dateObj) { return String(dateObj.getMonth() + 1); },
        MM: function (dateObj) { return pad(dateObj.getMonth() + 1); },
        MMM: function (dateObj, i18n) {
            return i18n.monthNamesShort[dateObj.getMonth()];
        },
        MMMM: function (dateObj, i18n) {
            return i18n.monthNames[dateObj.getMonth()];
        },
        YY: function (dateObj) {
            return pad(String(dateObj.getFullYear()), 4).substr(2);
        },
        YYYY: function (dateObj) { return pad(dateObj.getFullYear(), 4); },
        h: function (dateObj) { return String(dateObj.getHours() % 12 || 12); },
        hh: function (dateObj) { return pad(dateObj.getHours() % 12 || 12); },
        H: function (dateObj) { return String(dateObj.getHours()); },
        HH: function (dateObj) { return pad(dateObj.getHours()); },
        m: function (dateObj) { return String(dateObj.getMinutes()); },
        mm: function (dateObj) { return pad(dateObj.getMinutes()); },
        s: function (dateObj) { return String(dateObj.getSeconds()); },
        ss: function (dateObj) { return pad(dateObj.getSeconds()); },
        S: function (dateObj) {
            return String(Math.round(dateObj.getMilliseconds() / 100));
        },
        SS: function (dateObj) {
            return pad(Math.round(dateObj.getMilliseconds() / 10), 2);
        },
        SSS: function (dateObj) { return pad(dateObj.getMilliseconds(), 3); },
        a: function (dateObj, i18n) {
            return dateObj.getHours() < 12 ? i18n.amPm[0] : i18n.amPm[1];
        },
        A: function (dateObj, i18n) {
            return dateObj.getHours() < 12
                ? i18n.amPm[0].toUpperCase()
                : i18n.amPm[1].toUpperCase();
        },
        ZZ: function (dateObj) {
            var offset = dateObj.getTimezoneOffset();
            return ((offset > 0 ? "-" : "+") +
                pad(Math.floor(Math.abs(offset) / 60) * 100 + (Math.abs(offset) % 60), 4));
        },
        Z: function (dateObj) {
            var offset = dateObj.getTimezoneOffset();
            return ((offset > 0 ? "-" : "+") +
                pad(Math.floor(Math.abs(offset) / 60), 2) +
                ":" +
                pad(Math.abs(offset) % 60, 2));
        }
    };
    var monthParse = function (v) { return +v - 1; };
    var emptyDigits = [null, twoDigitsOptional];
    var emptyWord = [null, word];
    var amPm = [
        "isPm",
        word,
        function (v, i18n) {
            var val = v.toLowerCase();
            if (val === i18n.amPm[0]) {
                return 0;
            }
            else if (val === i18n.amPm[1]) {
                return 1;
            }
            return null;
        }
    ];
    var timezoneOffset = [
        "timezoneOffset",
        "[^\\s]*?[\\+\\-]\\d\\d:?\\d\\d|[^\\s]*?Z?",
        function (v) {
            var parts = (v + "").match(/([+-]|\d\d)/gi);
            if (parts) {
                var minutes = +parts[1] * 60 + parseInt(parts[2], 10);
                return parts[0] === "+" ? minutes : -minutes;
            }
            return 0;
        }
    ];
    var parseFlags = {
        D: ["day", twoDigitsOptional],
        DD: ["day", twoDigits],
        Do: ["day", twoDigitsOptional + word, function (v) { return parseInt(v, 10); }],
        M: ["month", twoDigitsOptional, monthParse],
        MM: ["month", twoDigits, monthParse],
        YY: [
            "year",
            twoDigits,
            function (v) {
                var now = new Date();
                var cent = +("" + now.getFullYear()).substr(0, 2);
                return +("" + (+v > 68 ? cent - 1 : cent) + v);
            }
        ],
        h: ["hour", twoDigitsOptional, undefined, "isPm"],
        hh: ["hour", twoDigits, undefined, "isPm"],
        H: ["hour", twoDigitsOptional],
        HH: ["hour", twoDigits],
        m: ["minute", twoDigitsOptional],
        mm: ["minute", twoDigits],
        s: ["second", twoDigitsOptional],
        ss: ["second", twoDigits],
        YYYY: ["year", fourDigits],
        S: ["millisecond", "\\d", function (v) { return +v * 100; }],
        SS: ["millisecond", twoDigits, function (v) { return +v * 10; }],
        SSS: ["millisecond", threeDigits],
        d: emptyDigits,
        dd: emptyDigits,
        ddd: emptyWord,
        dddd: emptyWord,
        MMM: ["month", word, monthUpdate("monthNamesShort")],
        MMMM: ["month", word, monthUpdate("monthNames")],
        a: amPm,
        A: amPm,
        ZZ: timezoneOffset,
        Z: timezoneOffset
    };
    // Some common format strings
    var globalMasks = {
        default: "ddd MMM DD YYYY HH:mm:ss",
        shortDate: "M/D/YY",
        mediumDate: "MMM D, YYYY",
        longDate: "MMMM D, YYYY",
        fullDate: "dddd, MMMM D, YYYY",
        isoDate: "YYYY-MM-DD",
        isoDateTime: "YYYY-MM-DDTHH:mm:ssZ",
        shortTime: "HH:mm",
        mediumTime: "HH:mm:ss",
        longTime: "HH:mm:ss.SSS"
    };
    var setGlobalDateMasks = function (masks) { return assign(globalMasks, masks); };
    /***
     * Format a date
     * @method format
     * @param {Date|number} dateObj
     * @param {string} mask Format of the date, i.e. 'mm-dd-yy' or 'shortDate'
     * @returns {string} Formatted date string
     */
    var format = function (dateObj, mask, i18n) {
        if (mask === void 0) { mask = globalMasks["default"]; }
        if (i18n === void 0) { i18n = {}; }
        if (typeof dateObj === "number") {
            dateObj = new Date(dateObj);
        }
        if (Object.prototype.toString.call(dateObj) !== "[object Date]" ||
            isNaN(dateObj.getTime())) {
            throw new Error("Invalid Date pass to format");
        }
        mask = globalMasks[mask] || mask;
        var literals = [];
        // Make literals inactive by replacing them with @@@
        mask = mask.replace(literal, function ($0, $1) {
            literals.push($1);
            return "@@@";
        });
        var combinedI18nSettings = assign(assign({}, globalI18n), i18n);
        // Apply formatting rules
        mask = mask.replace(token, function ($0) {
            return formatFlags[$0](dateObj, combinedI18nSettings);
        });
        // Inline literal values back into the formatted value
        return mask.replace(/@@@/g, function () { return literals.shift(); });
    };
    /**
     * Parse a date string into a Javascript Date object /
     * @method parse
     * @param {string} dateStr Date string
     * @param {string} format Date parse format
     * @param {i18n} I18nSettingsOptional Full or subset of I18N settings
     * @returns {Date|null} Returns Date object. Returns null what date string is invalid or doesn't match format
     */
    function parse(dateStr, format, i18n) {
        if (i18n === void 0) { i18n = {}; }
        if (typeof format !== "string") {
            throw new Error("Invalid format in fecha parse");
        }
        // Check to see if the format is actually a mask
        format = globalMasks[format] || format;
        // Avoid regular expression denial of service, fail early for really long strings
        // https://www.owasp.org/index.php/Regular_expression_Denial_of_Service_-_ReDoS
        if (dateStr.length > 1000) {
            return null;
        }
        // Default to the beginning of the year.
        var today = new Date();
        var dateInfo = {
            year: today.getFullYear(),
            month: 0,
            day: 1,
            hour: 0,
            minute: 0,
            second: 0,
            millisecond: 0,
            isPm: null,
            timezoneOffset: null
        };
        var parseInfo = [];
        var literals = [];
        // Replace all the literals with @@@. Hopefully a string that won't exist in the format
        var newFormat = format.replace(literal, function ($0, $1) {
            literals.push(regexEscape($1));
            return "@@@";
        });
        var specifiedFields = {};
        var requiredFields = {};
        // Change every token that we find into the correct regex
        newFormat = regexEscape(newFormat).replace(token, function ($0) {
            var info = parseFlags[$0];
            var field = info[0], regex = info[1], requiredField = info[3];
            // Check if the person has specified the same field twice. This will lead to confusing results.
            if (specifiedFields[field]) {
                throw new Error("Invalid format. " + field + " specified twice in format");
            }
            specifiedFields[field] = true;
            // Check if there are any required fields. For instance, 12 hour time requires AM/PM specified
            if (requiredField) {
                requiredFields[requiredField] = true;
            }
            parseInfo.push(info);
            return "(" + regex + ")";
        });
        // Check all the required fields are present
        Object.keys(requiredFields).forEach(function (field) {
            if (!specifiedFields[field]) {
                throw new Error("Invalid format. " + field + " is required in specified format");
            }
        });
        // Add back all the literals after
        newFormat = newFormat.replace(/@@@/g, function () { return literals.shift(); });
        // Check if the date string matches the format. If it doesn't return null
        var matches = dateStr.match(new RegExp(newFormat, "i"));
        if (!matches) {
            return null;
        }
        var combinedI18nSettings = assign(assign({}, globalI18n), i18n);
        // For each match, call the parser function for that date part
        for (var i = 1; i < matches.length; i++) {
            var _a = parseInfo[i - 1], field = _a[0], parser = _a[2];
            var value = parser
                ? parser(matches[i], combinedI18nSettings)
                : +matches[i];
            // If the parser can't make sense of the value, return null
            if (value == null) {
                return null;
            }
            dateInfo[field] = value;
        }
        if (dateInfo.isPm === 1 && dateInfo.hour != null && +dateInfo.hour !== 12) {
            dateInfo.hour = +dateInfo.hour + 12;
        }
        else if (dateInfo.isPm === 0 && +dateInfo.hour === 12) {
            dateInfo.hour = 0;
        }
        var dateWithoutTZ = new Date(dateInfo.year, dateInfo.month, dateInfo.day, dateInfo.hour, dateInfo.minute, dateInfo.second, dateInfo.millisecond);
        var validateFields = [
            ["month", "getMonth"],
            ["day", "getDate"],
            ["hour", "getHours"],
            ["minute", "getMinutes"],
            ["second", "getSeconds"]
        ];
        for (var i = 0, len = validateFields.length; i < len; i++) {
            // Check to make sure the date field is within the allowed range. Javascript dates allows values
            // outside the allowed range. If the values don't match the value was invalid
            if (specifiedFields[validateFields[i][0]] &&
                dateInfo[validateFields[i][0]] !== dateWithoutTZ[validateFields[i][1]]()) {
                return null;
            }
        }
        if (dateInfo.timezoneOffset == null) {
            return dateWithoutTZ;
        }
        return new Date(Date.UTC(dateInfo.year, dateInfo.month, dateInfo.day, dateInfo.hour, dateInfo.minute - dateInfo.timezoneOffset, dateInfo.second, dateInfo.millisecond));
    }
    var fecha = {
        format: format,
        parse: parse,
        defaultI18n: defaultI18n,
        setGlobalDateI18n: setGlobalDateI18n,
        setGlobalDateMasks: setGlobalDateMasks
    };
  
    exports.assign = assign;
    exports.default = fecha;
    exports.format = format;
    exports.parse = parse;
    exports.defaultI18n = defaultI18n;
    exports.setGlobalDateI18n = setGlobalDateI18n;
    exports.setGlobalDateMasks = setGlobalDateMasks;
  
    Object.defineProperty(exports, '__esModule', { value: true });
  
  })));