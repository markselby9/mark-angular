/**
 * Created by fengchaoyi on 16/2/28.
 */
'use strict';

var ngTranscludeDirective = function () {
    return {
        restrict: 'EAC',
        link: function (scope, element, attrs, ctrl, transclude) {
            transclude(function (clone) {
                element.empty();
                element.append(clone);
            });
        }
    };
};
module.exports = ngTranscludeDirective;