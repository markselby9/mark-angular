/**
 * Created by fengchaoyi on 15/12/17.
 */

'use strict';
var _ = require('lodash');
var FN_ARGS = /^function\s*[^\(]*\(\s*([^)]*)\)/m;  //reg expression
var FN_ARG = /^\s*(_?)(\S+?)\1\s*$/;
var STRIP_COMMENTS = /(\/\/.*$)|(\/\*.*?\*\/)/mg;    //? means lazy quantifier, g means multiple matches

function createInjector(modulesToLoad, strictDI){   //strict dependency injection mode
    var cache = {};
    var loadedModules = {};
    strictDI = (strictDI === true); //must be true

    var $provide = {
        constant: function(key, value){
            if (key === 'hasOwnProperty'){
                throw 'hasOwnProperty is not a valid key for const';
            }
            cache[key] = value;

        }
    };

    function invoke(fn, self, locals){  //self is the given context
        var args = _.map(annotate(fn), function(token){
            if (_.isString(token)){
                return locals && locals.hasOwnProperty(token)? locals[token]: cache[token];
            }else{
                throw 'incorrect injectiong token! '+token+ ' not a string!';
            }
        });
        if (_.isArray(fn)){
            fn = _.last(fn);
        }
        return fn.apply(self, args);
    }

    function annotate(fn){  //annotate an injected function
        if (_.isArray(fn)){
            return fn.slice(0, fn.length-1);    //remove the last item
        }else if (fn.$inject){
            return fn.$inject;
        }
        else if (!fn.length){
            return [];
        }
        else{ //if neither $inject nor array wrapping defined
            if (strictDI){
                throw 'fn is not using explicit annotation and cannot be invoked ' +
                'in strict mode';
            }
            var sourceStrippedComments = fn.toString().replace(STRIP_COMMENTS, '');//strip the comments in the function tostring
            var argDeclaration = sourceStrippedComments.match(FN_ARGS);
            var arg_arr = argDeclaration[1].split(',');
            return _.map(arg_arr, function(argName){
                return argName.match(FN_ARG)[2];
            });
        }
    }

    function instantiate(Type, locals){
        var UnwrappedType = _.isArray(Type)? _.last(Type):Type;
        var instance = Object.create(UnwrappedType.prototype);
        invoke(Type, instance, locals);
        return instance;
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
        annotate: annotate,
        instantiate: instantiate
    };
}

module.exports = createInjector;