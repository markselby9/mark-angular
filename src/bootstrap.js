/**
 * Created by fengchaoyi on 16/3/2.
 */
'use strict';

var $ = require('jquery');
var _ = require('lodash');
var publishExternalAPI = require('./angular_public');
var createInjector = require('./injector');

publishExternalAPI();

window.angular.bootstrap = function(element, modules, config){
    var $element = $(element);
    modules = modules || [];
    config = config || {};
    modules.unshift(['$provide', function($provide){
        $provide.value('$rootElement', $element);   // this module registers $rootElement as a value
    }]);
    modules.unshift('ng');  //prepend ng module
    var injector = createInjector(modules, config.strictDi);
    $element.data('$injector', injector);
    injector.invoke(['$compile', '$rootScope', function($compile, $rootScope){
        $rootScope.$apply(function(){   // ensures a digest happens
            $compile($element)($rootScope); //compile and link
        });
    }]);

    return injector;
};

// auto bootstrap
var ngAttrPrefixes = ['ng-', 'data-ng', 'ng:', 'x-ng-'];
$(document).ready(function(){
    var foundAppElement, foundModule, config={};
    _.forEach(ngAttrPrefixes, function(prefix){
        var attrName = prefix+'app';
        var selector = '['+attrName.replace(':', '\\:') + ']';  //select elements with corresponding attribute
        var element;
        if (!foundAppElement && (element = document.querySelector(selector))){
            foundAppElement = element;
            foundModule = element.getAttribute(attrName);
        }
    });
    if (foundAppElement){
        //strictDI attribute?
        config.strictDi = _.any(ngAttrPrefixes, function(prefix){
            var attrName = prefix+'strict-di';
            return foundAppElement.hasAttribute(attrName);
        });
        window.angular.bootstrap(foundAppElement, foundModule?[foundModule]:[], config);
    }
});