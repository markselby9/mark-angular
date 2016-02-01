/**
 * Created by fengchaoyi on 16/1/29.
 */
'use strict';
var _ = require('lodash');


function $Http() {
    var interceptorFactories = this.interceptors = [];

    var useApplyAsync = false;
    this.useApplyAsync = function (value) {
        if (_.isUndefined(value)) {
            return useApplyAsync;
        } else {
            useApplyAsync = !!value;
            return this;
        }
    };

    var defaults = this.defaults = {
        headers: {   //method-specific default headers
            common: {
                Accept: 'application/json, text/plain, */*'
            },
            post: {
                'Content-Type': 'application/json;charset=utf-8'
            },
            put: {
                'Content-Type': 'application/json;charset=utf-8'
            },
            patch: {
                'Content-Type': 'application/json;charset=utf-8'
            }
        },
        transformRequest: [function (data) {
            if (_.isObject(data) && !isBlob(data) && !isFile(data) && !isFormData(data)) {
                //some exceptions won't be transformed into JSON
                return JSON.stringify(data);
            } else {
                return data;
            }
        }],
        transformResponse: [defaultHttpResponseTransform],
        paramSerializer: '$httpParamSerializer'
    };

    function isBlob(object) {
        return object.toString() === '[object Blob]';
    }

    function isFile(object) {
        return object.toString() === '[object File]';
    }

    function isFormData(object) {
        return object.toString() === '[object FormData]';
    }

    function defaultHttpResponseTransform(data, headers) {
        if (_.isString(data)) {
            var contentType = headers('Content-Type');
            if ((contentType && contentType.indexOf('application/json') === 0) || isJsonLike(data)) {
                return JSON.parse(data);
            }
        }
        return data;
    }

    function isJsonLike(data) {
        if (data.match(/^\{(?!\{)/)) {
            return data.match(/\}$/);
        } else if (data.match(/^\[/)) {
            return data.match(/\]$/);
        }
    }

    this.$get = ['$httpBackend', '$q', '$rootScope', '$injector',
        function ($httpBackend, $q, $rootScope, $injector) {

            var interceptors = _.map(interceptorFactories, function (fn) {
                return _.isString(fn) ? $injector.get(fn) : $injector.invoke(fn);
            });
            //code for sending the request
            function sendReq(config, reqData) {
                var deferred = $q.defer();
                // a request is pushed into array when it's sent,
                // and removed when the promise is resolved or rejected
                $http.pendingRequests.push(config);
                deferred.promise.then(function () {
                    _.remove($http.pendingRequests, config);
                }, function () {
                    _.remove($http.pendingRequests, config);
                });

                //callback function to httpBackend
                function done(status, response, headerString, statusText) {
                    status = Math.max(0, status);

                    function resolvePromise() {
                        deferred[isSuccess(status) ? 'resolve' : 'reject']({
                            status: status,
                            data: response,
                            statusText: statusText,
                            headers: headersGetter(headerString),
                            config: config
                        });
                    }

                    if (useApplyAsync){
                        $rootScope.$applyAsync(resolvePromise);
                    } else{
                        resolvePromise();
                        if (!$rootScope.$$phase) {
                            $rootScope.$apply();
                        }

                    }
                }

                //build url like http://...?a=42&b=42
                var url = buildUrl(config.url, config.paramSerializer(config.params));

                $httpBackend(config.method, url, reqData,
                    done, config.headers, config.timeout,
                    config.withCredentials);
                return deferred.promise;
            }

            function buildUrl(url, serializedParams) {
                if (serializedParams.length) {
                    url += (url.indexOf('?') === -1 ? '?' : '&');
                    url += serializedParams;
                }
                return url;
            }

            function serverRequest(config) {
                if (_.isString(config.paramSerializer)) {
                    config.paramSerializer = $injector.get(config.paramSerializer);
                }

                if (_.isUndefined(config.withCredentials) && !_.isUndefined(defaults.withCredentials)) {
                    config.withCredentials = defaults.withCredentials;
                }

                var requestData = transformData(
                    config.data,
                    headersGetter(config.headers),
                    undefined,
                    config.transformRequest
                );
                if (_.isUndefined(requestData)) {
                    _.forEach(config.headers, function (v, k) {
                        if (k.toLowerCase() === 'content-type') {
                            delete config.headers[k];
                        }
                    });
                }

                function transformResponse(response) {
                    if (response.data) {
                        response.data = transformData(response.data,
                            response.headers, response.status,
                            config.transformResponse);
                    }
                    if (isSuccess(response.status)) {
                        return response;
                    } else {
                        return $q.reject(response);
                    }
                }

                return sendReq(config, requestData).then(transformResponse, transformResponse);
            }

            //code for preparing the request
            function $http(requestConfig) {
                var config = _.extend({
                    method: 'GET',
                    transformRequest: defaults.transformRequest,
                    transformResponse: defaults.transformResponse,
                    paramSerializer: defaults.paramSerializer
                }, requestConfig);
                config.headers = mergeHeaders(requestConfig);

                var promise = $q.when(config);
                _.forEach(interceptors, function (interceptor) {
                    promise = promise.then(interceptor.request, interceptor.requestError);
                });
                promise = promise.then(serverRequest);
                _.forEachRight(interceptors, function (interceptor) {
                    promise = promise.then(interceptor.response, interceptor.responseError);
                });

                promise.success = function (fn) {
                    promise.then(function (response) {
                        fn(response.data, response.status, response.headers, config);
                    });
                    return promise;
                };
                promise.error = function (fn) {
                    promise.catch(function (response) {
                        fn(response.data, response.status, response.headers, config);
                    });
                    return promise;
                };
                return promise;
            }

            function transformData(data, headers, status, transform) {
                if (_.isFunction(transform)) {
                    return transform(data, headers, status);
                } else {
                    return _.reduce(transform, function (data, fn) {
                        return fn(data, headers, status);
                    }, data);
                }
            }

            function mergeHeaders(config) {
                var requestHeaders = _.extend({},
                    config.headers);
                var defaultHeaders = _.extend({},
                    defaults.headers.common,
                    defaults.headers[(config.method || 'get').toLowerCase()]);
                //case-insensitive check whether defaultheader exists
                _.forEach(defaultHeaders, function (value, key) {
                    var headerExists = _.any(requestHeaders, function (v, k) {
                        return k.toLowerCase() == key.toLowerCase();
                    });
                    if (!headerExists) {
                        requestHeaders[key] = value;
                    }
                });
                return executeHeaderFns(requestHeaders, config);
            }

            // if a header is a function that produces a string
            function executeHeaderFns(headers, config) {
                return _.transform(headers, function (result, v, k) {
                    if (_.isFunction(v)) {
                        v = v(config);
                        if (_.isNull(v) || _.isUndefined(v)) {
                            delete result[k];
                        } else {
                            result[k] = v;
                        }
                    }
                }, headers);
            }


            function headersGetter(headers) {
                var headersObject;
                return function (name) {
                    headersObject = headersObject || parseHeaders(headers);
                    if (name) {
                        return headersObject[name.toLowerCase()];
                    } else {
                        return headersObject;
                    }
                };
            }

            function parseHeaders(headers) {
                if (_.isObject(headers)) {
                    return _.transform(headers, function (result, v, k) {
                        result[_.trim(k.toLowerCase())] = _.trim(v);
                    }, {});
                } else {
                    var lines = headers.split('\n');
                    return _.transform(lines, function (result, line) {
                        var colonIndex = line.indexOf(':');
                        var name = _.trim(line.substr(0, colonIndex)).toLowerCase();
                        var value = _.trim(line.substr(colonIndex + 1));
                        if (name) {
                            result[name] = value;
                        }
                    }, {});
                }

            }

            function isSuccess(status) {
                return status >= 200 && status < 300;
            }

            $http.defaults = defaults;
            $http.pendingRequests = [];

            //shorthand methods of GET, HEAD, DELETE
            _.forEach(['get', 'head', 'delete'], function (method) {
                $http[method] = function (url, config) {
                    return $http(_.extend(config || {}, {
                        method: method.toUpperCase(),
                        url: url
                    }));
                };
            });
            _.forEach(['post', 'put', 'patch'], function (method) {
                $http[method] = function (url, data, config) {
                    return $http(_.extend(config || {}, {
                        url: url,
                        method: method.toUpperCase(),
                        data: data
                    }));
                };
            });
            return $http;
        }];
}

function $HttpParamSerializerProvider() {
    this.$get = function () {
        return function serializeParams(params) {
            var parts = [];
            _.forEach(params, function (value, key) {
                if (_.isNull(value) || _.isUndefined(value)) {
                    return;
                }
                if (!_.isArray(value)) {
                    value = [value];
                }
                _.forEach(value, function (v) {
                    if (_.isObject(v)) {
                        v = JSON.stringify(v);
                    }
                    parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(v));
                });
            });
            return parts.join('&');
        };
    };
}

function $HttpParamSerializerJQLikeProvider() {
    this.$get = function () {
        return function (params) {
            var parts = [];

            function serialize(value, prefix, topLevel) {
                if (_.isNull(value) || _.isUndefined(value)) {
                    return;
                }
                if (_.isArray(value)) {
                    _.forEach(value, function (v, i) {
                        serialize(v, prefix + '[' + (_.isObject(v) ? i : '') + ']');
                    });
                } else if (_.isObject(value)) {
                    _.forEach(value, function (v, k) {
                        serialize(v, prefix +
                            (topLevel ? '' : '[') +
                            k +
                            (topLevel ? '' : ']'));
                    });
                } else {
                    parts.push(encodeURIComponent(prefix) + '=' + encodeURIComponent(value));
                }
            }

            serialize(params, '', true);

            return parts.join('&');
        };
    };
}


module.exports = {
    $HttpProvider: $Http,
    $HttpParamSerializerProvider: $HttpParamSerializerProvider,
    $HttpParamSerializerJQLikeProvider: $HttpParamSerializerJQLikeProvider
};