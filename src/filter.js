/**
 * Created by fengchaoyi on 15/12/7.
 */
'use strict';
var _ = require('lodash');

var filters = {};

function register(name, func){
    if (_.isObject(name)){
        return _.map(name, function(func, name){
            return register(name, func);
        });
    } else{
        var filter = func();
        filters[name] = filter;
        return filter;
    }
}

function filter(name){
    return filters[name];
}

register('filter', require('./filter_filter'));

module.exports = {
    register: register,
    filter: filter
};