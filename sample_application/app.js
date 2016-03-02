/**
 * Created by fengchaoyi on 16/3/2.
 */
angular.module('mark_angular_sample', [])
    .controller('MyController', function(){
        this.counter = 233;
        this.increase = function(){
            this.counter++;
        };
        this.decrease = function(){
            this.counter--;
        };
});