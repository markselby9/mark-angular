/**
 * Created by fengchaoyi on 16/3/2.
 */
'use strict';

function ngClickDirective(){
    return {
        restrict: 'A',
        link: function(scope, element, attrs){
            element.on('click', function(evt){
                scope.$eval(attrs.ngClick, {$event: evt});  //passing locals $event
                scope.$apply();
            });
        }
    };
}
module.exports = ngClickDirective;