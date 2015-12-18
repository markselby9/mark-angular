'use strict';

function setupModuleLoader(){
    var ensure = function(obj, name, factory){
        return obj[name] || (obj[name] = factory()); //load once pattern
    };
    var angular = ensure(window, 'angular', Object);

    var createModule = function(moduleName, moduleDepedencies, modules){
        if (moduleName === 'hasOwnProperty'){
            throw 'hasOwnProperty is not a valid module name';
        }
        var invokeQueue = [];
        var moduleInstance = {
            name: moduleName,
            requires: moduleDepedencies,
            constant: function(key, value){
                invokeQueue.push(['constant', [key, value]]);
            },
            _invokeQueue: invokeQueue

        };
        modules[moduleName] = moduleInstance;
        return moduleInstance;
    };
    var getModule = function(name, modules){
        if (modules.hasOwnProperty(name)){
            return modules[name];
        }else{
            throw 'Module ' + name + ' is not available!';
        }
    };
    var module = ensure(angular, 'module', function(){
        var modules = {};
        return function(name, requires){
            if (requires){
                return createModule(name, requires, modules);
            }else{
                return getModule(name, modules);
            }
        }
    });
}

module.exports = setupModuleLoader;