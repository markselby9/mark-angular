/**
 * Created by fengchaoyi on 15/12/7.
 */
'use strict';
var _ = require('lodash');

function $FilterProvider($provide){
    var filters = {};

    this.register= function(name, func){
        if (_.isObject(name)){
            return _.map(name, function(func, name){
                return this.register(name, func);
            }, this);
        } else{
            //var filter = func();
            //filters[name] = filter;
            //return filter;
            return $provide.factory(name+'Filter', func);
        }
    };

    this.$get = ['$injector', function($injector){
        return function filter(name){
            return $injector.get(name+'Filter');
        };
    }];

    this.register('filter', require('./filter_filter'));
}
$FilterProvider.$inject = ['$provide'];

module.exports = $FilterProvider;
