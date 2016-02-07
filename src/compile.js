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
                    return _.map(factories, function(factory){
                        var directive = $injector.invoke(factory);
                        directive.restrict = directive.restrict || 'EA';    //'EA' by default
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
                applyDirectivesToNode(directives, node);
                if (node.childNodes && node.childNodes.length){
                    compileNodes(node.childNodes);
                }
            });
        }

        function applyDirectivesToNode(directives, compileNode){
            var $compileNode = $(compileNode);//jquery wrap
            _.forEach(directives, function(directive){
                if (directive.compile){
                    directive.compile($compileNode);
                }
            });
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
                    var normalizedAttrName = directiveNormalize(attribute.name.toLowerCase());
                    if (/^ngAttr[A-Z]/.test(normalizedAttrName)){
                        normalizedAttrName = normalizedAttrName[6].toLowerCase() + normalizedAttrName.substring(7);
                    }
                    addDirective(directives, normalizedAttrName, 'A');
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

            return directives;
        }

        // raw DOM node or jQuery wrapped one
        function nodeName(element){
            return element.nodeName?element.nodeName:element[0].nodeName;
        }

        // checks if the local hasDirectives array has directives with that name.
        function addDirective(directives, name, mode){
            if (hasDirectives.hasOwnProperty(name)){
                var foundDirectives = $injector.get(name+'Directive');
                var applicableDirectives = _.filter(foundDirectives, function(dir){
                    return dir.restrict.indexOf(mode) !== -1;   //filter matching directives of current mode
                });
                directives.push.apply(directives, applicableDirectives);
                //push.apply concatenate the array to directives
            }
        }

        return compile;
    }];
}
$CompileProvider.$inject = ['$provide'];

module.exports = $CompileProvider;