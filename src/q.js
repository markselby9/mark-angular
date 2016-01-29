/**
 * Created by fengchaoyi on 16/1/27.
 */
'use strict';
var _ = require('lodash');

function QFactory(callLater){   //difference between $q and $$q is method of callLater

    function Promise(){
        this.$$state = {};//save internal state
    }

    Promise.prototype.then = function(onFulfilled, onRejected, onProgress){
        var result = new Deferred();
        this.$$state.pending = this.$$state.pending || [];
        this.$$state.pending.push([result, onFulfilled, onRejected, onProgress]);
        if (this.$$state.status > 0){
            scheduleProcessQueue(this.$$state);
        }
        return result.promise;
    };

    // .catch is shortcut to promise.then(null, callback)
    Promise.prototype.catch = function(onRejected){
        return this.then(null, onRejected);
    };

    Promise.prototype.finally = function(final_callback, progressCallback){
        return this.then(function(value){
            //var callbackValue = final_callback();
            //if (callbackValue && callbackValue.then){
            //    return callbackValue.then(function(){
            //        return makePromise(value, true);
            //    });
            //}else{
            //    return value;//return the value given, ignore the fallback's return value
            //}
            return handleFinallyCallback(final_callback, value, true);
        }, function(rejection){
            return handleFinallyCallback(final_callback, rejection, false);
        }, progressCallback);
    };
    function makePromise(value, resolved){
        var d = new Deferred();
        if (resolved){
            d.resolve(value);
        }else{
            d.reject(value);
        }
        return d.promise;
    }
    function handleFinallyCallback(callback, value, resolved){
        var callbackValue = callback();
        if (callbackValue && callbackValue.then){
            return callbackValue.then(function(){
                return makePromise(value, resolved);
            });
        } else{
            return makePromise(value, resolved);
        }
    }

    function Deferred(){
        this.promise = new Promise();
    }

    Deferred.prototype.resolve = function(value){
        if (this.promise.$$state.status){
            return;
        }
        if (value && _.isFunction(value.then)){
            value.then(
                _.bind(this.resolve, this),
                _.bind(this.reject, this),
                _.bind(this.notify, this)
            );  //this resolve or reject will be called when that promise resolves
        } else {
            this.promise.$$state.value = value;
            this.promise.$$state.status = 1;    // status is "resolved"
            scheduleProcessQueue(this.promise.$$state);
        }
    };

    function scheduleProcessQueue(state){
        callLater(function(){
            processQueue(state);
        });
    }
    //invoke the callback
    function processQueue(state){
        var pending = state.pending;
        delete state.pending;
        _.forEach(pending, function(handlers){
            var deferred = handlers[0];
            var fn = handlers[state.status];
            try{
                if (_.isFunction(fn)){
                    deferred.resolve(fn(state.value));
                }
                else if (state.status == 1){
                    deferred.resolve((state.value));
                }else{
                    deferred.reject(state.value);
                }
            } catch (e){
                deferred.reject(e);
            }
        });
    }

    Deferred.prototype.reject = function(reason){
        if (this.promise.$$state.status){
            return;
        }
        this.promise.$$state.value = reason;
        this.promise.$$state.status = 2;//rejected
        scheduleProcessQueue(this.promise.$$state);
    };

    Deferred.prototype.notify = function(progress){
        var pending = this.promise.$$state.pending;
        if (pending && pending.length && !this.promise.$$state.status){
            callLater(function(){
                _.forEach(pending, function(handlers){
                    var deferred = handlers[0];
                    var progressBack = handlers[3];
                    try{
                        deferred.notify(_.isFunction(progressBack)?
                            progressBack(progress):progress);
                    }catch(e){
                        console.log(e);
                    }
                });
            });
        }
    };

    function defer(){
        return new Deferred();
    }

    function reject(rejection){
        var d = new Deferred();
        d.reject(rejection);
        return d.promise;
    }

    function when(value, callback, errback, progressBack){
        var d = new Deferred();
        d.resolve(value);
        return d.promise.then(callback, errback, progressBack);
    }

    function all(promises){
        var d = defer();
        var results = _.isArray(promises)?[]:{};
        var counter = 0;
        _.forEach(promises, function(promise, index){
            counter++;
            when(promise).then(function(value){
                results[index] = value;
                counter--;
                if (!counter){
                    d.resolve(results);
                }
            }, function(rejection){
                d.reject(rejection);
            });
        });
        if (!counter){
            d.resolve(results);
        }
        return d.promise;
    }

    var $Q = function Q(resolver){
        if (!_.isFunction(resolver)){
            throw 'expected function, got '+resolver;
        }
        var d = defer();
        resolver(_.bind(d.resolve, d), _.bind(d.reject, d));
        return d.promise;
    };
    return _.extend($Q, {
        defer: defer,
        reject: reject,
        when: when,
        resolve:when,
        all: all
    });
}

function $QProvider(){
    this.$get = ['$rootScope', function($rootScope){
        return QFactory(function(callback){
            $rootScope.$evalAsync(callback);
        })
    }];
}

function $$QProvider(){
    this.$get = function(){
        return QFactory(function(callback){
            setTimeout(callback, 0);
        })
    };
}
module.exports = {
    $QProvider: $QProvider,
    $$QProvider: $$QProvider
};