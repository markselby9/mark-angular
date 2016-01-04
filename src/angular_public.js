/**
 * Created by fengchaoyi on 16/1/4.
 */
'use strict';
var setupModuleLoader = require('./loader');
function publishExternalAPI(){
    setupModuleLoader(window);

    var ngModule = window.angular.module('ng', []); //The ng module is where all the services, directives, filters, and other components provided by Angular itself will be
    ngModule.provider('$filter', require('./filter'));
    ngModule.provider('$parse', require('./parse'));
    ngModule.provider('$rootScope', require('./scope'));
}
module.exports = publishExternalAPI;