/**
 * Created by fengchaoyi on 15/11/10.
 */
'use strict';

var _ = require('lodash');

function Scope(){
    this.$$watchers = [];
    this.$$lastDirtyWatch = null; //keep track of last dirty watch
    this.$$asyncQueue = [];
    this.$$phase = null;
    this.$$applyAsyncQueue = [];
    this.$$applyAsyncId = null;
    this.$$postDigestQueue = [];
}

Scope.prototype.$watch = function(watchFn, listenerFn, valueEq){
    var self = this;
    var watcher = {
        watchFn: watchFn,
        listenerFn: listenerFn || function(){}, //in case the listener function not exist
        valueEq: !!valueEq,     // if valueEq===undefined, !!valueEq will be false
        last: initWatchVal
    };
    this.$$watchers.unshift(watcher);
    this.$$lastDirtyWatch = null; //resetting last dirty watch
    return function(){
        var index = self.$$watchers.indexOf(watcher);
        if (index>=0){
            self.$$watchers.splice(index, 1);
            self.$$lastDirtyWatch = null;
        }
    };
};

Scope.prototype.$digestOnce = function () {
    var self = this;
    var newValue, oldValue, dirty;
    //iterate over all watchers in the scope
    _.forEachRight(this.$$watchers, function (watcher) {
        try{
            if (watcher){
                newValue = watcher.watchFn(self);
                oldValue = watcher.last;
                //if (newValue !== oldValue){
                if (!self.$$areEqual(newValue, oldValue, watcher.valueEq)){
                    self.$$lastDirtyWatch = watcher;
                    //watcher.last = newValue;
                    watcher.last = (watcher.valueEq? _.cloneDeep(newValue):newValue);
                    watcher.listenerFn(newValue, oldValue==initWatchVal? newValue: oldValue, self);
                    dirty = true;
                } else if (self.$$lastDirtyWatch === watcher){
                    return false;   // won't have any dirty watches this time
                }
            }
        } catch(e){
            console.error(e);
        }
    });
    return dirty;
};

function initWatchVal(){}

// run all watchers at least once
Scope.prototype.$digest = function(){
    var ttl = 10;
    var dirty;
    this.$$lastDirtyWatch = null;
    this.$beginPhase('$digest');

    if (this.$$applyAsyncId){
        clearTimeout(this.$$applyAsyncId);
        this.$$flushApplyAsync();
    }

    do{ //Outer loop, run when changes keep occurring
        //evalAsync
        while (this.$$asyncQueue.length){
            try{
                var asyncTask = this.$$asyncQueue.shift();
                this.$eval(asyncTask.expression);
            } catch (e){
                console.error(e);
            }
        }
        dirty = this.$digestOnce();
        if ((dirty || this.$$asyncQueue.length) && !(ttl--)){
            this.$clearPhase();
            throw "10 digest iterations reached";
        }
    } while (dirty || this.$$asyncQueue.length);
    this.$clearPhase();

    while (this.$$postDigestQueue.length){
        try{
            this.$$postDigestQueue.shift()();
        } catch (e){
            console.error(e);
        }
    }
};

Scope.prototype.$$areEqual = function(newValue, oldValue, valueEq){
    if (valueEq){
        return _.isEqual(newValue, oldValue);
    } else{
        return oldValue===newValue || (typeof newValue === 'number' && typeof oldValue === 'number' && isNaN(newValue) && isNaN(oldValue));
    }

};

Scope.prototype.$eval = function(func, locals){
    return func(this, locals);
};

Scope.prototype.$apply = function(expr){
    try{
        this.$beginPhase('$apply');
        return this.$eval(expr);
    }finally{
        this.$clearPhase();
        this.$digest();
    }
};

Scope.prototype.$evalAsync = function(expr){
    var self = this;
    if (!self.$$phase && !self.$$asyncQueue.length){
        setTimeout(function(){
            if (self.$$asyncQueue.length){
                self.$digest();
            }
        }, 0);  // a digest will happen in the near future
    }
    this.$$asyncQueue.push({scope: this, expression: expr});
};


Scope.prototype.$beginPhase = function(phase){
    if (this.$$phase){
        throw this.$$phase+'already a phase in process.';
    }
    else{
        this.$$phase = phase;
    }
};

Scope.prototype.$clearPhase = function(){
    this.$$phase = null;
};

Scope.prototype.$applyAsync = function(expr) {
    var self = this;
    self.$$applyAsyncQueue.push(function() {
        self.$eval(expr);
    });
    if (self.$$applyAsyncId === null) {
        self.$$applyAsyncId = setTimeout(function() {
            self.$apply(_.bind(self.$$flushApplyAsync, self));
        }, 0);
    }
};

Scope.prototype.$$flushApplyAsync = function(){
    while (this.$$applyAsyncQueue.length){
        try{
            this.$$applyAsyncQueue.shift()();
        } catch (e){
            console.error(e);
        }
    }
    this.$$applyAsyncId = null;
};

Scope.prototype.$$postDigest = function(func){
    this.$$postDigestQueue.push(func);
};

Scope.prototype.$watchGroup = function(watchFuncs, listenerFuncs){
    var self = this;
    var newValueArray = new Array(watchFuncs.length);
    var oldValueArray = new Array(watchFuncs.length);

    var changeReactionScheduled = false;
    var firstRun = true;

    if (watchFuncs.length===0){
        var shouldCall = true;
        self.$evalAsync(function(){
            if (shouldCall){
                listenerFuncs(newValueArray, oldValueArray, self);
            }
        });
        return function(){
            shouldCall = false;
        };
    }
    function watchGroupListener(){
        if (firstRun){
            firstRun = false;
            listenerFuncs(newValueArray, newValueArray, self);
        }else{
            listenerFuncs(newValueArray, oldValueArray, self);
        }
        changeReactionScheduled = false;
    }

    var destroyFunctions = _.map(watchFuncs, function(watchFunction, i){
        return self.$watch(watchFunction, function(newValue, oldValue){
            newValueArray[i] = newValue;
            oldValueArray[i] = oldValue;
            //listenerFunc(newValue, oldValue, self);
            if (!changeReactionScheduled){
                changeReactionScheduled = true;
                self.$evalAsync(watchGroupListener);
            }
        });
    });

    return function(){
        _.forEach(destroyFunctions, function(destroyFunction){
            destroyFunction();
        });
    };
};

module.exports = Scope;