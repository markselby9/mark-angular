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
    ngModule.provider('$q', require('./q').$QProvider);
    ngModule.provider('$$q', require('./q').$$QProvider);
    ngModule.provider('$http', require('./http').$HttpProvider);
    ngModule.provider('$httpParamSerializer', require('./http').$HttpParamSerializerProvider);
    ngModule.provider('$httpParamSerializerJQLike', require('./http').$HttpParamSerializerJQLikeProvider);
    ngModule.provider('$httpBackend', require('./http_backend'));
    ngModule.provider('$compile', require('./compile'));
    ngModule.provider('$controller', require('./controller'));
    ngModule.provider('$interpolate', require('./interpolate'));

    ngModule.directive('ngController', require('./directives/ng_controller'));
    ngModule.directive('ngTransclude', require('./directives/ng_transclude'));
    ngModule.directive('ngClick', require('./directives/ng_click'));
}
module.exports = publishExternalAPI;