'use strict';
var _ = require('lodash');

function $ControllerProvider() {
    var registered_controllers = {};
    var global_flag = false;    //global look up flag

    this.allowGlobals = function () {
        global_flag = true;
    };

    this.register = function (name, controller) {
        if (_.isObject(name)) {
            _.extend(registered_controllers, name);
        } else {
            registered_controllers[name] = controller;
        }
    };

    this.$get = ['$injector', function ($injector) {

        return function (ctrl, locals, later, identifier) {
            if (_.isString(ctrl)) {
                if (registered_controllers.hasOwnProperty(ctrl)) {
                    ctrl = registered_controllers[ctrl];
                } else if (global_flag) {
                    ctrl = window[ctrl];
                }
            }

            var instance;
            if (later) {
                var ctrlConstructor = _.isArray(ctrl)? _.last(ctrl):ctrl;
                instance = Object.create(ctrlConstructor.prototype);
                if (identifier){
                    addToScope(locals, identifier, instance);
                }
                return _.extend(function(){
                    $injector.invoke(ctrl, instance, locals);
                    return instance;
                }, {
                    instance: instance
                });
            } else {
                instance = $injector.instantiate(ctrl, locals);
                if (identifier) {
                    addToScope(locals, identifier, instance);
                }
                return instance;
            }
        };
    }];
}

// put the controller instance on the scope using the identifier
function addToScope(locals, identifier, instance) {
    if (locals && _.isObject(locals.$scope)) {
        locals.$scope[identifier] = instance;
    } else {
        throw 'can\'t export controller as ' + identifier + '!No $scope object provided via locals';
    }
}

module.exports = $ControllerProvider;