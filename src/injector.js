/**
 * Created by fengchaoyi on 15/12/17.
 */

'use strict';
var _ = require('lodash');

function createInjector(modulesToLoad){
    var cache = {};
    var loadedModules = {};

    var $provide = {
        constant: function(key, value){
            if (key === 'hasOwnProperty'){
                throw 'hasOwnProperty is not a valid key for const';
            }
            cache[key] = value;

        }
    };

    function invoke(fn, self, locals){  //self is the given context
        var args = _.map(fn.$inject, function(token){
            if (_.isString(token)){
                return locals && locals.hasOwnProperty(token)? locals[token]: cache[token];
            }else{
                throw 'incorrect injectiong token! '+token+ ' not a string!';
            }
        });
        return fn.apply(self, args);
    }

    function annotate(fn){
        return fn.$inject;
    }

    _.forEach(modulesToLoad, function loadModule(moduleName){
        if (!loadedModules.hasOwnProperty(moduleName)){
            loadedModules[moduleName] = true;
            var module = window.angular.module(moduleName);
            _.forEach(module.requires, loadModule);
            _.forEach(module._invokeQueue, function(invokeArgs){
                var method = invokeArgs[0];
                var args = invokeArgs[1];
                $provide[method].apply($provide, args);
            });
        }
    });
    return {
        has: function(key){
            return cache.hasOwnProperty(key);
        },
        get: function(key){
            return cache[key];
        },
        invoke: invoke,
        annotate: annotate
    };
}

module.exports = createInjector;