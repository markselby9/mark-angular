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

    this.$$children = [];
    this.$root = this;
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
    //this.$$lastDirtyWatch = null; //resetting last dirty watch
    this.$root.$$lastDirtyWatch = null;
    return function(){
        var index = self.$$watchers.indexOf(watcher);
        if (index>=0){
            self.$$watchers.splice(index, 1);
            //self.$$lastDirtyWatch = null;
            self.$root.$$lastDirtyWatch = null;
        }
    };
};

Scope.prototype.$$digestOnce = function () {
    var self = this;
    var dirty;
    var continueLoop = true;
    //iterate over all watchers in the scope

    this.$$everyScope(function(scope){
        var newValue, oldValue;
        _.forEachRight(scope.$$watchers, function (watcher) { //scope.$$watchers
            try{
                if (watcher){
                    newValue = watcher.watchFn(scope);
                    oldValue = watcher.last;
                    //if (newValue !== oldValue){
                    if (!scope.$$areEqual(newValue, oldValue, watcher.valueEq)){
                        scope.$root.$$lastDirtyWatch = watcher;
                        //watcher.last = newValue;
                        watcher.last = (watcher.valueEq? _.cloneDeep(newValue):newValue);
                        watcher.listenerFn(newValue, oldValue==initWatchVal? newValue: oldValue, scope);
                        dirty = true;
                    } else if (scope.$root.$$lastDirtyWatch === watcher){
                        continueLoop = false;
                        return false;   // won't have any dirty watches this time
                    }
                }
            } catch(e){
                console.error(e);
            }
        });
        return continueLoop;
    });

    return dirty;
};

function initWatchVal(){}

// run all watchers at least once
Scope.prototype.$digest = function(){
    var ttl = 10;
    var dirty;
    //this.$$lastDirtyWatch = null;
    this.$root.$$lastDirtyWatch = null;
    this.$beginPhase('$digest');

    if (this.$root.$$applyAsyncId){
        clearTimeout(this.$root.$$applyAsyncId);
        this.$$flushApplyAsync();
    }

    do{ //Outer loop, run when changes keep occurring
        //evalAsync
        while (this.$$asyncQueue.length){
            try{
                var asyncTask = this.$$asyncQueue.shift();
                asyncTask.scope.$eval(asyncTask.expression);    //asyncTask.scope.$eval
            } catch (e){
                console.error(e);
            }
        }
        dirty = this.$$digestOnce();
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
        //this.$digest();
        this.$root.$digest();
    }
};

Scope.prototype.$evalAsync = function(expr){
    var self = this;
    if (!self.$$phase && !self.$$asyncQueue.length){
        setTimeout(function(){
            if (self.$$asyncQueue.length){
                //self.$digest();
                self.$root.$digest();
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
    if (self.$root.$$applyAsyncId === null) {
        self.$root.$$applyAsyncId = setTimeout(function() {
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
    this.$root.$$applyAsyncId = null;
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

//Inheritance
Scope.prototype.$new = function(isolated, parent){
    var child;
    parent = parent || this;
    if (isolated){
        child = new Scope();
        child.$root = parent.$root;
        child.$$asyncQueue = parent.$$asyncQueue;
        child.$$postDigestQueue = parent.$$postDigestQueue; //share the same instance
        child.$$applyAsyncQueue = parent.$$applyAsyncQueue;
    }else{
        var ChildScape = function(){};
        ChildScape.prototype = this;
        child = new ChildScape();
    }
    parent.$$children.push(child);
    //var child = Object.create(this);
    child.$$watchers = [];
    child.$$children = [];
    child.$parent = parent;
    return child;
};

Scope.prototype.$$everyScope = function(fn){
    if (fn(this)){
        return this.$$children.every(function(child){
            return child.$$everyScope(fn); //recursively invoke fn on child
        });
    }else{
        return false;
    }
};

Scope.prototype.$destroy = function(){
    if (this.$parent){
        var siblings = this.$parent.$$children;
        var indexOfThis = siblings.indexOf(this);
        if (indexOfThis > 0){
            siblings.splice(indexOfThis, 1);
        }
    }
    this.$$watchers = null;
};

//watching collections
Scope.prototype.$watchCollection = function(watchFn, listenerFn){
    var self = this;
    var oldValue, newValue;
    var oldLength; //old object's length
    var veryOldValue; //keep track of the old value instead of being identical to new value
    var trackVeryOldValue = (listenerFn.length > 1); //whether we need to keep the very old value
    var firstRun = true;
    var changeCount = 0;
    var internalWatchFn = function(scope) {
        newValue = watchFn(scope);
        var newLength; //new object's length
        //check for changes
        if (_.isObject(newValue)) {
            if (isArrayLike(newValue)) {
                if (!_.isArray(oldValue)) {
                    changeCount++;
                    oldValue = [];
                }
                if (newValue.length !== oldValue.length) {
                    changeCount++;
                    oldValue.length = newValue.length;
                }
                _.forEach(newValue, function (newItem, i) {
                    var bothNaN = _.isNaN(newItem) && _.isNaN(oldValue[i]); //both values are NaN
                    if (!bothNaN && newItem !== oldValue[i]) {
                        changeCount++;
                        oldValue[i] = newItem;
                    }
                });
            } else {
                if (!_.isObject(oldValue) || isArrayLike(oldValue)){
                    changeCount++;
                    oldValue = {};
                    oldLength = 0;
                }
                newLength = 0;
                _.forOwn(newValue, function(newVal, key){
                    newLength++;
                    if (oldValue.hasOwnProperty(key)){
                        var bothNaN = _.isNaN(oldValue[key]) && _.isNaN(newVal);
                        if (oldValue[key] !== newVal && !bothNaN){
                            changeCount++;
                            oldValue[key] = newVal;
                        }
                    } else{
                        changeCount++;
                        oldLength++;
                        oldValue[key] = newVal;
                    }

                });
                if (oldLength>newLength){
                    changeCount++;
                    _.forOwn(oldValue, function(oldVal, key){
                        if (!newValue.hasOwnProperty(key)){
                            //changeCount++;
                            oldLength--;
                            delete oldValue[key];
                        }
                    });
                }

            }
        }
        else{
            if (!self.$$areEqual(newValue, oldValue, false)) {
                changeCount += 1;
            }
            oldValue = newValue;
        }

        return changeCount;
    };
    var internalListenerFn = function(){
        if (firstRun){
            listenerFn(newValue, oldValue, self);
            firstRun = false;
        }
        else{
            listenerFn(newValue, veryOldValue, self);
        }
        if (trackVeryOldValue){
            veryOldValue = _.clone(newValue);
        }
    };
    return this.$watch(internalWatchFn, internalListenerFn);
};

//for array-like objects, for example node list or parameters
function isArrayLike(obj){
    if (_.isNull(obj)||_.isUndefined(obj)){
        return false;
    }
    var length = obj.length;
    //return _.isNumber(length);
    return length===0 || (_.isNumber(length) && length>0 && (length-1) in obj);
}

module.exports = Scope;