'use strict';
var _ = require('lodash');
var $ = require('jquery');

var PREFIX_REGEXP = /(x[\:\-_]|data[\:\-_])/i;

//standard boolean attribute names
var BOOLEAN_ATTRS = {
    multiple: true,
    selected: true,
    checked: true,
    disabled: true,
    readOnly: true,
    required: true,
    open: true
};

//element name we want to watch
var BOOLEAN_ELEMENTS = {
    INPUT: true,
    SELECT: true,
    OPTION: true,
    TEXTAREA: true,
    BUTTON: true,
    FORM: true,
    DETAILS: true
};

// handling the prefix matching of DOM element name
function directiveNormalize(name) {
    return _.camelCase(name.replace(PREFIX_REGEXP, ''));//remove the prefix, camel case the name
}

function parseIsolateBindings(scope) {
    var bindings = {};
    _.forEach(scope, function (definition, scopeName) {
        var match = definition.match(/\s*([@&]|=(\*?))(\??)\s*(\w*)\s*/);
        bindings[scopeName] = {
            mode: match[1][0],
            collection: match[2] === '*',
            optional: match[3],
            attrName: match[4] || scopeName
        };
    });
    return bindings;
}

function parseDirectiveBindings(directive) {
    var bindings = {};
    if (_.isObject(directive.scope)) {
        if (directive.bindToController) {
            bindings.bindToController = parseIsolateBindings(directive.scope);
        } else {
            bindings.isolateScope = parseIsolateBindings(directive.scope);
        }
    }
    if (_.isObject(directive.bindToController)) {
        bindings.bindToController = parseIsolateBindings(directive.bindToController);
    }
    return bindings;
}

function $CompileProvider($provide) {
    var hasDirectives = {};

    this.directive = function (name, directiveFactory) {
        if (_.isString(name)) {
            if (name === 'hasOwnProperty') {
                throw 'directive name hasOwnProperty not valid';
            }

            if (!hasDirectives.hasOwnProperty(name)) {
                hasDirectives[name] = [];

                //register the function **Provider
                $provide.factory(name + 'Directive', ['$injector', function ($injector) {
                    //looks up the directive factories from internal registry
                    var factories = hasDirectives[name];
                    return _.map(factories, function (factory, i) {
                        var directive = $injector.invoke(factory);
                        directive.restrict = directive.restrict || 'EA';    //'EA' by default
                        directive.priority = directive.priority || 0;

                        // if no compile attribute, return link function instead
                        if (directive.link && !directive.compile) {
                            directive.compile = _.constant(directive.link);
                        }
                        //if (_.isObject(directive.scope)) {
                        //    directive.$$isolateBindings = parseIsolateBindings(directive.scope);
                        //}
                        directive.$$bindings = parseDirectiveBindings(directive);

                        directive.name = directive.name || name;
                        directive.index = i;
                        directive.require = directive.require || (directive.controller && name);
                        return directive;
                    });
                }]);
            }
            hasDirectives[name].push(directiveFactory);
        } else {
            _.forEach(name, function (directiveFactory, name) {
                this.directive(name, directiveFactory);
            }, this);
        }
    };

    this.$get = ['$injector', '$parse', '$rootScope', '$controller', function ($injector, $parse, $rootScope, $controller) {
        function compile($compileNodes) {
            var compositeLinkFn = compileNodes($compileNodes);

            //return linking function
            return function publicLinkFn(scope) {
                $compileNodes.data('$scope', scope);
                compositeLinkFn(scope, $compileNodes);
            };
        }

        // Attributes constructor
        function Attributes(element) {
            this.$$element = element;
            this.$attr = {};    //mapping normalized attribute names to original
        }

        Attributes.prototype.$set = function (key, value, writeAttr, attributeName) {
            this[key] = value;

            if (isBooleanAttribute(this.$$element[0], key)) {
                this.$$element.prop(key, value);
            }
            if (!attributeName) {
                if (this.$attr[key]) {
                    attributeName = this.$attr[key];
                } else {
                    attributeName = this.$attr[key] = _.kebabCase(key, '-');
                }
            } else {
                this.$attr[key] = attributeName;
            }
            if (writeAttr !== false) {
                this.$$element.attr(attributeName, value); //flush the attribute to DOM
            }

            // invoke all observers
            if (this.$$observers) {
                _.forEach(this.$$observers[key], function (observer) {
                    try {
                        observer(value);
                    } catch (e) {
                        console.log(e);
                    }
                });
            }
        };

        //observers
        Attributes.prototype.$observe = function (key, fn) {
            var self = this;
            this.$$observers = this.$$observers || Object.create(null);
            this.$$observers[key] = this.$$observers[key] || [];
            this.$$observers[key].push(fn);
            $rootScope.$evalAsync(function () {
                fn(self[key]);
            });
            //return a deregistration function
            return function () {
                var index = self.$$observers[key].indexOf(fn);
                if (index >= 0) {
                    self.$$observers[key].splice(index, 1);
                }
            };
        };

        //manipulate attribute class
        Attributes.prototype.$addClass = function (classVal) {
            this.$$element.addClass(classVal);
        };
        Attributes.prototype.$removeClass = function (classVal) {
            this.$$element.removeClass(classVal);
        };
        Attributes.prototype.$updateClass = function (newClassVal, oldClassVal) {
            var newClasses = newClassVal.split(/\s+/);
            var oldClasses = oldClassVal.split(/\s+/);
            var addedClasses = _.difference(newClasses, oldClasses);
            var removedClasses = _.difference(oldClasses, newClasses);
            if (addedClasses.length) {
                this.$addClass(addedClasses.join(' '));
            }
            if (removedClasses.length) {
                this.$removeClass(removedClasses.join(' '));
            }
        };

        function compileNodes($compileNodes) {
            var linkFns = [];

            //iterate over the given jQuery object
            _.forEach($compileNodes, function (node, index) {
                var attrs = new Attributes($(node)); //node attribute object
                var directives = collectDirectives(node, attrs);
                var nodeLinkFn; //node's link function
                var childLinkFn;
                if (directives.length) {
                    nodeLinkFn = applyDirectivesToNode(directives, node, attrs);
                }
                if ((!nodeLinkFn || !nodeLinkFn.terminal) && node.childNodes && node.childNodes.length) {
                    childLinkFn = compileNodes(node.childNodes);
                }
                if (nodeLinkFn && nodeLinkFn.scope) {
                    attrs.$$element.addClass('ng-scope');
                }
                if (nodeLinkFn || childLinkFn) {
                    linkFns.push({
                        nodeLinkFn: nodeLinkFn,
                        childLinkFn: childLinkFn,
                        idx: index
                    });
                }
            });

            //link all the individual nodes' node link function
            function compositeLinkFn(scope, linkNodes) {
                var stableNodeList = [];
                _.forEach(linkFns, function (linkFn) {
                    var nodeIndex = linkFn.idx;
                    stableNodeList[nodeIndex] = linkNodes[nodeIndex];
                });

                _.forEach(linkFns, function (linkFnObj) {
                    var node = stableNodeList[linkFnObj.idx];
                    if (linkFnObj.nodeLinkFn) {
                        if (linkFnObj.nodeLinkFn.scope) {
                            scope = scope.$new();
                            $(node).data('$scope', scope);
                        }
                        if (linkFnObj.nodeLinkFn) {
                            linkFnObj.nodeLinkFn(
                                linkFnObj.childLinkFn,
                                scope,
                                node
                            );
                        }
                    }
                    else {
                        linkFnObj.childLinkFn(
                            scope,
                            node.childNodes
                        );
                    }
                });
            }

            return compositeLinkFn;
        }

        function applyDirectivesToNode(directives, compileNode, attrs) {
            var $compileNode = $(compileNode);//jquery wrap
            var terminalPriority = -Number.MAX_VALUE;
            var terminal = false;
            var preLinkFns = [], postLinkFns = [], controllers = {};
            var newScopeDirective; //request new scope
            var newIsolateScopeDirective;
            var controllerDirectives;   //directives that have controller

            function getControllers(require, $element) {
                // lookup the required controller and return it

                if (_.isArray(require)) {
                    return _.map(require, getControllers);
                } else {
                    var value;
                    var match = require.match(/^(\^\^?)?(\?)?(\^\^?)?/);
                    // regex???
                    // var match = require.match(/^(\^\^)?/);

                    var optional = match[2];
                    require = require.substring(match[0].length);
                    if (match[1] || match[3]){
                        if (match[3] && !match[1]){
                            match[1] = match[3];
                        }
                        if (match[1] === '^^'){
                            $element = $element.parent();
                        }
                        // match ^..
                        while ($element.length){
                            value = $element.data('$'+require+'Controller');
                            if (value){
                                break;
                            }else{
                                $element = $element.parent();
                            }
                        }
                    }else{
                        if (controllers[require]) {
                            value = controllers[require].instance;
                        }
                    }
                    if (!value && !optional) {
                        throw 'Controller ' + require + ' required by directive, cannot be found';
                    }
                    return value || null;
                }
            }

            function addLinkFns(preLinkFn, postLinkFn, attrStart, attrEnd, isolateScope, require) {
                if (preLinkFn) {
                    if (attrStart) {
                        preLinkFn = groupElementsLinkFnWrapper(preLinkFn, attrStart, attrEnd);
                    }
                    preLinkFn.isolateScope = isolateScope;
                    preLinkFn.require = require;
                    preLinkFns.push(preLinkFn);
                }
                if (postLinkFn) {
                    if (attrStart) {
                        postLinkFn = groupElementsLinkFnWrapper(postLinkFn, attrStart, attrEnd);
                    }
                    postLinkFn.isolateScope = isolateScope;
                    postLinkFn.require = require;
                    postLinkFns.push(postLinkFn);
                }
            }

            _.forEach(directives, function (directive) {
                if (directive.$$start) {
                    //replace the nodes passed to compile with the start and end nodes and any siblings in between
                    $compileNode = groupScan(compileNode, directive.$$start, directive.$$end);
                }
                if (directive.priority < terminalPriority) {
                    return false;
                }
                if (directive.scope) {
                    if (_.isObject(directive.scope)) {
                        if (newIsolateScopeDirective || newScopeDirective) {
                            throw 'multiple directives asking for new/inherited scope';
                        }
                        newIsolateScopeDirective = directive;
                    } else {
                        if (newIsolateScopeDirective) {
                            throw 'multiple directives asking for new/inherited scope';
                        }
                        newScopeDirective = newScopeDirective || directive;
                    }
                }
                if (directive.compile) {
                    var linkFn = directive.compile($compileNode, attrs);
                    var isolatedScope = (directive === newIsolateScopeDirective);
                    var attrStart = directive.$$start; //multi element
                    var attrEnd = directive.$$end;
                    var require = directive.require;

                    if (_.isFunction(linkFn)) {
                        addLinkFns(null, linkFn, attrStart, attrEnd, isolatedScope, require);
                    } else if (linkFn) {
                        addLinkFns(linkFn.pre, linkFn.post, attrStart, attrEnd, isolatedScope, require);
                    }
                }
                if (directive.terminal) {
                    terminal = true;
                    terminalPriority = directive.priority;
                }
                // if directive has controller
                if (directive.controller) {
                    controllerDirectives = controllerDirectives || {};
                    controllerDirectives[directive.name] = directive;
                }
            });

            function nodeLinkFn(childLinkFn, scope, linkNode) {
                var $element = $(linkNode);

                var isolateScope;
                if (newIsolateScopeDirective) {
                    // isolate scope only for directive that requested it
                    isolateScope = scope.$new(true);
                    $element.addClass('ng-isolate-scope');
                    $element.data('$isolateScope', isolateScope);
                }
                if (controllerDirectives) {
                    _.forEach(controllerDirectives, function (directive) {
                        var locals = {
                            $scope: (directive === newIsolateScopeDirective) ? isolateScope : scope,
                            $element: $element,
                            $attrs: attrs
                        };  // add locals support and pass to controller
                        var controllerName = directive.controller;
                        if (controllerName === '@') {
                            controllerName = attrs[directive.name];
                        }

                        var controller = $controller(controllerName, locals, true, directive.controllerAs);
                        controllers[directive.name] = controller;
                        $element.data('$'+directive.name+'Controller', controller.instance);
                    });
                }

                if (newIsolateScopeDirective) {
                    initializeDirectiveBindings(scope, attrs, isolateScope, newIsolateScopeDirective.$$bindings.isolateScope, isolateScope);
                }

                var scopeDirective = newIsolateScopeDirective || newScopeDirective;
                if (scopeDirective && controllers[scopeDirective.name]) {
                    initializeDirectiveBindings(scope, attrs, controllers[scopeDirective.name].instance, scopeDirective.$$bindings.bindToController, isolateScope);
                }

                _.forEach(controllers, function (controller) {
                    // after isolate scope bindings, before prelink functions
                    controller();   //invoke the semi-constructed controller functions
                });

                _.forEach(preLinkFns, function (linkFn) {
                    linkFn(linkFn.isolateScope ? isolateScope : scope, $element, attrs, linkFn.require && getControllers(linkFn.require, $element));
                });
                if (childLinkFn) {
                    childLinkFn(scope, linkNode.childNodes);
                }
                _.forEachRight(postLinkFns, function (linkFn) {
                    linkFn(linkFn.isolateScope ? isolateScope : scope, $element, attrs, linkFn.require && getControllers(linkFn.require, $element));
                });
            }

            nodeLinkFn.terminal = terminal;
            nodeLinkFn.scope = newScopeDirective && newScopeDirective.scope;    // set scope attribute on the node link function
            return nodeLinkFn;
        }


        function initializeDirectiveBindings(scope, attrs, destination, bindings, newScope) {
            _.forEach(bindings, function (definition, scopeName) {
                var attrName = definition.attrName;
                switch (definition.mode) {
                    case '@':   //isolate attribute binding
                        attrs.$observe(attrName, function (newAttrValue) {
                            destination[scopeName] = newAttrValue;
                        });
                        if (attrs[attrName]) {
                            destination[scopeName] = attrs[attrName];
                        }
                        break;
                    case '=':   //bi-directional data binding
                        if (definition.optional && !attrs[attrName]) {
                            break;
                        }
                        var parentGet = $parse(attrs[attrName]);
                        var lastValue = destination[scopeName] = parentGet(scope);
                        //the value that the parent scope had after the last digest

                        var parentValueWatch = function () {
                            var parentValue = parentGet(scope);
                            if (destination[scopeName] !== parentValue) {
                                if (parentValue !== lastValue) {
                                    destination[scopeName] = parentValue;
                                } else {
                                    // value has changed in the isolate scope, update parent
                                    parentValue = destination[scopeName];
                                    parentGet.assign(scope, parentValue);
                                }
                            }
                            lastValue = parentValue;
                            return lastValue;
                        };
                        var unwatch;
                        if (definition.collection) {
                            unwatch = scope.$watchCollection(attrs[attrName], parentValueWatch);
                        }
                        else {
                            unwatch = scope.$watch(parentValueWatch);
                        }
                        destination.$on('$destroy', unwatch);
                        break;
                    case '&':   //expression binding
                        var parentExpr = $parse(attrs[attrName]);
                        if (definition.optional && parentExpr === _.noop) {
                            break;
                        }
                        destination[scopeName] = function (locals) {
                            return parentExpr(scope, locals);
                        };
                        break;
                }
            });
        }

        function groupScan(node, startAttr, endAttr) {
            var nodes = [];
            if (startAttr && node && node.hasAttribute(startAttr)) {
                //the function begins collecting the group
                var depth = 0;
                do {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.hasAttribute(startAttr)) {
                            depth++;
                        } else if (node.hasAttribute(endAttr)) {
                            depth--;
                        }
                    }
                    nodes.push(node);
                    node = node.nextSibling;
                } while (depth > 0);
            } else {
                nodes.push(node);
            }
            return $(nodes);
        }

        function groupElementsLinkFnWrapper(linkFn, attrStart, attrEnd) {
            return function (scope, element, attrs, ctrl) {
                var group = groupScan(element[0], attrStart, attrEnd);
                return linkFn(scope, group, attrs, ctrl);
            };
        }

        // find what directives apply to given DOM node
        function collectDirectives(node, attrs) {
            //matching directives by element name
            var directives = [];
            var match; //holding regex matching

            if (node.nodeType === Node.ELEMENT_NODE) {
                var normalizedNodeName = directiveNormalize(nodeName(node).toLowerCase());// prefix of DOM element name
                addDirective(directives, normalizedNodeName, 'E');

                // matching by attributes
                _.forEach(node.attributes, function (attribute) {
                    var attributeStartName, attributeEndName;
                    var name = attribute.name;
                    var normalizedAttrName = directiveNormalize(name.toLowerCase());

                    // ng-attr- override attribute
                    var isNgAttr = /^ngAttr[A-Z]/.test(normalizedAttrName);
                    //console.log('isNgAttr: ', isNgAttr, ' normalizedAttrName:', normalizedAttrName);
                    if (isNgAttr) {
                        name = _.kebabCase(
                            normalizedAttrName[6].toLowerCase() +
                            normalizedAttrName.substring(7)
                        );
                        normalizedAttrName = directiveNormalize(name.toLowerCase());
                    }
                    attrs.$attr[normalizedAttrName] = name;

                    var directiveNName = normalizedAttrName.replace(/(Start|End)$/, ''); //deal with Start or End suffixes
                    if (directiveIsMultiElement(directiveNName)) {
                        if (/Start$/.test(normalizedAttrName)) {
                            attributeStartName = name;
                            attributeEndName = name.substring(0, name.length - 5) + 'end';
                            name = name.substring(0, name.length - 6);
                        }
                    }
                    normalizedAttrName = directiveNormalize(name.toLowerCase());
                    addDirective(directives, normalizedAttrName, 'A', attributeStartName, attributeEndName);

                    if (isNgAttr || !attrs.hasOwnProperty(normalizedAttrName)) {
                        attrs[normalizedAttrName] = attribute.value.trim(); // collect the attributes valule
                        if (isBooleanAttribute(node, normalizedAttrName)) {
                            attrs[normalizedAttrName] = true;
                        }
                    }
                });
                var className = node.className;
                // regex parsing the classname string
                if (_.isString(className) && !_.isEmpty(className)) {
                    while ((match = /([\d\w\-_]+)(?:\:([^;]+))?;?/.exec(className))) {
                        var normalizedClassName = directiveNormalize(match[1]);
                        if (addDirective(directives, normalizedClassName, 'C')) {
                            attrs[normalizedClassName] = match[2] ? match[2].trim() : undefined;
                        }

                        className = className.substr(match.index + match[0].length);
                    }
                }

            } else if (node.nodeType === Node.COMMENT_NODE) {
                //applying directives to HTML comments
                match = /^\s*directive\:\s*([\d\w\-_]+)\s*(.*)$/.exec(node.nodeValue);
                if (match) {
                    var normalizedName = directiveNormalize(match[1]);
                    if (addDirective(directives, normalizedName, 'M')) {
                        attrs[normalizedName] = match[2] ? match[2].trim() : undefined;
                    }
                }
            }

            directives.sort(byPriority);
            return directives;
        }

        // checks whether the attribute is standard boolean name, or element name is where boolean attributes are used
        function isBooleanAttribute(node, attrName) {
            return BOOLEAN_ATTRS[attrName] && BOOLEAN_ELEMENTS[node.nodeName];
        }

        function directiveIsMultiElement(name) {
            if (hasDirectives.hasOwnProperty(name)) {
                // if exists directives registered with name
                var directives = $injector.get(name + 'Directive');
                return _.any(directives, {multiElement: true});
                // if multiElement flag set to true
            }
            return false;
        }

        // sort directives by priority
        function byPriority(a, b) {
            var diff = b.priority - a.priority;
            if (diff !== 0) {
                return diff;
            } else {
                var diffname = a.name < b.name ? -1 : 1;
                if (diffname !== 0) {
                    return diffname;
                } else {
                    return a.index - b.index;
                }
            }
        }

        // raw DOM node or jQuery wrapped one
        function nodeName(element) {
            return element.nodeName ? element.nodeName : element[0].nodeName;
        }

        // checks if the local hasDirectives array has directives with that name.
        function addDirective(directives, name, mode, attrStartName, attrEndName) {
            var match;  //whether a directive was added or not
            if (hasDirectives.hasOwnProperty(name)) {
                var foundDirectives = $injector.get(name + 'Directive');
                var applicableDirectives = _.filter(foundDirectives, function (dir) {
                    return dir.restrict.indexOf(mode) !== -1;   //filter matching directives of current mode
                });
                _.forEach(applicableDirectives, function (directive) {
                    if (attrStartName) {
                        //attach that to the directive object with the special keys $$start and $$end
                        directive = _.create(directive, {
                            $$start: attrStartName,
                            $$end: attrEndName
                        });
                    }
                    directives.push(directive);
                    match = directive;
                });
                //push.apply concatenate the array to directives
            }
            return match;
        }

        return compile;
    }];
}
$CompileProvider.$inject = ['$provide'];

module.exports = $CompileProvider;