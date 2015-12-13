/**
 * Created by fengchaoyi on 15/12/11.
 */
'use strict';
var _ = require('lodash');

function filterFilter(){
    return function(array, filterExpr, comparator){
        var predicateFn;
        if (_.isFunction(filterExpr)){
            return _.filter(array, filterExpr);
        }
        else if (_.isString(filterExpr) || _.isNumber(filterExpr) || _.isBoolean(filterExpr) || _.isNull(filterExpr) || _.isObject(filterExpr)){
            predicateFn = createPredicateFn(filterExpr, comparator);
        }else{
            return array;
        }
        return _.filter(array, predicateFn);
    };
}

function createPredicateFn(expression, comparator){
    var shouldMatchPrimitives = _.isObject(expression) && ('$' in expression);
    if (comparator == true){
        comparator = _.isEqual;
    }
    else if (!_.isFunction(comparator)){
        comparator = function comparator(actual, expected){
            if (_.isUndefined(actual)){ //undefined never passes the filter
                return false;
            }
            if (_.isNull(actual) || _.isNull(expected)){
                return actual===expected;
            }
            actual = (''+actual).toLowerCase();
            expected = (''+expected).toLowerCase();
            return actual.indexOf(expected) !== -1; //substring
        };
    }

    return function predicateFn(item){
        if (shouldMatchPrimitives && !_.isObject(item)){
            return deepCompare(item, expression.$, comparator);  //use expression's $ property
        }
        return deepCompare(item, expression, comparator, true);
    };
}

function deepCompare(actual, expected, comparator, matchAnyProperty, inWildCard){ // deep compare, concerning object
    if (_.isString(expected) && _.startsWith(expected, '!')){
        return !deepCompare(actual, expected.substring(1), comparator, matchAnyProperty);
    }
    if (_.isArray(actual)){
        return _.any(actual, function(actualItem){
            return deepCompare(actualItem, expected, comparator, matchAnyProperty);
        });
    }
    if (_.isObject(actual)) {
        if (_.isObject(expected) && !inWildCard){
            return _.every(
                _.toPlainObject(expected),  // in case it uses a prototype inheritance
                function(expectedValue, expectedKey){   //??
                    if (_.isUndefined(expectedValue)){
                        return true;
                    }
                    var isWildcard = (expectedKey === '$');
                    var actualValue = isWildcard?actual:actual[expectedKey];
                    return deepCompare(actualValue, expectedValue, comparator, isWildcard, isWildcard);
                }
            );
        }else if (matchAnyProperty){
            return _.some(actual, function(value, key){  //Checks if predicate returns truthy for any element of collection
                return deepCompare(value, expected, comparator, matchAnyProperty);
            });
        }else{
            return comparator(actual, expected);
        }
    }else{
        return comparator(actual, expected);
    }
}


module.exports = filterFilter;