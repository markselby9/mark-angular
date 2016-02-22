/**
 * Created by fengchaoyi on 16/2/22.
 */
var regex = /^(\^\^?)?(\?)?(\^\^?)?/;
var str = "^^?helloworld";
var _ = require('lodash');

var match = str.match(regex);
_.forEach(match, function(item, index){
    console.log(index+' '+item);
});