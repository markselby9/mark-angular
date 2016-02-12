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
                        directive.name = directive.name || name;
                        directive.index = i;
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

    this.$get = ['$injector', '$rootScope', function ($injector, $rootScope) {
        function compile($compileNodes) {
            return compileNodes($compileNodes);
        }

        // Attributes constructor
        function Attributes(element) {
            this.$$element = element;
            this.$attr = {};    //mapping normalized attribute names to original
        }

        Attributes.prototype.$set = function (key, value, writeAttr, attributeName) {
            this[key] = value;

            if (isBooleanAttribute(this.$$element[0], key)){
                this.$$element.prop(key, value);
            }
            if (!attributeName){
                if (this.$attr[key]){
                    attributeName = this.$attr[key];
                }else{
                    attributeName = this.$attr[key] = _.kebabCase(key, '-');
                }
            } else{
                this.$attr[key] = attributeName;
            }
            if (writeAttr !== false) {
                this.$$element.attr(attributeName, value); //flush the attribute to DOM
            }

            // invoke all observers
            if (this.$$observers){
                _.forEach(this.$$observers[key], function(observer){
                    try{
                        observer(value);
                    }catch(e){
                        console.log(e);
                    }
                });
            }
        };

        //observers
        Attributes.prototype.$observe = function(key, fn){
            var self = this;
            this.$$observers = this.$$observers || Object.create(null);
            this.$$observers[key] = this.$$observers[key] || [];
            this.$$observers[key].push(fn);
            $rootScope.$evalAsync(function(){
                fn(self[key]);
            });
            //return a deregistration function
            return function(){
                var index = self.$$observers[key].indexOf(fn);
                if (index>=0){
                    self.$$observers[key].splice(index, 1);
                }
            };
        };

        function compileNodes($compileNodes) {
            //iterate over the given jQuery object
            _.forEach($compileNodes, function (node) {
                var attrs = new Attributes($(node)); //node attribute object
                var directives = collectDirectives(node, attrs);
                var terminal = applyDirectivesToNode(directives, node, attrs);
                if (!terminal && node.childNodes && node.childNodes.length) {
                    compileNodes(node.childNodes);
                }
            });
        }

        function applyDirectivesToNode(directives, compileNode, attrs) {
            var $compileNode = $(compileNode);//jquery wrap
            var terminalPriority = -Number.MAX_VALUE;
            var terminal = false;
            _.forEach(directives, function (directive) {
                if (directive.$$start) {
                    //replace the nodes passed to compile with the start and end nodes and any siblings in between
                    $compileNode = groupScan(compileNode, directive.$$start, directive.$$end);
                }
                if (directive.priority < terminalPriority) {
                    return false;
                }
                if (directive.compile) {
                    directive.compile($compileNode, attrs);
                }
                if (directive.terminal) {
                    terminal = true;
                    terminalPriority = directive.priority;
                }
            });
            return terminal;
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
                if (_.isString(className) && !_.isEmpty(className)){
                    while ((match=/([\d\w\-_]+)(?:\:([^;]+))?;?/.exec(className))){
                        var normalizedClassName = directiveNormalize(match[1]);
                        if (addDirective(directives, normalizedClassName, 'C')){
                            attrs[normalizedClassName] = match[2]?match[2].trim():undefined;
                        }

                        className = className.substr(match.index+match[0].length);
                    }
                }

            } else if (node.nodeType === Node.COMMENT_NODE) {
                //applying directives to HTML comments
                match = /^\s*directive\:\s*([\d\w\-_]+)/.exec(node.nodeValue);
                if (match) {
                    addDirective(directives, directiveNormalize(match[1]), 'M');
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