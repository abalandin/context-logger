var fs = require('fs');
var util = require('util');

var posix = require('posix');

(function () {
    "use strict";

    module.exports = Console;

    /**
     * create new logger
     * @param {string=""} grepTok
     * @constructor
     * @class
     */
    function Console(grepTok) {
        this.grepTok = grepTok || '';
        this.since = {};
    }

    /**
     * Constructs new Console instance.
     * logged messages will be prepended with this console' grepTok + specified token
     * @param {string=""} grepTok token to prepend messages with
     * @returns {Console} new Console
     * @this Console
     */
    Console.prototype.grep = function loggerGrep(grepTok) {
        //noinspection JSClosureCompilerSyntax
        return new Console(this.grepTok + (grepTok || ''));
    };

    /**
     * Checks weather specified method log messages or handler is an empty function
     * @param {string} method
     * @returns {boolean}
     */
    Console.prototype.is = function loggerIs(method) {
        return (this[method] !== emptyFunction);
    };

    function formatByUtilFormat(args) {
        var res;
        switch (args.length) {
            //faster?
        case 1:
            res = util.format.call(null, args[0]);
            break;
        case 2:
            res = util.format.call(null, args[0], args[1]);
            break;
        case 3:
            res = util.format.call(null, args[0], args[1], args[2]);
            break;
            //slower?
        default:
            res = util.format.apply(null, args);
        }
        return res.replace(/\r?\n/g, Console.lineBreakReplacement);
    }

    Console.prototype.trace = function () {
        var str = util.format.apply(null, arguments);
        this.error(str + '\n' + (new Error().stack));
    };

    Console.prototype.time = function (label) {
        this.since[label] = (new Date()).getTime();
    };

    Console.prototype.timeEnd = function (label, limit) {
        var now = (new Date()).getTime();
        var since = this.since[label];
        var diff = since ? now - since : -1;
        delete this.since[label];
        if (diff >= (limit || 0)) {
            this.debug('label="' + label.replace(/\s/g, '_') + '" time="' + diff + 'ms"');
        }
    };

    Console.prototype.trace = function () {};

    var console2syslog = {
        log :   'info',
        warn:   'warning',
        info:   'notice',
        debug:  'debug',
        error:  'err'
    }; // trace, time, timeEnd

    Console.lineBreakReplacement = '\n\t';

    Console.openlog = function (identity, facility) {
        Console.lineBreakReplacement = '\\\\\t';
        if (!identity) {
            var path = process.execPath;
            identity = path.substr(path.lastIndexOf('/') + 1);
        }
        posix.openlog(identity, {ndelay: true, cons: true}, facility || 'local7');
        Object.keys(console2syslog).forEach(function clo(method) {
            var prio = console2syslog[method];
            Console.prototype[method] = function () {
                var str = formatByUtilFormat(arguments);
                //noinspection JSPotentiallyInvalidUsageOfThis
                posix.syslog(prio, this.grepTok + ' ' + str);
                if (prio === 'err') {
                    global.console.error(str);
                }
            };
        });
    };

    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    Console.openStream = function (stream, methods) {
        if ('string' === typeof methods) {
            methods = [methods];
        }
        if ('string' === typeof stream) {
            stream = fs.createWriteStream(stream, {flags: 'a'});
        }

        methods.forEach(function (method) {
            Console.prototype[method] = function () {
                var now = new Date();
                //noinspection JSPotentiallyInvalidUsageOfThis
                stream.write(method +
                        '\t' + now.getDate() + months[now.getMonth()] +
                        ' ' + now.getHours() + ':' + now.getMinutes() + ':' + now.getSeconds() +
                        ' ' + this.grepTok + '\t' + formatByUtilFormat(arguments) + '\n');
            };
        });
    };

    Console.closelog = function () {
        posix.closelog();
    };

    /**
     *
     * @param {Array|string} methods
     */
    Console.ignoreMethods = function (methods) {
        if ('string' === typeof methods) {
            methods = [methods];
        }
        methods.forEach(function (method) {
            Console.prototype[method] = emptyFunction;
        });
    };

    function emptyFunction() {}

    Console.openStream(process.stdout, ['log', 'warn', 'info', 'debug']);
    Console.openStream(process.stderr, 'error');

}());
