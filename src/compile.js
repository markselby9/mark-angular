'use strict';
var _ = require('lodash');
var $ = require('jquery');

var PREFIX_REGEXP = /(x[\:\-_]|data[\:\-_])/i;

// handling the prefix matching of DOM element name
function directiveNormalize(name){
    return _.camelCase(name.replace(PREFIX_REGEXP, ''));//remove the prefix, camel case the name
}

function $CompileProvider($provide){
    var hasDirectives = {};

    this.directive = function(name, directiveFactory){
        if (_.isString(name)){
            if (name==='hasOwnProperty'){
                throw 'directive name hasOwnProperty not valid';
            }

            if (!hasDirectives.hasOwnProperty(name)){
                hasDirectives[name] = [];

                //register the function **Provider
                $provide.factory(name+'Directive', ['$injector', function($injector){
                    //looks up the directive factories from internal registry
                    var factories = hasDirectives[name];
                    return _.map(factories, function(factory, i){
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
        } else{
            _.forEach(name, function(directiveFactory, name){
                this.directive(name, directiveFactory);
            }, this);
        }
    };

    this.$get = ['$injector', function($injector){
        function compile($compileNodes){
            return compileNodes($compileNodes);
        }

        function compileNodes($compileNodes){
            //iterate over the given jQuery object
            _.forEach($compileNodes, function(node){
                var directives = collectDirectives(node);
                var terminal = applyDirectivesToNode(directives, node);
                if (!terminal && node.childNodes && node.childNodes.length){
                    compileNodes(node.childNodes);
                }
            });
        }

        function applyDirectivesToNode(directives, compileNode){
            var $compileNode = $(compileNode);//jquery wrap
            var terminalPriority = -Number.MAX_VALUE;
            var terminal = false;
            _.forEach(directives, function(directive){
                if (directive.$$start){
                    //replace the nodes passed to compile with the start and end nodes and any siblings in between
                    $compileNode = groupScan(compileNode, directive.$$start, directive.$$end);
                }
                if (directive.priority < terminalPriority){
                    return false;
                }
                if (directive.compile){
                    directive.compile($compileNode);
                }
                if (directive.terminal){
                    terminal = true;
                    terminalPriority = directive.priority;
                }
            });
            return terminal;
        }

        function groupScan(node, startAttr, endAttr){
            var nodes = [];
            if (startAttr && node && node.hasAttribute(startAttr)){
                //the function begins collecting the group
                var depth = 0;
                do{
                    if (node.nodeType === Node.ELEMENT_NODE){
                        if (node.hasAttribute(startAttr)){
                            depth++;
                        }else if (node.hasAttribute(endAttr)){
                            depth--;
                        }
                    }
                    nodes.push(node);
                    node = node.nextSibling;
                } while (depth>0);
            }else{
                nodes.push(node);
            }
            return $(nodes);
        }

        // find what directives apply to given DOM node
        function collectDirectives(node){
            //matching directives by element name
            var directives = [];

            if (node.nodeType === Node.ELEMENT_NODE){
                var normalizedNodeName = directiveNormalize(nodeName(node).toLowerCase());// prefix of DOM element name
                addDirective(directives, normalizedNodeName, 'E');

                // matching by attributes
                _.forEach(node.attributes, function(attribute){
                    var attributeStartName, attributeEndName;
                    var name = attribute.name;
                    var normalizedAttrName = directiveNormalize(name.toLowerCase());
                    if (/^ngAttr[A-Z]/.test(normalizedAttrName)){   //remove ng-attr- prefix
                        //normalizedAttrName = normalizedAttrName[6].toLowerCase() + normalizedAttrName.substring(7);
                        name = _.kebabCase(normalizedAttrName[6].toLowerCase()+normalizedAttrName.substring(7));
                    }

                    var directiveNName = normalizedAttrName.replace(/(Start|End)$/, ''); //deal with Start or End suffixes
                    if (directiveIsMultiElement(directiveNName)){
                        if (/Start$/.test(normalizedAttrName)){
                            attributeStartName = name;
                            attributeEndName = name.substring(0, name.length-5)+'end';
                            name = name.substring(0, name.length-6);
                        }
                    }
                    normalizedAttrName = directiveNormalize(name.toLowerCase());
                    addDirective(directives, normalizedAttrName, 'A', attributeStartName, attributeEndName);
                });

                //matching by class
                _.forEach(node.classList, function(className){
                    var normalizedClassName = directiveNormalize(className);
                    addDirective(directives, normalizedClassName, 'C');
                });
            } else if (node.nodeType === Node.COMMENT_NODE){
                //applying directives to HTML comments
                var match = /^\s*directive\:\s*([\d\w\-_]+)/.exec(node.nodeValue);
                if (match){
                    addDirective(directives, directiveNormalize(match[1]), 'M');
                }
            }

            directives.sort(byPriority);
            return directives;
        }

        function directiveIsMultiElement(name){
            if (hasDirectives.hasOwnProperty(name)){
                // if exists directives registered with name
                var directives = $injector.get(name+'Directive');
                return _.any(directives, {multiElement:true});
                // if multiElement flag set to true
            }
            return false;
        }

        // sort directives by priority
        function byPriority(a,b){
            var diff = b.priority - a.priority;
            if (diff!==0){
                return diff;
            }else{
                var diffname = a.name < b.name?-1:1;
                if (diffname !== 0){
                    return diffname;
                } else{
                    return a.index - b.index;
                }
            }
        }

        // raw DOM node or jQuery wrapped one
        function nodeName(element){
            return element.nodeName?element.nodeName:element[0].nodeName;
        }

        // checks if the local hasDirectives array has directives with that name.
        function addDirective(directives, name, mode, attrStartName, attrEndName){
            if (hasDirectives.hasOwnProperty(name)){
                var foundDirectives = $injector.get(name+'Directive');
                var applicableDirectives = _.filter(foundDirectives, function(dir){
                    return dir.restrict.indexOf(mode) !== -1;   //filter matching directives of current mode
                });
                _.forEach(applicableDirectives, function(directive){
                    if (attrStartName){
                        //attach that to the directive object with the special keys $$start and $$end
                        directive = _.create(directive, {
                            $$start: attrStartName,
                            $$end: attrEndName
                        });
                    }
                    directives.push(directive);
                });
                //push.apply concatenate the array to directives
            }
        }

        return compile;
    }];
}
$CompileProvider.$inject = ['$provide'];

module.exports = $CompileProvider;