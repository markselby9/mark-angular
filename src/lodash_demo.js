var _ = require('lodash');
var resultSet = {};
var object = {'a': 1, 'b': 2, 'c': 1};
//_.transform({'a': 1, 'b': 2, 'c': 1}, function (result, value, key) {
//    (result[value] || (result[value] = [])).push(key);
//    console.log(result, value, key);
//}, resultSet);
//console.log(resultSet);

_.forEach(object, function(value, key){
    console.log('key:', key);
    console.log('value:', value);
});