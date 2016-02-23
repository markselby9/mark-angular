/**
 * Created by fengchaoyi on 16/2/23.
 */
'use strict';

var ngControllerDirective = function(){
    return {
        restrict: 'A',
        scope: true,
        controller: '@'
    };
};

module.exports = ngControllerDirective;