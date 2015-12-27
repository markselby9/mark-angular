/**
 * Created by fengchaoyi on 15/12/17.
 */

'use strict';
var _ = require('lodash');
var FN_ARGS = /^function\s*[^\(]*\(\s*([^)]*)\)/m;  //reg expression
var FN_ARG = /^\s*(_?)(\S+?)\1\s*$/;
var STRIP_COMMENTS = /(\/\/.*$)|(\/\*.*?\*\/)/mg;    //? means lazy quantifier, g means multiple matches
var INSTANTIATING = {}; //marker value

function createInjector(modulesToLoad, strictDI){   //strict dependency injection mode
    var providerCache = {}; //for providers
    var providerInjector = createInternalInjector(providerCache, function(){
        throw 'Unknown provider: '+path.join(' <- ');
    });
    var instanceCache = {}; // for dependency instances
    var instanceInjector = createInternalInjector(instanceCache, function(name){
        var provider = providerInjector.get(name+'Provider');
        return instanceInjector.invoke(provider.$get, provider);
    });

    var loadedModules = {};
    var path = [];  // to record the circular dependency path
    strictDI = (strictDI === true); //must be true

    var $provide = {
        constant: function(key, value){
            if (key === 'hasOwnProperty'){
                throw 'hasOwnProperty is not a valid key for const';
            }
            providerCache[key] = value;
            instanceCache[key] = value;
        },
        provider: function(key, provider){
            if (_.isFunction(provider)){
                provider = providerInjector.instantiate(provider);
            }
            providerCache[key+'Provider'] = provider;
        }
    };

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


    // A cache to look up dependency, a factory function to fall back when no cache
    function createInternalInjector(cache, factoryFn){
        function getService(name){
            if (cache.hasOwnProperty(name)){
                if (cache[name] === INSTANTIATING) {
                    throw new Error('Circular dependency found: ' +
                        name+ ' <- ' + path.join(' <- '));
                    //print the circular path like a <- c <- b <- a
                }
                return cache[name];
            }
            else{
                path.unshift(name);
                cache[name] = INSTANTIATING;
                try{
                    return (cache[name] = factoryFn(name));
                } finally{
                    path.shift();
                    if (cache[name] === INSTANTIATING){
                        delete cache[name]; // not leave the marker if invocation fails
                    }
                }

            }
        }

        function invoke(fn, self, locals){  //self is the given context
            var args = _.map(annotate(fn), function(token){
                if (_.isString(token)){
                    return locals && locals.hasOwnProperty(token)?
                        locals[token]: getService(token);
                }else{
                    throw 'incorrect injecting token! '+token+ ' not a string!';
                }
            });
            if (_.isArray(fn)){
                fn = _.last(fn);
            }
            return fn.apply(self, args);
        }

        function instantiate(Type, locals){
            var UnwrappedType = _.isArray(Type)? _.last(Type):Type;
            var instance = Object.create(UnwrappedType.prototype);
            invoke(Type, instance, locals);
            return instance;
        }

        return {
            has: function(key){
                return cache.hasOwnProperty(key) ||
                    providerCache.hasOwnProperty(key+'Provider');
            },
            get: getService,
            invoke: invoke,
            annotate: annotate,
            instantiate: instantiate
        };
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

    return instanceInjector;
}

module.exports = createInjector;