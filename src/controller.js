'use strict';
var _ = require('lodash');

function $ControllerProvider() {
    var registered_controllers = {};
    var global_flag = false;    //global look up flag

    this.allowGlobals = function(){
        global_flag = true;
    };

    this.register = function (name, controller) {
        if (_.isObject(name)){
            _.extend(registered_controllers, name);
        }else{
            registered_controllers[name] = controller;
        }
    };

    this.$get = ['$injector', function ($injector) {

        return function (ctrl, locals) {
            if (_.isString(ctrl)){
                if (registered_controllers.hasOwnProperty(ctrl)){
                    ctrl = registered_controllers[ctrl];
                }else if (global_flag){
                    ctrl = window[ctrl];
                }
            }
            return $injector.instantiate(ctrl, locals);
        };
    }];
}

module.exports = $ControllerProvider;