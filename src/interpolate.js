/**
 * Created by fengchaoyi on 16/2/29.
 */
'use strict';
var _ = require('lodash');

function $InterpolateProvider() {
    var startSymbol = '{{';
    var endSymbol = '}}';

    this.startSymbol = function(value){
        if (value){
            startSymbol = value;
            return this;
        }else{
            return startSymbol;
        }
    };
    this.endSymbol = function(value){
        if (value){
            endSymbol = value;
            return this;
        }else{
            return endSymbol;
        }
    };

    this.$get = ['$parse', function ($parse) {
        var escapedStartMatcher = new RegExp(startSymbol.replace( /./g, escapeChar), 'g');
        var escapedEndMatcher = new RegExp(endSymbol.replace( /./g, escapeChar), 'g');
        function escapeChar(char){
            return '\\\\\\'+char;
        }
        //function unescapeText(text) {
        //    return text.replace(/\\{\\{/g, '{{').replace(/\\}\\}/g, '}}');
        //}
        function unescapeText(text){
            return text.replace(escapedStartMatcher, startSymbol).replace(escapedEndMatcher, endSymbol);
        }

        function $interpolate(text, mustHaveExpressions) {
            var index = 0;
            var parts = [];
            var expressions = [];
            var expressionFns = []; // collection of parsed expression functions
            var expressionPositions = [];   // collect array of each expression's position in parts array
            var hasExpressions = false;
            var startIndex, endIndex;
            var exp, expFn;
            while (index < text.length) {
                startIndex = text.indexOf(startSymbol, index);
                if (startIndex !== -1) {
                    endIndex = text.indexOf(endSymbol, startIndex + endSymbol.length);
                }
                if (startIndex !== -1 && endIndex !== -1) {
                    if (startIndex !== index) {
                        // static text
                        parts.push(unescapeText(text.substring(index, startIndex)));
                    }
                    exp = text.substring(startIndex + startSymbol.length, endIndex);
                    expFn = $parse(exp);
                    hasExpressions = true;
                    expressions.push(exp);
                    expressionFns.push(expFn);
                    expressionPositions.push(parts.length);
                    parts.push(expFn);
                    index = endIndex + endSymbol.length;
                } else {
                    parts.push(unescapeText(text.substring(index)));
                    break;
                }
            }


            function stringify(value) {
                if (_.isNull(value) || _.isUndefined(value)) {
                    return '';
                } else if (_.isObject(value)) {
                    return JSON.stringify(value);
                } else {
                    return '' + value;
                }
            }

            if (expressions.length || !mustHaveExpressions) {
                // return interpolation function
                return _.extend(function interpolateFn(context) {
                    var values = _.map(expressionFns, function (expressionFn) {
                        return expressionFn(context);
                    });
                    return compute(values);
                }, {
                    // use _.extend to attach
                    expressions: expressions,
                    $$watchDelegate: function (scope, listener) {
                        var lastValue;

                        // optimization by using watch delegate
                        return scope.$watchGroup(expressionFns, function (newValues, oldValues) {
                            var newValue = compute(newValues);
                            listener(newValue,
                                (newValues === oldValues ? newValue : lastValue),
                                scope);
                            lastValue = newValue;
                        });
                    }
                });
            }

            function compute(values) {
                //wraps the reduction logic of context object
                // receive the array of precomputed values
                _.forEach(values, function (value, i) {
                    parts[expressionPositions[i]] = stringify(value);
                });
                return parts.join('');
            }
        }

        $interpolate.startSymbol = _.constant(startSymbol);
        $interpolate.endSymbol = _.constant(endSymbol);

        return $interpolate;
    }];
}
module.exports = $InterpolateProvider;
